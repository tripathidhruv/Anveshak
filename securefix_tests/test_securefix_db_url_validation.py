import os, sys, types, importlib
import pytest

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def test_database_url_is_validated(monkeypatch):
    """Importing ``backend.app.db`` must reject an unsafe SQLite URL.

    The current vulnerable code accepts any ``sqlite:///`` path, so the import
    succeeds. A proper fix should raise a ``ValueError`` (or similar) before
    calling ``sqlalchemy.create_engine``.
    """
    # Malicious payload – tries to point to a sensitive file via a relative path
    malicious_url = "sqlite:///../../../../etc/passwd"
    monkeypatch.setenv("DATABASE_URL", malicious_url)

    # Provide a stub ``sqlalchemy`` module so the import does not require the real package
    dummy_sqlalchemy = types.SimpleNamespace()
    def dummy_create_engine(url, **kwargs):
        # Record that it was called – the test expects this *not* to happen for unsafe URLs
        dummy_create_engine.called = True
        dummy_create_engine.url = url
        return object()
    dummy_sqlalchemy.create_engine = dummy_create_engine
    sys.modules["sqlalchemy"] = dummy_sqlalchemy

    # Import the module – a safe implementation should raise before calling create_engine
    with pytest.raises(ValueError, match="Invalid database URL"):
        importlib.import_module("backend.app.db")

    # If no exception was raised, the following assert will fire (i.e., test fails)
    assert False, "backend.app.db did not reject the unsafe DATABASE_URL"
