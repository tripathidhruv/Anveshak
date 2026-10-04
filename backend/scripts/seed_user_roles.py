"""One-off, safely re-runnable: seeds the initial ANVESHAK role assignments this feature needs.
Run: backend/.venv/Scripts/python.exe scripts/seed_user_roles.py (from backend/)."""
from __future__ import annotations

import sys
from pathlib import Path

# Allow running this script directly, same as calibrate.py's own sys.path bootstrap.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.db import SessionLocal, Base, engine  # noqa: E402
from app.models import UserRole, VaspSubscriber  # noqa: E402

SEED_ROLES = [
    ("dhruv@carvelle.in", "officer", None),
    ("cntcitachi@gmail.com", "exchange", "Demo Exchange"),  # linked by subscriber name lookup below
    ("tripathidhruv2704@gmail.com", "citizen", None),
]

def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for email, role, subscriber_name in SEED_ROLES:
            normalized = email.strip().lower()
            existing = db.query(UserRole).filter(UserRole.email == normalized).one_or_none()
            if existing is not None:
                print(f"skip (already seeded): {normalized} -> {existing.role}")
                continue
            linked_id = None
            if subscriber_name:
                subscriber = db.query(VaspSubscriber).filter(VaspSubscriber.name == subscriber_name).one_or_none()
                linked_id = subscriber.id if subscriber else None
            db.add(UserRole(email=normalized, role=role, linked_subscriber_id=linked_id))
            print(f"seeded: {normalized} -> {role}" + (f" (linked subscriber {linked_id})" if linked_id else ""))
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    main()
