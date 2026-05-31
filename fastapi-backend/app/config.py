from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FastAPI CRM Backend"
    app_version: str = "0.1.0"
    environment: str = Field("development", env="ENVIRONMENT")
    database_url: str = Field("sqlite:///./dev.db", env="DATABASE_URL")
    frappe_database_url: str = Field("mysql+pymysql://root:password@localhost/frappe_db", env="FRAPPE_DATABASE_URL")
    redis_url: str = Field("redis://127.0.0.1:11000", env="REDIS_URL")
    jwt_secret_key: str = Field(..., env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(60, env="ACCESS_TOKEN_EXPIRE_MINUTES")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra='ignore')


settings = Settings()
