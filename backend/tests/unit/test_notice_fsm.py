import pytest

from app.legal import notice_fsm


@pytest.fixture(autouse=True)
def _isolated_store():
    notice_fsm.reset_store()
    yield
    notice_fsm.reset_store()


def test_new_notice_starts_in_draft():
    notice = notice_fsm.create_notice(case_id="C1", citation_id="bnss_94", body="draft text")
    assert notice.state == notice_fsm.NoticeState.DRAFT


def test_send_rejects_an_unapproved_draft_notice():
    notice = notice_fsm.create_notice(case_id="C1", citation_id="bnss_94", body="draft text")
    with pytest.raises(notice_fsm.InvalidNoticeTransitionError):
        notice_fsm.send(notice.id)
    # state is unchanged -- the rejected transition must not have side effects
    assert notice_fsm.get_notice(notice.id).state == notice_fsm.NoticeState.DRAFT


def test_approve_then_send_succeeds():
    notice = notice_fsm.create_notice(case_id="C1", citation_id="bnss_94", body="draft text")
    approved = notice_fsm.approve(notice.id, approved_by="Officer Rao")
    assert approved.state == notice_fsm.NoticeState.APPROVED
    assert approved.approved_by == "Officer Rao"
    sent = notice_fsm.send(notice.id)
    assert sent.state == notice_fsm.NoticeState.SENT
    assert sent.sent_at is not None


def test_cannot_send_twice():
    notice = notice_fsm.create_notice(case_id="C1", citation_id="bnss_94", body="draft text")
    notice_fsm.approve(notice.id, approved_by="Officer Rao")
    notice_fsm.send(notice.id)
    with pytest.raises(notice_fsm.InvalidNoticeTransitionError):
        notice_fsm.send(notice.id)


def test_rejected_notice_cannot_later_be_sent():
    notice = notice_fsm.create_notice(case_id="C1", citation_id="bnss_94", body="draft text")
    notice_fsm.reject(notice.id, reason="wrong exchange")
    assert notice_fsm.get_notice(notice.id).state == notice_fsm.NoticeState.REJECTED
    with pytest.raises(notice_fsm.InvalidNoticeTransitionError):
        notice_fsm.approve(notice.id, approved_by="Officer Rao")
    with pytest.raises(notice_fsm.InvalidNoticeTransitionError):
        notice_fsm.send(notice.id)


def test_get_unknown_notice_raises_not_found():
    with pytest.raises(notice_fsm.NoticeNotFoundError):
        notice_fsm.get_notice("does-not-exist")


def test_list_notices_for_case_filters_by_case_id():
    a = notice_fsm.create_notice(case_id="C1", citation_id="bnss_94", body="a")
    notice_fsm.create_notice(case_id="C2", citation_id="bns_223", body="b")
    result = notice_fsm.list_notices_for_case("C1")
    assert [n.id for n in result] == [a.id]
