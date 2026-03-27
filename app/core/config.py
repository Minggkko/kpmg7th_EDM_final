from pydantic_settings import BaseSettings
from functools import lru_cache
import os


# config.py 위치 기준 프로젝트 루트 (backend_v2/)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _load_env(filename: str) -> None:
    """지정된 env 파일을 읽어 os.environ에 주입. 절대경로로 처리."""
    path = os.path.join(_BASE_DIR, filename)
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                os.environ[k] = v  # 항상 덮어씀 (env 파일이 OS 변수보다 우선)
    except FileNotFoundError:
        pass


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    supabase_jwt_secret: str

    # OpenAI
    openai_api_key: str

    # Upstage
    upstage_api_key: str

    # App
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"
    confidence_threshold: float = 0.85

    # SMTP (이메일 발송용, 미설정 시 이메일 미발송)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = True
    smtp_from_name: str = "ESG Report System"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "").strip()  # trailing space 방지
    env_file = ".env.test" if app_env == "test" else ".env"
    _load_env(env_file)
    return Settings()
