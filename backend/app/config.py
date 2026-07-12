from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MoMo FraudLink Uganda"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./fraudlink.db"
    jwt_secret_key: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    protected_reference_secret: str = "development-protected-reference-secret"
    protected_reference_version: str = "v1"
    high_value_transaction_threshold: int = 2_000_000
    simulator_min_interval_seconds: float = 1
    simulator_max_interval_seconds: float = 3
    cors_origins: str = "http://localhost:5173"
    demo_password: str = "FraudLinkDemo2026!"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [value.strip() for value in self.cors_origins.split(",") if value.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

