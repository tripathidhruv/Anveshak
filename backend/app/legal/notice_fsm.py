"""Draft -> approve -> send state machine for generated legal notices.

Honesty note (per task brief): this backend has NO auth/role system at all yet -- there is
no User model, no login, no session/token middleware anywhere in `app/`. So this is
deliberately NOT a real permission check ("is this person actually an approving officer?").
It is the simplest state machine that still enforces the one hard invariant the project
needs today: a notice can never be sent without first being explicitly marked approved by
*someone*, identified only by a free-text name/id string. Wiring this to real officer
identities is future work once an auth system exists (see docs/TASKS.md).

Storage is an in-memory dict, not a DB table. H0's scaffolding pass did not add a
LegalNotice model to `app/models.py`, and this task's file scope is restricted to
`app/legal/` + `app/api/v1/legal.py` -- it must not touch `models.py`/`schemas.py`. In-memory
storage means notices do not survive a process restart; that's an acceptable limitation for
the current demo/hackathon phase and is called out here rather than silently pretending this
is durable storage.
"""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class NoticeState(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    SENT = "sent"
    REJECTED = "rejected"


ALLOWED_TRANSITIONS: dict[NoticeState, set[NoticeState]] = {
    NoticeState.DRAFT: {NoticeState.APPROVED, NoticeState.REJECTED},
    NoticeState.APPROVED: {NoticeState.SENT, NoticeState.REJECTED},
    NoticeState.SENT: set(),
    NoticeState.REJECTED: set(),
}


class NoticeNotFoundError(KeyError):
    pass


class InvalidNoticeTransitionError(Exception):
    def __init__(self, current_state: NoticeState, action: str):
        self.current_state = current_state
        self.action = action
        super().__init__(
            f"cannot {action} a notice in state '{current_state.value}'"
        )


@dataclass
class LegalNotice:
    id: str
    case_id: str
    citation_id: str
    body: str
    state: NoticeState = NoticeState.DRAFT
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    approved_by: str | None = None
    approved_at: datetime | None = None
    rejected_reason: str | None = None
    sent_at: datetime | None = None


# Module-level in-memory store -- see docstring above for why.
_NOTICES: dict[str, LegalNotice] = {}


def reset_store() -> None:
    """Test-only helper to isolate store state between test cases."""
    _NOTICES.clear()


def create_notice(case_id: str, citation_id: str, body: str) -> LegalNotice:
    notice = LegalNotice(id=str(uuid.uuid4()), case_id=case_id, citation_id=citation_id, body=body)
    _NOTICES[notice.id] = notice
    return notice


def get_notice(notice_id: str) -> LegalNotice:
    notice = _NOTICES.get(notice_id)
    if notice is None:
        raise NoticeNotFoundError(notice_id)
    return notice


def list_notices_for_case(case_id: str) -> list[LegalNotice]:
    return [n for n in _NOTICES.values() if n.case_id == case_id]


def _transition(notice: LegalNotice, target: NoticeState, action: str) -> None:
    if target not in ALLOWED_TRANSITIONS[notice.state]:
        raise InvalidNoticeTransitionError(notice.state, action)


def approve(notice_id: str, approved_by: str) -> LegalNotice:
    notice = get_notice(notice_id)
    _transition(notice, NoticeState.APPROVED, "approve")
    notice.state = NoticeState.APPROVED
    notice.approved_by = approved_by
    notice.approved_at = datetime.now(timezone.utc)
    return notice


def reject(notice_id: str, reason: str | None = None) -> LegalNotice:
    notice = get_notice(notice_id)
    _transition(notice, NoticeState.REJECTED, "reject")
    notice.state = NoticeState.REJECTED
    notice.rejected_reason = reason
    return notice


def send(notice_id: str) -> LegalNotice:
    """Mark a notice sent. Raises InvalidNoticeTransitionError unless the notice is
    currently APPROVED -- this is the hard invariant: a notice can never be auto-sent
    straight from draft."""
    notice = get_notice(notice_id)
    _transition(notice, NoticeState.SENT, "send")
    notice.state = NoticeState.SENT
    notice.sent_at = datetime.now(timezone.utc)
    return notice
