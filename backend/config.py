from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = None
    JWT_SECRET: str = "super-secret-key-change-me"
    JWT_ALGORITHM: str = "HS256"

    def db_url(self) -> str:
        # Prefer MySQL if provided; fallback to local SQLite
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return "sqlite:///anomalyse.db"

settings = Settings()