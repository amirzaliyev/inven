from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # application
    debug: bool = True
    master_admin_username: str
    master_admin_password: str

    # database
    database_url: PostgresDsn
    database_url_sync: PostgresDsn

    # security
    jwt_secret_key: str
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = ""
    jwt_audience: str = ""


settings = Settings()  # pyright: ignore[reportCallIssue]
