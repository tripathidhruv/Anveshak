from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # `env_file=".env"` was missing entirely until now -- pydantic-settings does NOT read a
    # .env file automatically without this, so every value in backend/.env (OpenAI key, JWT
    # secret, chain API keys) was silently inert unless separately exported as a real OS
    # environment variable before starting the process. This is exactly the bug a live-test
    # of the officer-login feature surfaced (a valid JWT still 401'd because the running
    # process never actually saw KAIZEN_AUTH_JWT_SECRET). Matches E:/API's own Settings,
    # which already had `env_file=".env"` correctly set from day one.
    model_config = SettingsConfigDict(env_prefix="KAIZEN_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./kaizen.db"
    trongrid_api_key: str | None = None
    etherscan_api_key: str | None = None
    openai_api_key: str | None = None
    # Shared-secret JWT verification for officer login (E:/API's Lighthouse Auth API issues
    # the token; this backend only verifies it, never issues one itself). Must be set to the
    # exact same value as E:/API's own JWT_SECRET or every login silently fails verification.
    auth_jwt_secret: str | None = None
    max_trace_hops: int = 6
    http_timeout_seconds: float = 10.0
    http_min_interval_seconds: float = 0.34  # ~3 req/s per host, safe for free tiers

settings = Settings()
