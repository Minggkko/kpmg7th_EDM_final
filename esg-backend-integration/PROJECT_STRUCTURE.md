# ESG Backend Integration — 프로젝트 구조 및 파일 역할 설명

> **기술 스택**: FastAPI · Supabase (PostgreSQL + pgvector) · OpenAI GPT-4o · LangChain · Upstage Document AI (OCR)
> **서비스 목적**: 지주회사 내부 인터페이스로부터 수신한 ESG 데이터와 증빙 문서(고지서/이미지)를 표준화·검증·이상치탐지·소명처리하는 EDM(ESG Data Management) 백엔드

---

## 전체 디렉토리 구조

```
esg-backend-integration/
├── app/                        ← FastAPI 애플리케이션 본체
│   ├── main.py                 ← 앱 진입점, 라우터 등록
│   ├── api/v1/                 ← REST API 라우터 (11개)
│   ├── core/                   ← 설정·인증·DB 클라이언트
│   ├── services/               ← 비즈니스 로직 서비스
│   │   └── outlier_pipeline/   ← EDM 핵심 파이프라인
│   ├── schemas/                ← Pydantic 요청·응답 스키마
│   ├── scripts/                ← 1회성 임베딩 생성 스크립트
│   └── utils/                  ← 공유 유틸리티 (현재 비어있음)
├── scripts/                    ← DB 초기 시딩 스크립트 (1회성)
├── Preprocessing_file/         ← 테스트용 원본 데이터 파일
├── requirements.txt            ← Python 패키지 의존성
├── env.example                 ← 환경변수 템플릿
├── backup_and_clear.sql        ← 테스트 전 DB 초기화 SQL
└── .env                        ← 실제 환경변수 (커밋 금지)
```

---

## 루트 레벨 파일

### `requirements.txt`
Python 패키지 의존성 목록. 주요 패키지:
- `fastapi`, `uvicorn` — 웹 프레임워크/서버
- `supabase` — Supabase 클라이언트
- `openai`, `langchain-openai` — GPT-4o AI 진단
- `pydantic`, `pydantic-settings` — 데이터 검증·설정 관리
- `python-jose` — JWT 분석
- `pandas`, `openpyxl` — CSV/Excel 파싱

실행 방법: `uvicorn app.main:app --reload --port 8000`

### `env.example`
`.env` 파일 작성을 위한 템플릿. 실제 키 없이 변수명만 명시.
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
SUPABASE_JWT_SECRET=...
OPENAI_API_KEY=...
UPSTAGE_API_KEY=...
```

### `backup_and_clear.sql`
E2E 테스트 실행 전 Supabase SQL Editor에서 직접 실행하는 초기화 스크립트.
`raw_data`, `raw_ocr_data`, `standardized_data` 테이블을 TRUNCATE하여 깨끗한 상태로 만든다.

---

## `scripts/` — DB 초기 시딩 (1회성)

애플리케이션 첫 배포 시 1회만 실행하는 데이터 삽입 스크립트.

### `seed_activity_data.py`
- **역할**: L3 이상치탐지(집약도 기반)에 필요한 기준 데이터 삽입
- **대상 테이블**: `activity_data`(기준년도별 생산량), `master_sites`(사업장 정보)
- **실행**: `python scripts/seed_activity_data.py`

### `seed_threshold_limits.py`
- **역할**: L2 임계값 기반 이상치탐지에 사용할 허용 상한값 삽입
- **대상 테이블**: `threshold_limits`
- **예시 데이터**: 삼성물산 전체 전력 14,000 MWh, 삼성전자 18,000 MWh
- **실행**: `python scripts/seed_threshold_limits.py`

---

## `Preprocessing_file/` — 테스트·개발용 원본 파일

| 파일 | 용도 |
|------|------|
| `계열사_삼성물산_raw.csv` | E2E 테스트용 삼성물산 ESG 원본 데이터 |
| `자회사_삼성전자_raw.csv` | E2E 테스트용 삼성전자 ESG 원본 데이터 |
| `중대성이슈.xlsx` | 중대성 이슈 시딩 참고 데이터 |
| `이슈-지표-데이터포인트.xlsx` | 이슈→지표→데이터포인트 계층 구조 참고 |
| `ocr_test_file/gas_bill.jpg` | OCIR 테스트용 가스 고지서 이미지 |
| `ocr_test_file/electric_bill.jpg` | OCR 테스트용 전기 고지서 이미지 |

---

## `app/` — FastAPI 애플리케이션 본체

### `app/main.py` — 앱 진입점

모든 FastAPI 설정과 라우터 등록을 담당한다.

**주요 역할**:
- FastAPI 앱 인스턴스 생성, Swagger 문서 설정
- CORS 미들웨어 등록 (`.env`의 `CORS_ORIGINS`에서 허용 오리진 로드)
- 11개 라우터 등록 — `auth`를 제외한 전체에 `get_current_user` 토큰 인증 적용

**라우터 등록 현황**:
```
[공개]  GET/POST /api/v1/auth/**         ← 로그인/회원가입
[인증]  /api/v1/issues/**
[인증]  /api/v1/indicators/**
[인증]  /api/v1/data-points/**
[인증]  /api/v1/mapping/**
[인증]  /api/v1/raw-data/**
[인증]  /api/v1/outliers/**
[인증]  /api/v1/evidence/**
[인증]  /api/v1/finalization/**
[인증]  /api/v1/dashboard/**
[인증]  /api/v1/audit/**
```

---

## `app/core/` — 핵심 설정 및 인프라

### `app/core/config.py`
- **역할**: `pydantic-settings`의 `BaseSettings`를 상속한 `Settings` 클래스. `.env` 파일에서 모든 환경변수를 로드하고 타입 검증
- **주요 변수**: `supabase_url`, `supabase_service_key`, `openai_api_key`, `upstage_api_key`, `cors_origins`, `confidence_threshold`
- **사용 방법**: `from app.core.config import get_settings; settings = get_settings()` (`@lru_cache`로 싱글턴 캐시)

### `app/core/supabase.py`
- **역할**: service_role 키를 사용하는 Supabase 클라이언트 생성 및 캐싱
- **함수**: `get_supabase_client()` — `@lru_cache` 적용, 앱 전체에서 단일 인스턴스 공유
- **사용처**: `outlier_pipeline/database_utils.py`, `scripts/` 시딩 스크립트

### `app/core/dependencies.py`
- **역할**: FastAPI `Depends`에 주입하는 현재 사용자 인증 의존성
- **함수**: `get_current_user(token: HTTPAuthorizationCredentials)` — Supabase Auth의 `get_user(token)` 호출 → Supabase `User` 객체 반환
- **사용처**: `main.py` 라우터 등록 시 전체 적용, 각 라우터 개별 엔드포인트에서도 사용

### `app/core/auth.py`
- **역할**: JWT를 로컬에서 직접 HS256 디코딩하여 인증하는 대체 구현
- **반환값**: `{"user_id": ..., "email": ...}` dict (※ `dependencies.py`는 Supabase `User` 객체 반환으로 다름)
- **현황**: 현재 모든 라우터에서 `dependencies.py`의 구현으로 교체 완료. 이 파일은 더 이상 임포트되지 않음 (삭제 가능)

---

## `app/api/v1/` — REST API 라우터

### `auth.py` — 인증
- **엔드포인트**: `GET /check-username/{username}`, `GET /companies`, `POST /signup`, `POST /login`, `POST /logout`, `GET /me`
- **인증 불필요** (로그인·회원가입 자체가 공개)
- **로직**: Supabase Auth `sign_up` / `sign_in_with_password` 직접 호출. 회원가입 시 회사 이메일 도메인 일치 여부 검증, 이메일 즉시 인증 처리

### `issues.py` — 중대성 이슈
- **엔드포인트**: `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`
- **서비스**: `supabase_service.IssueService`
- **스키마**: `IssueCreate`, `IssueResponse`

### `indicators.py` — ESG 지표
- **엔드포인트**: `GET /` (issue_id 필터 가능), `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`
- **서비스**: `supabase_service.IndicatorService`
- **스키마**: `IndicatorCreate`, `IndicatorResponse`

### `data_points.py` — 데이터포인트 및 동의어
- **엔드포인트**: `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/synonyms`, `DELETE /{id}/synonyms/{syn_id}`
- **서비스**: `supabase_service.DataPointService`
- **스키마**: `DataPointCreate`, `DataPointResponse`, `SynonymCreate`, `SynonymResponse`
- **특이사항**: 동의어 등록 시 OpenAI 임베딩 자동 생성 (벡터 유사도 매핑에 활용)

### `raw_data.py` — 원본 데이터 업로드
- **엔드포인트**: `POST /upload`
- **입력**: CSV / XLSX / XLS 파일 (multipart/form-data)
- **파일명 규칙**: `{source_type}_{source_name}_raw.ext` (예: `계열사_삼성물산_raw.csv`)
- **흐름**: 파일 파싱 → `raw_data` 테이블 INSERT → `MappingService.run_mapping()` 자동 호출
- **서비스**: `RawDataService`

### `mapping.py` — 표준화 매핑 재실행
- **엔드포인트**: `POST /run`
- **역할**: `raw_data` → `standardized_data` 변환을 수동으로 재실행할 때 사용
- **서비스**: `MappingService`
- **특이사항**: 일반적으로는 업로드 시 자동 실행되므로 직접 호출은 재처리 용도

### `outliers.py` — 이상치 탐지 및 소명
- **엔드포인트**:
  - `POST /detect` — 이상치 탐지 실행 (증빙 검증까지 자동 포함)
  - `POST /analyze` — GPT-4o AI 진단
  - `POST /{std_id}/justify` — 사용자 소명 제출
  - `GET /{std_id}` — 특정 데이터의 이상치·소명 상세 조회
- **서비스**: `outlier_pipeline.detect_outliers`, `analyze_outlier_with_llm`, `update_outlier_justification`, `get_outlier_detail`

### `evidence.py` — 증빙 문서 OCR 처리
- **엔드포인트**:
  - `POST /upload-ocr` — 고지서 이미지(JPG/PDF) 업로드 + Upstage OCR 실행
  - `POST /extract` — `raw_ocr_data(Pending)` → `evidence_usage` 파싱 추출
  - `POST /verify` — 증빙값과 표준화데이터 간 수동 일치성 재검증
- **서비스**: `ocr_service`, `evidence_extraction`, `evidence_verification`

### `finalization.py` — 최종 데이터 확정
- **엔드포인트**:
  - `POST /{std_id}` — 값 수정(선택) + v_status → 5 확정
  - `POST /{std_id}/revert` — 확정 취소, `original_value` 복원
  - `GET /{std_id}/history` — 해당 데이터의 수정 이력 조회
- **서비스**: `data_finalization`

### `dashboard.py` — 검증 현황 대시보드
- **엔드포인트**:
  - `GET /` — 전체 표준화 데이터 + 이상치/증빙/소명 통합 현황
  - `GET /status-summary` — v_status별 건수 집계
  - `GET /outlier-pending` — 소명 대기 중인 이상치 목록
- **서비스**: `verification_dashboard`

### `audit.py` — 감사 이력
- **엔드포인트**:
  - `GET /` — 전체 감사 로그
  - `GET /summary` — 액션 타입별 집계
  - `GET /{std_id}` — 특정 데이터의 변경 이력
- **서비스**: `audit_trail`

---

## `app/services/` — 서비스 레이어

### `supabase_service.py`
- **역할**: 이슈·지표·데이터포인트의 CRUD 로직을 담은 서비스 클래스 모음
- **클래스**:
  - `IssueService` — `issues` 테이블 CRUD
  - `IndicatorService` — `indicators` 테이블 CRUD
  - `DataPointService` — `data_points` + `data_point_synonyms` 테이블 CRUD
  - `UploadedDataService` — 업로드 데이터 조회 (현재 라우터에서 미사용)

### `raw_data_service.py`
- **역할**: 업로드된 CSV/Excel 파일을 파싱하여 DB에 저장하고 매핑 서비스를 호출
- **주요 로직**:
  1. 파일명에서 `source_type`, `source_name` 추출
  2. wide 형식(컬럼=지표) → long 형식(행=데이터포인트) 변환
  3. `raw_data` 테이블에 INSERT
  4. `MappingService.run_mapping()` 자동 호출

### `mapping_service.py`
- **역할**: `raw_data` → `standardized_data` 변환. 열 이름/값을 표준 데이터포인트로 매핑
- **매핑 방식**:
  1. **정확 매칭**: 데이터포인트명 or 동의어와 100% 일치
  2. **벡터 유사도 매핑**: OpenAI 임베딩 → Supabase pgvector `match_data_point` RPC로 코사인 유사도 탐색 (신뢰도 threshold: 0.85)
- **단위 변환**: 매핑 시 원본 단위 → 표준 단위 자동 변환 (예: `kWh` → `MWh`)

---

## `app/services/outlier_pipeline/` — EDM 핵심 파이프라인

ESG 데이터의 이상치 탐지부터 증빙 검증, 소명 처리, 최종 확정까지의 전체 흐름을 담당한다.

### 데이터 상태값 (v_status)

| 값 | 의미 |
|---|------|
| `0` | raw_data 적재 완료 |
| `1` | 표준화 완료 → 검증 파이프라인 대기 |
| `2` | PASS + 불일치 (이상치 없음, 증빙값과 차이 있음) |
| `3` | FAIL + 일치 (이상치 있음, 증빙값과 일치) |
| `4` | FAIL + 불일치 (이상치 있음, 증빙값과도 차이 있음) |
| `5` | 최종 확정 완료 |

---

### `__init__.py`
파이프라인 패키지의 공개 인터페이스 정의. 각 모듈의 핵심 함수를 `__all__`에 노출하여 API 라우터가 `from app.services.outlier_pipeline import detect_outliers`처럼 간단히 임포트 가능하게 함.

### `database_utils.py`
- **역할**: 파이프라인 내 모든 모듈이 사용하는 Supabase CRUD 래퍼
- **함수**: `fetch_all()`, `fetch_one()`, `insert_record()`, `update_record()`
- **특이사항**: `app/core/supabase.py`의 `get_supabase_client()`를 재노출(re-export)하여 파이프라인 내 의존성 단일화

### `outlier_detection.py` ★
- **역할**: 표준화 데이터에 대한 3단계 이상치 탐지 실행
- **탐지 단계**:
  - **L1 (통계적)**: Z-Score(±3σ) + 전년대비 증감률(YoY 50% 초과) 복합 판단
  - **L2 (절대 임계값)**: `threshold_limits` 테이블의 허용 상한값 초과 여부
  - **L3 (집약도)**: `activity_data` 기준 집약도(단위 생산량당 에너지) 편차 탐지
- **탐지 후 자동 동작**:
  1. 탐지 결과 `outlier_results` 테이블에 저장
  2. `v_status = 1` 설정 (최종 결정은 증빙 검증에 위임)
  3. `verify_evidence_data()` 자동 호출 → v_status 최종 결정

### `outlier_llm.py` ★
- **역할**: GPT-4o(LangChain)를 사용한 이상치 AI 진단 및 `analysis_summary` 업데이트
- **케이스별 분기 프롬프트**:
  - `Case 2` (v_status=2): 이상치 없으나 증빙값 불일치 → 데이터 오류 가능성 분석
  - `Case 3` (v_status=3): 이상치 있고 증빙값 일치 → 실제 이상 소비 분석
  - `Case 4` (v_status=4): 이상치 있고 증빙값 불일치 → 가장 심각, 입력·증빙 모두 오류 가능성
- **단위 오류 경고**: `unit_mismatch=True`인 경우 프롬프트에 `[단위 오류 경고]` 절 추가
- **스킵 조건**: `v_status=5`(이미 확정)인 경우 분석하지 않음

### `outlier_management.py`
- **역할**: ESG 담당자가 제출한 소명(이의제기) 처리
- **주요 로직**:
  - `action_taken`이 `'정상'`인 경우: v_status를 1로 되돌려 재검증 유도
  - 소명 내용을 `justification_logs` 테이블에 INSERT
  - 소명 가능 v_status 범위: 2, 3, 4 (JUSTIFICATION_TARGETS)

### `evidence_extraction.py`
- **역할**: OCR로 읽은 원본 텍스트(`raw_ocr_data`)를 구조화된 `evidence_usage` 레코드로 변환
- **처리 대상**: `status='Pending'`인 `raw_ocr_data` 행
- **처리 후**: 해당 `raw_ocr_data`의 `status` → `'Extracted'`로 업데이트

### `evidence_verification.py` ★
- **역할**: OCR 증빙값(`evidence_usage`)과 표준화데이터(`standardized_data`) 간 일치성 검증 → v_status 최종 결정
- **핵심 로직**:
  - `gap_percent` 계산: `|증빙값 - 표준값| / 표준값 × 100`
  - 일치 기준: `gap_percent == 0.0` (완전 일치만 허용)
  - `_determine_v_status(gap_percent, unit_mismatch, has_outlier)` 3인자 조합으로 v_status 결정
- **result_code**:
  - `0` = 일치 (match)
  - `1` = 불일치 (mismatch)
  - `2` = 단위 오류 (unit_error)
- **결과 저장**: `verification_logs` 테이블에 비교 결과 INSERT

### `data_finalization.py`
- **역할**: 검증·소명 완료 후 데이터 최종 확정 처리
- **주요 함수**:
  - `finalize_usage_data()` — 값 수정(선택적) + v_status → 5
  - `revert_finalization()` — 확정 취소, `original_value`로 복원
  - `get_finalization_history()` — 해당 데이터의 수정 이력 조회
- **안전장치**: 확정 전 `original_value` 컬럼에 이전 값 백업

### `ocr_service.py`
- **역할**: 증빙 문서(고지서 이미지/PDF)를 OCR로 읽어 구조화된 데이터로 변환
- **처리 흐름**:
  1. Upstage Document AI API 호출 → 원본 OCR 텍스트 추출
  2. GPT-4o로 텍스트 구조화 → `{value, unit, period, doc_type}` 형태로 파싱
  3. `raw_ocr_data` 테이블에 INSERT (status='Pending')
- **인증**: `settings.upstage_api_key` 사용 (Bearer 토큰)
- **허용 파일 형식**: `ALLOWED_EXTENSIONS` 상수로 정의 (jpg, jpeg, png, pdf 등)

### `audit_trail.py`
- **역할**: 파이프라인 전체 동작을 `audit_trail` 테이블에 기록하여 데이터 추적성 확보
- **AuditAction 상수**:
  - `UPLOAD` — 데이터 업로드
  - `DETECT` — 이상치 탐지 실행
  - `AI_DIAG` — AI 진단
  - `VERIFY` — 증빙 검증
  - `JUSTIFY` — 소명 처리
  - `FINALIZE` — 최종 확정
  - `REVERT` — 확정 취소
- **함수**: `log_action()`, `get_audit_history()`, `get_audit_logs()`, `get_action_summary()`

### `verification_dashboard.py`
- **역할**: 대시보드용 집계 쿼리 처리
- **함수**:
  - `get_verification_dashboard()` — 표준화 데이터 전체 현황 (이상치/증빙/소명 통합)
  - `get_status_summary()` — v_status별 건수 집계
  - `get_outlier_pending_list()` — 소명 대기 중인 이상치 목록

---

## `app/schemas/` — Pydantic 스키마

### `common.py`
- **역할**: 전체 API에서 공통으로 사용하는 응답 래퍼 스키마
- `APIResponse[T]` — 단건 응답 (`data`, `message`)
- `PaginatedResponse[T]` — 목록 응답 (`data`, `total`)

### `issue.py`
이슈 생성/응답 스키마: `IssueCreate`, `IssueResponse`

### `indicator.py`
지표 생성/응답 스키마: `IndicatorCreate`, `IndicatorResponse`, `IndicatorDetailResponse`

### `data_point.py`
데이터포인트 및 동의어 스키마: `DataPointCreate`, `DataPointResponse`, `SynonymCreate`, `SynonymResponse`

---

## `app/scripts/` — 임베딩 생성 (1회성)

매핑 서비스의 pgvector 유사도 검색을 위해 최초 1회 실행하는 스크립트.

### `generate_embeddings.py`
- `data_points` 테이블의 각 데이터포인트명에 대해 OpenAI 임베딩 생성 → `embedding` 컬럼에 저장

### `generate_synonym_embeddings.py`
- `data_point_synonyms` 테이블의 각 동의어에 대해 OpenAI 임베딩 생성 → `embedding` 컬럼에 저장

---

## 서비스 전체 흐름

```
[지주회사 내부 인터페이스]
        │
        ▼
1. CSV/Excel 업로드 (raw_data.py)
   └─ RawDataService: wide→long 변환, raw_data INSERT
   └─ MappingService: 정확매칭 + 벡터매핑 → standardized_data INSERT
        │
        ▼
2. 증빙 문서 OCR 업로드 (evidence.py)
   └─ ocr_service: Upstage OCR → GPT-4o 구조화 → raw_ocr_data INSERT
   └─ evidence_extraction: raw_ocr_data → evidence_usage
        │
        ▼
3. 이상치 탐지 (outliers.py → /detect)
   └─ outlier_detection: L1(통계) + L2(임계값) + L3(집약도) → outlier_results
   └─ evidence_verification: 증빙값 ↔ 표준화값 비교 → v_status 결정(2/3/4)
        │
        ▼
4. AI 진단 (outliers.py → /analyze)
   └─ outlier_llm: GPT-4o 케이스별 분석 → analysis_summary 업데이트
        │
        ▼
5. 소명 처리 (outliers.py → /{std_id}/justify)
   └─ outlier_management: 소명 내용 justification_logs 저장
        │
        ▼
6. 최종 확정 (finalization.py)
   └─ data_finalization: 값 수정 + v_status → 5
        │
        ▼
[SR 보고서 작성 — 현재 범위 외]
```

---

## DB 주요 테이블

| 테이블 | 역할 |
|--------|------|
| `companies` | 회사 정보 (이메일 도메인 포함) |
| `user_profiles` | 사용자 프로필 (Supabase Auth와 연동) |
| `issues` | 중대성 이슈 |
| `indicators` | ESG 지표 |
| `data_points` | 데이터포인트 (임베딩 벡터 포함) |
| `data_point_synonyms` | 데이터포인트 동의어 (임베딩 벡터 포함) |
| `raw_data` | 원본 업로드 데이터 |
| `standardized_data` | 표준화 변환 데이터 (v_status 관리) |
| `outlier_results` | 이상치 탐지 결과 |
| `raw_ocr_data` | OCR 원본 추출 텍스트 |
| `evidence_usage` | 구조화된 증빙값 |
| `verification_logs` | 증빙 검증 결과 |
| `justification_logs` | 소명 처리 이력 |
| `audit_trail` | 전체 동작 감사 로그 |
| `threshold_limits` | L2 임계값 기준 |
| `activity_data` | L3 집약도 기준 데이터 |
| `master_sites` | 사업장 정보 |
