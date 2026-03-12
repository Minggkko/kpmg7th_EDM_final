from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.api.v1 import issues, indicators, data_points, mapping, raw_data, auth

settings = get_settings()

security = HTTPBearer()

app = FastAPI(
    title="ESG Reporting API",
    description="GRI 기반 ESG 데이터 매핑 백엔드",
    version="1.0.0",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록 - auth 제외 전부 토큰 보호
app.include_router(issues.router,      prefix="/api/v1/issues",      tags=["Issues"],      dependencies=[Depends(get_current_user)])
app.include_router(indicators.router,  prefix="/api/v1/indicators",  tags=["Indicators"],  dependencies=[Depends(get_current_user)])
app.include_router(data_points.router, prefix="/api/v1/data-points", tags=["DataPoints"],  dependencies=[Depends(get_current_user)])
app.include_router(mapping.router,     prefix="/api/v1/mapping",     tags=["Mapping"])
app.include_router(raw_data.router,    prefix="/api/v1/raw-data",    tags=["RawData"])

# auth는 공개 (로그인/회원가입)
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "env": settings.app_env}
