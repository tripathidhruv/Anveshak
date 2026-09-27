from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KAIZEN_", extra="ignore")

    database_url: str = "sqlite:///./kaizen.db"
    trongrid_api_key: str | None = None
    etherscan_api_key: str | None = None
    openai_api_key: str | None = None
    max_trace_hops: int = 6
    http_timeout_seconds: float = 10.0
    http_min_interval_seconds: float = 0.34  # ~3 req/s per host, safe for free tiers

settings = Settings()
