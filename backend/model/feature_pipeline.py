from pathlib import Path
from typing import Any, Optional
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import joblib
import json

CITY_COORDS = {
    'Mumbai': (19.0760, 72.8777),
    'Delhi': (28.7041, 77.1025),
    'Bangalore': (12.9716, 77.5946),
    'Chennai': (13.0827, 80.2707),
    'Kolkata': (22.5726, 88.3639),
    'Pune': (18.5204, 73.8567),
    'Hyderabad': (17.3850, 78.4867),
    'Ahmedabad': (23.0225, 72.5714)
}

MAX_SPEED_KMH = 1000
MAX_SPEED_KMS = MAX_SPEED_KMH / 3600
WINDOW_SIZE = '30min'

def haversine_distance(coord1, coord2):
    R = 6371
    lat1, lon1 = np.radians(coord1)
    lat2, lon2 = np.radians(coord2)
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c

def _lookback_count(group: pd.DataFrame) -> pd.Series:
    g = group.sort_values('Timestamp')
    idx = g.index
    gi = g.set_index('Timestamp')
    s = gi['Amount'].rolling(WINDOW_SIZE, closed='left').count().fillna(0)
    return pd.Series(s.values, index=idx)

def _category_ratio(group: pd.DataFrame) -> pd.Series:
    g = group.sort_values('Timestamp').copy()
    cum = pd.Series(range(len(g)), index=g.index).shift(1).fillna(0)
    g['Count'] = range(len(g))
    g['Category_Count'] = g.groupby('Category')['Count'].cumcount()
    g['Past_Category_Count'] = g['Category_Count'].shift(1).fillna(0)
    eps = 1e-6
    return g['Past_Category_Count'] / (cum + eps)

class FeatureEngineer(BaseEstimator, TransformerMixin):
    def __init__(self):
        self._numeric_features = [
            'Amount',
            'User_Mean_Amount',
            'User_Std_Amount',
            'Time_Since_Last_TXN_Sec',
            'Time_Since_Last_TXN_Hrs',
            'Amount_Z_Score',
            'Geo_Velocity_Check',
            'Txn_Count_30_Min',
            'Category_Usage_Score'
        ]
        self._categorical_features = ['City', 'Category']

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> 'FeatureEngineer':
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        df = X.copy()
        if not pd.api.types.is_datetime64_any_dtype(df['Timestamp']):
            df['Timestamp'] = pd.to_datetime(df['Timestamp'])
        df = df.sort_values(['UserID', 'Timestamp'])
        stats = df.groupby('UserID')['Amount'].agg(['mean', 'std']).reset_index()
        stats.columns = ['UserID', 'User_Mean_Amount', 'User_Std_Amount']
        df = df.merge(stats, on='UserID', how='left')
        df['User_Std_Amount'] = df['User_Std_Amount'].fillna(0)
        eps = 1e-6
        df['Amount_Z_Score'] = (df['Amount'] - df['User_Mean_Amount']) / (df['User_Std_Amount'] + eps)
        df['Prev_Timestamp'] = df.groupby('UserID')['Timestamp'].shift(1)
        df['Time_Since_Last_TXN_Sec'] = (df['Timestamp'] - df['Prev_Timestamp']).dt.total_seconds().fillna(0)
        df['Time_Since_Last_TXN_Hrs'] = df['Time_Since_Last_TXN_Sec'] / 3600
        df['Prev_City'] = df.groupby('UserID')['City'].shift(1)
        df['Prev_City'] = df['Prev_City'].fillna(df['City'])
        def _dist_row(row):
            c1 = CITY_COORDS.get(row['Prev_City'], (0, 0))
            c2 = CITY_COORDS.get(row['City'], (0, 0))
            if c1 == (0, 0) or c2 == (0, 0):
                return 0.0
            return haversine_distance(c1, c2)
        df['Distance_Km'] = df.apply(_dist_row, axis=1)
        df['Min_Travel_Time_Sec'] = df['Distance_Km'] / MAX_SPEED_KMS
        df['Geo_Velocity_Check'] = df['Min_Travel_Time_Sec'] / (df['Time_Since_Last_TXN_Sec'] + eps)
        counts = df.groupby('UserID', group_keys=False)[['Timestamp', 'Amount']].apply(_lookback_count)
        if isinstance(counts, pd.DataFrame):
            counts = counts.iloc[:, 0]
        df['Txn_Count_30_Min'] = counts
        df['Txn_Count_30_Min'] = df['Txn_Count_30_Min'].astype(float).fillna(0).astype(int)
        cat = df.groupby('UserID', group_keys=False)[['Timestamp', 'Category']].apply(_category_ratio)
        if isinstance(cat, pd.DataFrame):
            cat = cat.iloc[:, 0]
        df['Category_Usage_Score'] = cat
        df['Category_Usage_Score'] = df['Category_Usage_Score'].clip(upper=1.0)
        cols = self._numeric_features + self._categorical_features
        return df[cols].copy()

def build_pipeline() -> Pipeline:
    numeric = [
        'Amount',
        'User_Mean_Amount',
        'User_Std_Amount',
        'Time_Since_Last_TXN_Sec',
        'Time_Since_Last_TXN_Hrs',
        'Amount_Z_Score',
        'Geo_Velocity_Check',
        'Txn_Count_30_Min',
        'Category_Usage_Score'
    ]
    categorical = ['City', 'Category']
    pre = ColumnTransformer(
        transformers=[
            ('num', Pipeline(steps=[('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler())]), numeric),
            ('cat', Pipeline(steps=[('imputer', SimpleImputer(strategy='most_frequent')), ('onehot', OneHotEncoder(handle_unknown='ignore'))]), categorical)
        ],
        remainder='drop'
    )
    clf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    pipe = Pipeline(steps=[('features', FeatureEngineer()), ('preprocess', pre), ('clf', clf)])
    return pipe

def train_and_export(input_csv: Path, output_pkl: Path) -> dict:
    df = pd.read_csv(input_csv)
    req = ['Timestamp', 'UserID', 'Amount', 'City', 'Category', 'Fraud_Type']
    missing = [c for c in req if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    X = df[['Timestamp', 'UserID', 'Amount', 'City', 'Category']].copy()
    y = df['Fraud_Type'].copy()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)
    joblib.dump(pipe, output_pkl)
    return {'samples_train': len(X_train), 'samples_test': len(X_test), 'model_path': str(output_pkl)}

if __name__ == "__main__":
    base = Path(__file__).parent.parent
    inp = base / "dummy_train.csv"
    out = Path(__file__).parent / "model.pkl"
    info = train_and_export(inp, out)
    print(json.dumps(info))
