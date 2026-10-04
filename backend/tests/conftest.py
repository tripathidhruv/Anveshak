import os

# Must run before anything imports app.config: a test run never seeds demo rows into the real
# kaizen.db at app startup (tests seed their own in-memory databases explicitly).
os.environ.setdefault("KAIZEN_SEED_DEMO_MEMORY", "false")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base

@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
