from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.api.v1 import issues, indicators, data_points, data, mapping, raw_data, auth
from app.api.v1 import outliers, evidence, finalization, dashboard, audit, report

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
app.include_router(data.router,        prefix="/api/v1/data",        tags=["Data"],        dependencies=[Depends(get_current_user)])
app.include_router(data_points.router, prefix="/api/v1/data-points", tags=["DataPoints"],  dependencies=[Depends(get_current_user)])
app.include_router(mapping.router,     prefix="/api/v1/mapping",     tags=["Mapping"],     dependencies=[Depends(get_current_user)])
app.include_router(raw_data.router,    prefix="/api/v1/raw-data",    tags=["RawData"],     dependencies=[Depends(get_current_user)])

# auth는 공개 (로그인/회원가입)
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])

# EDM 파이프라인 라우터
app.include_router(outliers.router,     prefix="/api/v1/outliers",     tags=["Outliers"],     dependencies=[Depends(get_current_user)])
app.include_router(evidence.router,     prefix="/api/v1/evidence",     tags=["Evidence"],     dependencies=[Depends(get_current_user)])
app.include_router(finalization.router, prefix="/api/v1/finalization", tags=["Finalization"], dependencies=[Depends(get_current_user)])
app.include_router(dashboard.router,    prefix="/api/v1/dashboard",    tags=["Dashboard"],    dependencies=[Depends(get_current_user)])
app.include_router(audit.router,        prefix="/api/v1/audit",        tags=["Audit"],        dependencies=[Depends(get_current_user)])

# 보고서 생성 라우터
app.include_router(report.router,       prefix="/api/v1/report",       tags=["Report"],       dependencies=[Depends(get_current_user)])

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "env": settings.app_env}