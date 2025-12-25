from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from pathlib import Path
import json
import random
from datetime import datetime
import uuid
import joblib
import pandas as pd

from sqlalchemy import select, func, text, case, delete, inspect
from sqlalchemy.orm import Session
from config import settings
from database import engine, SessionLocal
from models import Base, User, Transaction as TransactionModel
from auth_utils import hash_password, verify_password, create_access_token, decode_token
from model.feature_pipeline import FeatureEngineer

app = FastAPI(title="Anomalyse Backend", version="0.3.0")

def compute_rule_reasons(features_row: dict, amount: float) -> List[Dict[str, str]]:
    flags: List[Dict[str, str]] = []
    try:
        gv = float(features_row.get('Geo_Velocity_Check', 0))
        z = float(features_row.get('Amount_Z_Score', 0))
        cnt = int(features_row.get('Txn_Count_30_Min', 0))
        tsl = float(features_row.get('Time_Since_Last_TXN_Sec', 0))
    except Exception:
        gv, z, cnt, tsl = 0.0, 0.0, 0, 0.0
    # Fast Location: mirror Rule_Reason pattern from ML_Model_Final_.ipynb
    # Uses geospatial velocity check (> 1 implies required travel time exceeds observed gap)
    if gv > 1.0:
        flags.append({"type": "Fast Location", "reason": f"Geospatial anomaly: travel too fast (ratio {gv:.2f})."})
    # High Value: mirror Rule_Reason pattern
    # Trigger on extreme z-score or absolute amount threshold
    if z >= 3.0 or amount >= 100000:
        flags.append({"type": "High Value", "reason": f"Amount deviation detected (z-score {z:.2f})."})
    # Velocity: only flag those with time difference > 0 and < 10 seconds
    if (tsl > 0.0) and (tsl < 10.0):
        flags.append({"type": "Velocity", "reason": f"last gap {int(tsl)}s between consecutive transactions."})
    return flags

# CORS: allow frontend on Vite default port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "model" / "model.pkl"
# META_PATH is no longer strictly needed as pipeline handles features, but we can keep it if we want
# META_PATH = Path(__file__).parent / "model_meta.json" 

Base.metadata.create_all(bind=engine)

# Seed default user if missing
with SessionLocal() as db:
    existing = db.scalar(select(User).where(User.email == "analyst@anomalyse.bank"))
    if not existing:
        db.add(User(email="analyst@anomalyse.bank", password_hash=hash_password("password123"), role="analyst"))
        db.commit()


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Transaction(BaseModel):
    id: str
    timestamp: str
    amount: float
    user_id: str
    city: str
    category: str
    status: str
    flag_type: Optional[str] = None
    flag_reason: Optional[str] = None
    flags: List[Dict[str, str]] = []

class PredictionRequest(BaseModel):
    timestamp: str
    amount: float
    user_id: str
    city: str
    category: str

class PredictionResponse(BaseModel):
    is_fraud: bool
    risk_score: float
    status: str
    flags: List[Dict[str, str]] = []


class MetricsResponse(BaseModel):
    totalTransactions: int
    flaggedTransactions: int
    overallRiskScore: float
    fraudTrend: List[Dict]
    riskDistribution: List[Dict]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_token(authorization: str = Header(default="", alias="Authorization")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.replace("Bearer ", "").strip()
    
    # Allow hardcoded dev token for easier frontend/backend synchronization
    if token == "hardcoded-dev-token-for-deployment":
        return

    try:
        decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(subject=payload.email)
    return TokenResponse(access_token=token)


@app.get("/transactions", response_model=List[Transaction])
async def get_transactions(_: None = Depends(require_token), db: Session = Depends(get_db)):
    rows = db.scalars(select(TransactionModel).order_by(TransactionModel.timestamp.asc())).all()
    out: List[Transaction] = []
    for r in rows:
        flags_list = []
        primary_type = r.flag_type
        primary_reason = r.flag_reason
        
        # Try to parse flag_type as JSON (new format)
        if r.flag_type and (r.flag_type.startswith('[') or r.flag_type.startswith('{')):
            try:
                parsed = json.loads(r.flag_type)
                if isinstance(parsed, list):
                    flags_list = parsed
                    # Use first flag as primary for backward compatibility if needed
                    if flags_list:
                        primary_type = flags_list[0].get('type')
                        primary_reason = flags_list[0].get('reason')
            except:
                # Fallback to legacy string format
                flags_list = [{"type": r.flag_type, "reason": r.flag_reason or ""}]
        elif r.flag_type:
             # Legacy format
             flags_list = [{"type": r.flag_type, "reason": r.flag_reason or ""}]

        out.append(Transaction(
            id=r.id,
            timestamp=r.timestamp.isoformat() if r.timestamp else "",
            amount=r.amount,
            user_id=r.user_id,
            city=r.city,
            category=r.category,
            status=r.status,
            flag_type=primary_type,
            flag_reason=primary_reason,
            flags=flags_list
        ))
    return out


@app.get("/dashboard/metrics", response_model=MetricsResponse)
async def get_metrics(_: None = Depends(require_token), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(TransactionModel)) or 0
    flagged = db.scalar(select(func.count()).where(TransactionModel.status == "Suspicious")) or 0
    avg_risk = (float(flagged) / float(total) * 100.0) if total else 0.0

    rows = db.execute(
        select(
            func.date(TransactionModel.timestamp).label("date"),
            func.sum(case((TransactionModel.status.in_(["Suspicious", "Fake/Suspicious"]), 1), else_=0)).label("fraudCount"),
            func.sum(case((TransactionModel.status == "Safe", 1), else_=0)).label("safeCount")
        )
        .group_by(func.date(TransactionModel.timestamp))
        .order_by(func.date(TransactionModel.timestamp))
    ).mappings().all()
    trend = [dict(r) for r in rows]

    dist_rows = db.execute(
        select(TransactionModel.status.label("name"), func.count().label("value"))
        .group_by(TransactionModel.status)
    ).mappings().all()
    distribution = [dict(r) for r in dist_rows]

    return MetricsResponse(
        totalTransactions=int(total),
        flaggedTransactions=int(flagged),
        overallRiskScore=float(avg_risk) if avg_risk else 0.0,
        fraudTrend=trend,
        riskDistribution=distribution,
    )

@app.get("/health/db")
def health_db():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    try:
        with engine.connect() as conn:
            cnt = conn.scalar(text("SELECT COUNT(*) FROM transactions")) or 0
    except Exception:
        cnt = -1
    return {
        "dialect": engine.dialect.name,
        "url": settings.db_url(),
        "hasTransactionsTable": "transactions" in tables,
        "transactionsCount": int(cnt),
    }
@app.post("/transactions/clear")
async def clear_transactions(_: None = Depends(require_token), db: Session = Depends(get_db)):
    res = db.execute(delete(TransactionModel))
    db.commit()
    deleted = res.rowcount or 0
    return {"success": True, "deleted": int(deleted)}
@app.post("/transactions/notify")
async def notify_transaction(payload: Dict, _: None = Depends(require_token)):
    txn_id = payload.get("id")
    if not txn_id:
        raise HTTPException(status_code=400, detail="Missing transaction id")
    return {"success": True}

@app.post("/predict", response_model=PredictionResponse)
async def predict_fraud(txn: PredictionRequest, db: Session = Depends(get_db)):
    if not MODEL_PATH.exists():
        raise HTTPException(status_code=500, detail="Model not found. Please train using train_model.py first.")
    
    try:
        pipeline = joblib.load(MODEL_PATH)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to load model")

    # Fetch recent history for context (e.g. last 50 txns)
    try:
        current_ts = pd.to_datetime(txn.timestamp)
    except:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    # Fetch history
    history_rows = db.scalars(
        select(TransactionModel)
        .where(TransactionModel.user_id == txn.user_id)
        .where(TransactionModel.timestamp < current_ts)
        .order_by(TransactionModel.timestamp.desc())
        .limit(50) 
    ).all()
    
    # Convert to DataFrame
    history_data = []
    for row in history_rows:
        history_data.append({
            "Timestamp": row.timestamp,
            "UserID": row.user_id,
            "Amount": row.amount,
            "City": row.city,
            "Category": row.category,
            "Fraud_Type": 0 
        })
    
    # Add current transaction
    current_data = {
        "Timestamp": current_ts,
        "UserID": txn.user_id,
        "Amount": txn.amount,
        "City": txn.city,
        "Category": txn.category,
        "Fraud_Type": 0
    }
    history_data.append(current_data)
    
    df = pd.DataFrame(history_data)
    
    try:
        preds_all = pipeline.predict(df)
        probs_all = pipeline.predict_proba(df)
        pred = preds_all[-1]
        probs = probs_all[-1]
        
        classes = pipeline.classes_
        if 0 in classes:
            normal_idx = list(classes).index(0)
            safe_prob = float(probs[normal_idx])
        else:
            safe_prob = 0.0
            
        fe = FeatureEngineer()
        features_df = fe.fit_transform(df)
        features_row = features_df.iloc[-1].to_dict()
        flags = compute_rule_reasons(features_row, txn.amount)
        status = "Suspicious" if flags else "Safe"
        risk_score = round((1.0 - safe_prob) * 100.0, 2)
        fe = FeatureEngineer()
        is_fraud = pred != 0

        return PredictionResponse(
            is_fraud=bool(is_fraud),
            risk_score=float(risk_score),
            status=status,
            flags=flags
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...), _: None = Depends(require_token), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    if not MODEL_PATH.exists():
        raise HTTPException(status_code=400, detail="Model not found. Please train using model/train.py first.")

    try:
        pipeline = joblib.load(MODEL_PATH)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to load model")

    try:
        df = pd.read_csv(file.file, comment="#", skip_blank_lines=True)
    except Exception:
         raise HTTPException(status_code=400, detail="Unable to read CSV")

    # Validate columns
    required_cols = ["Timestamp", "UserID", "Amount", "City", "Category"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

    try:
        preds = pipeline.predict(df)
        probs = pipeline.predict_proba(df)
        classes = pipeline.classes_
        normal_idx = list(classes).index(0) if 0 in classes else -1
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")

    fe = FeatureEngineer()
    features_df = fe.fit_transform(df)

    new_txns = []
    for i, pred in enumerate(preds):
        if normal_idx != -1:
            safe_prob = float(probs[i][normal_idx])
        else:
            safe_prob = 0.0
            
        risk = round((1.0 - safe_prob) * 100.0, 2)
        amount = float(df.iloc[i]["Amount"])
        features_row = features_df.iloc[i].to_dict()
        flags = compute_rule_reasons(features_row, amount)
        status = "Suspicious" if flags else "Safe"
        flags_json = json.dumps(flags) if flags else None

        new_txns.append(TransactionModel(
            id=str(uuid.uuid4()),
            timestamp=pd.to_datetime(df.iloc[i]["Timestamp"]).to_pydatetime(),
            amount=amount,
            user_id=str(df.iloc[i]["UserID"]),
            city=str(df.iloc[i]["City"]),
            category=str(df.iloc[i]["Category"]),
            risk_score=int(risk),
            status=status,
            flag_type=flags_json,
            is_training_data=False,
        ))
        
    # Bulk save
    try:
        db.add_all(new_txns)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"success": True, "message": "File processed and transactions stored.", "rowsProcessed": len(new_txns)}
