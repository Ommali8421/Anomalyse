from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Boolean, DateTime
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))  # 'analyst' | 'admin'

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    amount: Mapped[float] = mapped_column(Float)
    user_id: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(255))
    risk_score: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))  # 'Safe' | 'Suspicious' | 'Review'
    flag_type: Mapped[str] = mapped_column(String(1000), nullable=True) # JSON or string
    flag_reason: Mapped[str] = mapped_column(String(1000), nullable=True)
    is_training_data: Mapped[bool] = mapped_column(Boolean, default=False)
