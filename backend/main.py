from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from pathlib import Path
import uuid
import joblib
import pandas as pd
import json
from datetime import datetime
from sqlalchemy import select, func, text, case, delete, inspect
from sqlalchemy.orm import Session

from config import settings
from database import engine, SessionLocal
from models import Base, User, Transaction as TransactionModel
from auth_utils import hash_password, verify_password, create_access_token, decode_token
from model.preprocessing import preprocess_data

app = FastAPI(title="Anomalyse Backend", version="0.3.0")

# CORS: allow frontend on Vite default port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "model" / "pipeline.pkl"
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
    riskScore: float
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
    rows = db.scalars(select(TransactionModel).order_by(TransactionModel.timestamp.desc())).all()
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
            riskScore=float(r.risk_score),
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
    avg_risk = db.scalar(select(func.avg(TransactionModel.risk_score))) or 0

    rows = db.execute(
        select(
            func.date(TransactionModel.timestamp).label("date"),
            func.sum(case((TransactionModel.status == "Suspicious", 1), else_=0)).label("fraudCount"),
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
    
    # Process
    try:
        df_processed = preprocess_data(df)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")

    # Get the last row (our current transaction)
    last_row = df_processed.iloc[[-1]]
    
    try:
        # Predict
        pred = pipeline.predict(last_row)[0]
        probs = pipeline.predict_proba(last_row)[0]
        
        classes = pipeline.classes_
        if 0 in classes:
            normal_idx = list(classes).index(0)
            fraud_prob = 1.0 - probs[normal_idx]
        else:
            fraud_prob = 1.0
            
        risk_score = fraud_prob * 100
        is_fraud = pred != 0
        status = "Suspicious" if is_fraud else "Safe"
        
        return PredictionResponse(
            is_fraud=bool(is_fraud),
            risk_score=float(risk_score),
            status=status
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

    # Process data
    try:
        # We ensure Fraud_Type exists for preprocessing compatibility if needed, 
        # though preprocess_data doesn't use it for feature calc.
        if "Fraud_Type" not in df.columns:
            df["Fraud_Type"] = 0
            
        df_processed = preprocess_data(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")

    try:
        preds = pipeline.predict(df_processed)
        probs = pipeline.predict_proba(df_processed)
        classes = pipeline.classes_
        normal_idx = list(classes).index(0) if 0 in classes else -1
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")

    new_txns = []
    for i, pred in enumerate(preds):
        if normal_idx != -1:
            fraud_prob = 1.0 - probs[i][normal_idx]
        else:
            fraud_prob = 1.0
            
        risk = fraud_prob * 100
        status = "Suspicious" if pred != 0 else "Safe"

        new_txns.append(TransactionModel(
            id=str(uuid.uuid4()),
            timestamp=pd.to_datetime(df.iloc[i]["Timestamp"]).to_pydatetime(),
            amount=float(df.iloc[i]["Amount"]),
            user_id=str(df.iloc[i]["UserID"]),
            city=str(df.iloc[i]["City"]),
            category=str(df.iloc[i]["Category"]),
            risk_score=int(risk),
            status=status,
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
