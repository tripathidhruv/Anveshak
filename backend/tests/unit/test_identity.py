import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.models import UserRole
from app.auth.identity import resolve_role, require_role
from app.auth.jwt import OfficerClaims

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

def test_resolve_role_returns_seeded_role(db_session):
    db_session.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db_session.commit()
    assert resolve_role(db_session, "dhruv@carvelle.in") == "officer"

def test_resolve_role_auto_creates_citizen_for_unknown_email(db_session):
    role = resolve_role(db_session, "brand-new-citizen@example.com")
    assert role == "citizen"
    row = db_session.query(UserRole).filter_by(email="brand-new-citizen@example.com").one()
    assert row.role == "citizen"

def test_resolve_role_is_case_insensitive_and_idempotent(db_session):
    first = resolve_role(db_session, "Mixed.Case@Example.com")
    second = resolve_role(db_session, "mixed.case@example.com")
    assert first == second == "citizen"
    assert db_session.query(UserRole).count() == 1

def test_require_role_allows_matching_role(db_session):
    db_session.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db_session.commit()
    dep = require_role("officer")
    claims = OfficerClaims(user_id="u1", tenant_id="t1", email="dhruv@carvelle.in")
    identity = dep(claims=claims, db=db_session)
    assert identity.role == "officer"
    assert identity.email == "dhruv@carvelle.in"

def test_require_role_rejects_non_matching_role(db_session):
    db_session.add(UserRole(email="cntcitachi@gmail.com", role="exchange"))
    db_session.commit()
    dep = require_role("officer")
    claims = OfficerClaims(user_id="u2", tenant_id="t1", email="cntcitachi@gmail.com")
    with pytest.raises(HTTPException) as exc_info:
        dep(claims=claims, db=db_session)
    assert exc_info.value.status_code == 403

def test_require_role_rejects_when_email_missing_from_token(db_session):
    dep = require_role("officer")
    claims = OfficerClaims(user_id="u3", tenant_id="t1", email=None)
    with pytest.raises(HTTPException) as exc_info:
        dep(claims=claims, db=db_session)
    assert exc_info.value.status_code == 401
