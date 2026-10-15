from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import settings
from urllib.parse import urlparse

# Validate database URL
_allowed_schemes = {"sqlite", "postgresql", "mysql"}
_parsed = urlparse(settings.database_url)
if _parsed.scheme not in _allowed_schemes:
    raise ValueError(f"Unsupported database scheme: {_parsed.scheme}")
if _parsed.scheme == "sqlite":
    # Disallow path traversal
    if ".." in _parsed.path:
        raise ValueError("Invalid SQLite database path")
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
