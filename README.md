# ESG 보고서 자동화 시스템

>```
| 프로젝트 목표  | SR보고서 작성 자동화                            |
| ----------   | -------------------------------------------- |
| 프로젝트 기간  | 2026.01.26 ~ 2026.03.27                      |
| 프로젝트 기간  | 2026.01.26 ~ 2026.03.27                      |
```

---

## 1. 기술 스택

| 구분 | 기술 |
|------|------|
| **Backend** | FastAPI 0.115, Python 3.12+ |
| **Frontend** | React 18.2, Vite 5.0 |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **인증** | Supabase Auth (JWT) |
| **AI** | OpenAI GPT-4o / GPT-4o-mini |
| **OCR** | Upstage Document AI |
| **벡터 검색** | pgvector (임베딩 기반 유사도 매칭) |
| **보고서 출력** | ReportLab (PDF), python-docx (DOCX), LibreOffice (HWP) |
| **이메일** | SMTP (선택) |

---

## 2. 전체 파일 구조

```
final_pjt/
│
├── app/                                   # FastAPI 백엔드 메인
│   ├── main.py                            # 앱 진입점, CORS, 라우터 등록
│   ├── requirements.txt                   # Python 의존성
│   │
│   ├── api/v1/                            # REST API 라우터
│   │   ├── auth.py                        # 회원가입 / 로그인 / 로그아웃
│   │   ├── issues.py                      # ESG 이슈 CRUD
│   │   ├── indicators.py                  # GRI 지표 CRUD
│   │   ├── data.py                        # 데이터 그룹 CRUD
│   │   ├── data_points.py                 # 데이터 포인트 + 동의어 CRUD
│   │   ├── sites.py                       # 사업장 목록 조회
│   │   ├── raw_data.py                    # 원본 데이터 파일 업로드
│   │   ├── mapping.py                     # 데이터 표준화 실행
│   │   ├── outliers.py                    # 이상치 탐지 / AI 진단 / 소명
│   │   ├── evidence.py                    # 증빙 서류 OCR 처리
│   │   ├── finalization.py                # 데이터 최종 확정 / 수정
│   │   ├── dashboard.py                   # 검증 현황 대시보드
│   │   ├── audit.py                       # 감사 이력 조회
│   │   ├── aggregation.py                 # 최종 확정 데이터 집계
│   │   └── report.py                      # 보고서 생성 / 편집 / 출력
│   │
│   ├── core/
│   │   ├── config.py                      # 환경 변수 로딩 (Pydantic Settings)
│   │   ├── auth.py                        # JWT 검증, 현재 사용자 조회
│   │   ├── dependencies.py                # FastAPI 의존성 주입 모음
│   │   └── supabase.py                    # Supabase 클라이언트 싱글턴
│   │
│   ├── schemas/                           # Pydantic 데이터 모델
│   │   ├── common.py                      # APIResponse, PaginatedResponse
│   │   ├── issue.py                       # Issue 스키마
│   │   ├── indicator.py                   # Indicator 스키마
│   │   ├── data.py                        # DataGroup 스키마
│   │   └── data_point.py                  # DataPoint, Synonym 스키마
│   │
│   ├── services/
│   │   ├── supabase_service.py            # 마스터 데이터 서비스 (Issue/Indicator/Data/DataPoint)
│   │   ├── raw_data_service.py            # CSV/XLSX 파싱 및 원본 데이터 저장
│   │   ├── mapping_service.py             # 표준화 매핑 (정확매칭 → 임베딩 유사도 → 단위변환)
│   │   ├── email_service.py               # SMTP 이메일 발송
│   │   │
│   │   ├── outlier_pipeline/              # EDM(이상치 탐지 및 검증) 파이프라인
│   │   │   ├── outlier_detection.py       # L1/L2/L3 이상치 탐지 로직
│   │   │   ├── outlier_llm.py             # GPT-4o 이상치 AI 진단
│   │   │   ├── outlier_management.py      # 사용자 소명 처리 및 상태 전환
│   │   │   ├── ocr_service.py             # Upstage OCR API 호출
│   │   │   ├── evidence_extraction.py     # OCR 결과 구조화 파싱
│   │   │   ├── evidence_verification.py   # 증빙-DB 데이터 차이 검증
│   │   │   ├── data_finalization.py       # 최종 확정 및 원본 복원
│   │   │   ├── verification_dashboard.py  # 검증 현황 집계
│   │   │   ├── audit_trail.py             # 모든 액션 감사 로그 기록
│   │   │   ├── database_utils.py          # DB 공통 유틸
│   │   │   └── file/                      # 내부 기술 문서
│   │   │       ├── EDM_SYSTEM_OVERVIEW.md
│   │   │       ├── EDM_PIPELINE_GUIDE.md
│   │   │       └── HANDOVER.md
│   │   │
│   │   └── report_pipeline/               # 보고서 생성 파이프라인
│   │       ├── esg_report_builder.py      # DB 데이터 → 보고서 JSON 생성
│   │       ├── report_editor.py           # 보고서 초안 편집
│   │       ├── report_exporter.py         # PDF / DOCX / HWP 파일 출력
│   │       ├── framword.json              # 보고서 목차(TOC) 프레임워크
│   │       └── esg_report_output_draft.json  # 생성된 보고서 초안 (런타임 생성)
│   │
│   └── scripts/                           # DB 초기화 및 데이터 생성 스크립트
│       ├── generate_embeddings.py         # data_points 임베딩 생성
│       ├── generate_synonym_embeddings.py # 동의어 임베딩 생성
│       └── insert_test_energy_data.py     # 테스트 에너지 데이터 삽입
│
├── frontend/                              # React 프론트엔드
│   ├── package.json
│   ├── vite.config.js                     # Vite 설정 (API 프록시 포함)
│   └── src/
│       ├── main.jsx                       # React 진입점
│       ├── App.jsx                        # 라우팅 정의 (15개 이상 페이지)
│       │
│       ├── api/                           # 백엔드 API 호출 모듈
│       │   ├── index.js                   # axios 래퍼 (인증 헤더, 에러 처리)
│       │   ├── auth.js                    # 로그인 / 회원가입 / 사용자 정보
│       │   ├── standardData.js            # 표준화 데이터 조회
│       │   ├── outliners.js               # 이상치 탐지 / 소명 / 대시보드
│       │   ├── evidence.js                # 증빙 업로드 / 검증
│       │   ├── finalization.js            # 데이터 확정
│       │   ├── issues.js                  # 이슈 관리
│       │   └── report.js / reportApi.js   # 보고서 생성 / 출력
│       │
│       ├── pages/                         # 화면 페이지 컴포넌트
│       │   ├── Home.jsx                   # 메인 홈
│       │   ├── Login.jsx / SignUp.jsx      # 인증
│       │   ├── MyPage.jsx                 # 사용자 프로필
│       │   ├── Dashboard.jsx              # 메인 대시보드
│       │   ├── Materiality.jsx            # 중요성 평가 이슈 선택
│       │   ├── DataUpload.jsx             # 원본 데이터 업로드
│       │   ├── DataProcess.jsx            # 데이터 처리 현황
│       │   ├── DataInputRequest.jsx       # 데이터 입력 요청
│       │   ├── DataInputUpload.jsx        # 데이터 입력 업로드
│       │   ├── StandardDataView.jsx       # 표준화 데이터 조회
│       │   ├── AnalysisDashboard.jsx      # 검증 현황 대시보드
│       │   ├── AnomalyResult.jsx          # 이상치 탐지 결과
│       │   ├── ConsistencyCheck.jsx       # 일관성 검사 (증빙 검증)
│       │   ├── UnverifiedResult.jsx       # 미검증 데이터 결과
│       │   ├── OutlierVerification.jsx    # 이상치 소명 입력
│       │   ├── DataAggregation.jsx        # 최종 확정 데이터 집계
│       │   ├── Report.jsx                 # 보고서 목록
│       │   ├── ReportGenerate.jsx         # 보고서 생성 실행
│       │   ├── ReportDraft.jsx            # 보고서 초안 편집
│       │   ├── ReportDownload.jsx         # 보고서 출력 (PDF/DOCX/HWP)
│       │   └── Dataviewpage.jsx           # 데이터 상세 조회
│       │
│       └── components/                    # 공통 UI 컴포넌트
│           ├── Navbar.jsx / Sidebar.jsx   # 상단 / 사이드 네비게이션
│           ├── ProtectedRoute.jsx         # 로그인 보호 라우팅
│           ├── ReportTOC.jsx              # 보고서 목차 렌더링
│           ├── ReportView.jsx             # 보고서 내용 렌더링
│           └── MetricChart.jsx            # 지표 차트 컴포넌트
│
├── scripts/                               # 운영 유틸리티 스크립트
│   ├── seed_master_data.py                # 마스터 데이터 초기 삽입
│   ├── seed_e2e_data.py                   # E2E 테스트 데이터 삽입
│   ├── seed_activity_data.py              # 생산량 데이터 삽입
│   ├── clear_operational_data.py          # 운영 테이블 초기화
│   └── diagnose_outlier_lotte.py          # 특정 이상치 디버그
│
├── report_part_back/                      # 보고서 독립 서버 (port 8001)
│   ├── main.py
│   ├── report_exporter.py
│   └── requirements.txt
│
├── .env                                   # 환경 변수 (비공개)
└── requirements.txt                       # Python 의존성
```

---

## 3. 파일 간 연계 구조

### 3-1. 백엔드 계층 구조

```
[HTTP 요청]
    ↓
app/main.py                     ← FastAPI 앱, 라우터 통합
    ↓
app/api/v1/*.py                 ← 엔드포인트 (입력 검증, 응답 포맷)
    ↓
app/services/*.py               ← 비즈니스 로직
    ↓
app/core/supabase.py            ← Supabase DB 클라이언트
    ↓
[Supabase PostgreSQL]
```



### 3-2. 프론트엔드 계층 구조

```
[브라우저]
    ↓
frontend/src/App.jsx            ← React Router (페이지 라우팅)
    ↓
frontend/src/pages/*.jsx        ← 화면 컴포넌트
    ↓
frontend/src/api/*.js           ← API 호출 (axios + 인증 헤더)
    ↓
vite.config.js                  ← /api/* → localhost:8000 프록시
    ↓
[FastAPI 백엔드]
```

### 3-3. 데이터 표준화 매핑 흐름

```
raw_data_service.py
    CSV/XLSX 파싱 (wide → long 포맷 변환)
        ↓
mapping_service.py
    1단계: 정확 매칭  (data_points.name == 컬럼명)
    2단계: 임베딩 유사도 매칭  (pgvector cosine similarity)
    3단계: 단위 변환  (kWh↔MWh, kL↔L, tCO₂↔kgCO₂ 등)
        ↓
standardized_data 테이블  (v_status = 1)
```

### 3-4. 이상치 처리 파이프라인 연계

```
outlier_detection.py
    L1: Z-Score(3σ) + 전년도 대비 변화율(30%)
    L2: 물리적 한계값 (threshold_limits 테이블)
    L3: 강도 편차 (에너지/생산량 비율 변화 > 50%)
        ↓ outlier_results 저장
        ↓ evidence_verification.py 자동 호출
            gap_percent = |DB값 - OCR값| / OCR값 × 100
            v_status 결정 (2 / 3 / 4 / 5)
        ↓ outlier_llm.py
            GPT-4o에 이상치 컨텍스트 전달 → AI 진단문 생성
        ↓ outlier_management.py
            사용자 소명 입력 → audit_trail 기록 → 이메일 발송
        ↓ data_finalization.py
            최종 확정 (v_status = 5) 또는 값 수정
```

### 3-5. 보고서 생성 연계

```
esg_report_builder.py
    framword.json (목차 프레임워크)
        ↓ indicator_id 참조
    indicators 테이블
        ↓ data_id 참조
    data_points 테이블
        ↓ data_point_id 참조
    standardized_data 테이블 (v_status = 5 만 조회)
        ↓ GPT-4o-mini 호출 (항목별 ESG 맥락 설명 생성)
    esg_report_output_draft.json 저장
        ↓
report_editor.py     ← 초안 필드 편집 (context / commentary)
        ↓
report_exporter.py   ← PDF / DOCX / HWP 파일 생성
```

---

## 4. 데이터베이스 구조

### v_status (검증 상태) 흐름

모든 데이터는 `standardized_data` 테이블의 `v_status` 컬럼으로 처리 단계를 추적합니다.

```
0 → Pending          원본 업로드 직후
1 → Standardized     표준화 매핑 완료
2 → PASS + Mismatch  이상치 없음, 증빙과 불일치 (사용자 확인 필요)
3 → FAIL + Match     이상치 있음, 증빙과 일치
4 → FAIL + Mismatch  이상치 있음, 증빙과 불일치 (가장 위험)
5 → Verified         최종 확정 완료 (보고서에 사용되는 데이터)
```

### 주요 테이블 관계

```
issues (ESG 이슈)
  └── indicators (GRI 지표)
        └── data (데이터 그룹)
              └── data_points (개별 지표 항목)
                    └── standardized_data (실측 데이터)
                          ├── outlier_results (이상치 탐지 결과)
                          ├── verification_logs (증빙 검증 결과)
                          ├── justification_logs (사용자 소명)
                          └── audit_trail (전체 변경 이력)

master_sites (사업장 정보)
  └── site_metric_map (OCR 고객번호 ↔ 사업장/지표 매핑)

raw_ocr_data (업로드된 OCR 파일)
  └── evidence_usage (파싱된 청구서 데이터)

threshold_limits (L2 물리적 한계값)
activity_data (월별 생산량, L3 강도 계산용)
```

---

## 5. 실행 단계별 기능 흐름

시스템은 아래 7단계를 순서대로 거치며 ESG 데이터를 검증하고 보고서를 생성합니다.

---

### STEP 1 — 회원가입 / 로그인

**관련 파일**: `app/api/v1/auth.py`, `frontend/src/pages/Login.jsx`

- 회사 이메일로 회원가입
- Supabase Auth 기반 JWT 토큰 발급
- 이후 모든 API 호출에 Bearer 토큰 자동 첨부 (`frontend/src/api/index.js`)

**제공 기능**
- 로그인 / 회원가입 / 로그아웃
- 사용자 프로필 조회 (`/auth/me`)

---

### STEP 2 — 마스터 데이터 설정

**관련 파일**: `app/api/v1/issues.py`, `indicators.py`, `data.py`, `data_points.py`

ESG 보고 기준이 되는 계층 구조를 등록합니다.

```
이슈(Issue) → 지표(Indicator) → 데이터 그룹(Data) → 데이터 포인트(DataPoint)
```

초기 운영 환경에서는 스크립트로 일괄 삽입합니다.

```bash
python scripts/seed_master_data.py
```

**제공 기능**
- GRI 기준 지표 체계 조회 및 관리
- 데이터 포인트별 단위 및 정의 관리
- 동의어(Synonym) 등록 (매핑 매칭 정확도 향상)

---

### STEP 3 — 원본 데이터 업로드 및 표준화

**관련 파일**: `raw_data_service.py`, `mapping_service.py`, `frontend/src/pages/DataUpload.jsx`

**① 파일 업로드**
- CSV 또는 XLSX 파일을 업로드합니다.
- 파일명 규칙: `{source_type}_{source_name}_raw.csv`
- Wide 포맷 → Long 포맷 자동 변환 후 `raw_data` 테이블에 저장

**② 표준화 매핑 (자동 실행)**
- **1단계 정확 매칭**: 컬럼명 = `data_points.name`
- **2단계 임베딩 유사도 매칭**: OpenAI 임베딩 + pgvector cosine similarity
- **3단계 단위 변환**: 등록된 변환 테이블 기준 자동 변환
- 결과: `standardized_data` 테이블 저장 (v_status = 1)

**제공 기능**
- 다양한 형식의 원본 데이터를 GRI 지표 체계에 자동 매핑
- 단위 불일치 데이터 자동 감지 (v_status = 99)

> 임베딩이 없으면 먼저 생성해야 합니다.
> ```bash
> python app/scripts/generate_embeddings.py
> ```

---

### STEP 4 — 이상치 탐지

**관련 파일**: `outlier_detection.py`, `frontend/src/pages/AnomalyResult.jsx`

`POST /api/v1/outliers/detect` 실행 시 3개 레이어로 이상치를 탐지합니다.

| 레이어 | 탐지 방법 | 심각도 |
|--------|----------|--------|
| **L1** | Z-Score(3σ) + 전년도 대비 변화율 30% 초과 | Warning / Major |
| **L2** | 물리적 상한값 초과 (`threshold_limits` 테이블) | Critical |
| **L3** | 에너지 강도 편차 50% 초과 (생산량 대비) | Major |

탐지 후 `evidence_verification.py`가 자동으로 실행되어 v_status를 2~5로 업데이트합니다.

**제공 기능**
- 전 사업장 × 전 지표에 대한 자동 이상치 탐지
- 탐지 결과 목록 조회 및 심각도별 필터링

---

### STEP 5 — 증빙 서류 OCR 처리

**관련 파일**: `ocr_service.py`, `evidence_extraction.py`, `frontend/src/pages/ConsistencyCheck.jsx`

**① 증빙 파일 업로드** (`POST /api/v1/evidence/upload-ocr`)
- 지원 형식: jpg, png, pdf, tiff, heic, webp
- Upstage Document AI OCR로 텍스트 추출

**② 데이터 파싱** (`POST /api/v1/evidence/extract`)
- GPT-4o가 OCR 결과에서 구조화된 데이터 추출
  - 고객번호, 연도, 월, 사용량, 단위
- `evidence_usage` 테이블에 저장

**③ 증빙 검증** (`POST /api/v1/evidence/verify`)
- `site_metric_map`으로 고객번호 → 사업장 매핑
- DB 값과 OCR 값의 오차율(gap_percent) 계산
- v_status 자동 업데이트

**제공 기능**
- 청구서 / 계량서 이미지를 자동으로 DB 데이터와 대조
- 불일치 항목 자동 플래그 처리

---

### STEP 6 — AI 진단 및 사용자 소명

**관련 파일**: `outlier_llm.py`, `outlier_management.py`, `frontend/src/pages/OutlierVerification.jsx`

**① AI 진단** (`POST /api/v1/outliers/analyze`)
- GPT-4o가 이상치 컨텍스트(탐지 레이어, 전년도 값, 증빙 차이 등)를 분석
- `outlier_results.analysis_summary`에 한국어 진단문 저장

**② 사용자 소명** (`POST /api/v1/outliers/{id}/justify`)
- 담당자가 이상치 원인 설명 입력
- action_taken: `정상` → v_status 자동 5로 전환
- action_taken: `수정필요` → 이후 STEP 7에서 값 수정

**③ 확인 요청 이메일** (`POST /api/v1/outliers/{id}/confirm-request`)
- 지정된 담당자에게 검증 요청 이메일 발송 (SMTP)
- 이메일 내용: v_status 배지, 데이터 요약, AI 진단문, 확인 체크리스트

**제공 기능**
- 이상치별 AI 진단 근거 확인
- 소명 내용 입력 및 승인/반려 처리
- 감사(Audit) 이력 자동 기록

---

### STEP 7 — 데이터 최종 확정

**관련 파일**: `data_finalization.py`, `frontend/src/pages/DataAggregation.jsx`

**① 값 수정 및 확정** (`POST /api/v1/finalization/{id}`)
- 원본값 백업 후 수정값 반영
- v_status → 5 (Verified)
- `audit_trail`에 변경 전/후 값 기록

**② 원본 복원** (`POST /api/v1/finalization/{id}/revert`)
- 백업된 `original_value`로 복원
- v_status 이전 상태로 되돌림

**③ 집계 조회** (`GET /api/v1/aggregation/summary`)
- v_status = 5인 데이터만 집계
- 연도별 / 사업장별 / 지표별 합산

**제공 기능**
- 최종 확정된 신뢰 데이터 집계
- 변경 이력 전체 조회 (감사 추적)
- 원본 복원 지원

---

### STEP 8 — 보고서 생성 및 출력

**관련 파일**: `esg_report_builder.py`, `report_editor.py`, `report_exporter.py`
**프론트엔드**: `ReportGenerate.jsx`, `ReportDraft.jsx`, `ReportDownload.jsx`

**① 보고서 생성** (`POST /api/v1/report/generate`)
- `framword.json` 목차 기준으로 v_status=5 데이터 조회
- GPT-4o-mini가 각 지표별 ESG 맥락 설명 자동 생성
- `esg_report_output_draft.json` 저장

**② 초안 편집** (`PATCH /api/v1/report/draft/field`)
- `context`: AI 생성 설명문 수정
- `commentary`: 담당자 코멘트 추가

**③ 보고서 출력** (`POST /api/v1/report/export`)
- `format` 파라미터: `pdf` / `docx` / `hwp`
- PDF: ReportLab (Python 순수 구현)
- DOCX: python-docx (Python 순수 구현)
- HWP: DOCX → LibreOffice 변환 (LibreOffice 설치 필요)

**제공 기능**
- GRI 기준 ESG 보고서 자동 초안 생성
- AI 설명문 편집 및 담당자 코멘트 추가
- PDF / DOCX / HWP 형식 다운로드

---

## 6. API 엔드포인트 목록

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/auth/signup` | 회원가입 |
| POST | `/api/v1/auth/login` | 로그인 |
| POST | `/api/v1/auth/logout` | 로그아웃 |
| GET | `/api/v1/auth/me` | 현재 사용자 정보 |

### 마스터 데이터
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET/POST | `/api/v1/issues` | ESG 이슈 조회 / 생성 |
| GET/POST | `/api/v1/indicators` | GRI 지표 조회 / 생성 |
| GET/POST | `/api/v1/data` | 데이터 그룹 조회 / 생성 |
| POST | `/api/v1/data-points` | 데이터 포인트 조회 |
| POST | `/api/v1/data-points/{id}/synonyms` | 동의어 추가 |
| GET | `/api/v1/sites` | 사업장 목록 |

### 데이터 파이프라인
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/raw-data/upload` | 원본 데이터 업로드 |
| POST | `/api/v1/mapping/run` | 표준화 매핑 실행 |

### 이상치 탐지 및 검증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/outliers/detect` | 이상치 탐지 실행 |
| POST | `/api/v1/outliers/analyze` | AI 진단 실행 |
| GET | `/api/v1/outliers/{id}` | 이상치 상세 조회 |
| POST | `/api/v1/outliers/{id}/justify` | 소명 제출 |
| POST | `/api/v1/outliers/{id}/confirm-request` | 확인 요청 이메일 발송 |
| POST | `/api/v1/evidence/upload-ocr` | 증빙 파일 업로드 |
| POST | `/api/v1/evidence/extract` | OCR 데이터 파싱 |
| POST | `/api/v1/evidence/verify` | 증빙 검증 실행 |

### 확정 및 집계
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/finalization/{id}` | 데이터 최종 확정 |
| POST | `/api/v1/finalization/{id}/revert` | 확정 취소 및 원본 복원 |
| GET | `/api/v1/aggregation/summary` | 확정 데이터 집계 |
| GET | `/api/v1/dashboard` | 검증 현황 대시보드 |
| GET | `/api/v1/audit` | 감사 이력 조회 |

### 보고서
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/report/generate` | 보고서 생성 |
| GET | `/api/v1/report/draft` | 초안 조회 |
| PATCH | `/api/v1/report/draft/field` | 초안 필드 편집 |
| POST | `/api/v1/report/export` | PDF/DOCX/HWP 출력 |

---

## 7. 환경 설정

`.env` 파일에 아래 항목을 설정합니다.

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# OpenAI
OPENAI_API_KEY=sk-...

# Upstage (OCR)
UPSTAGE_API_KEY=up_...

# 앱 설정
APP_ENV=production
CORS_ORIGINS=http://localhost:5173,https://your-domain.com
CONFIDENCE_THRESHOLD=0.7

# SMTP (선택, 이메일 기능 사용 시)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your-password
SMTP_TLS=true
SMTP_FROM_NAME=ESG System
```

---

## 8. 실행 방법

### 백엔드 실행

```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. .env 파일 설정 (위 환경 설정 참조)

# 3. (최초 1회) 마스터 데이터 삽입
python scripts/seed_master_data.py

# 4. (최초 1회) 임베딩 생성 (표준화 매핑 정확도 향상)
python app/scripts/generate_embeddings.py

# 5. 서버 실행 (port 8000)
uvicorn app.main:app --reload --port 8000

# 정상 실행 확인
curl http://localhost:8000/health
# → {"status": "ok", "env": "production"}
```

### 프론트엔드 실행

```bash
cd frontend

# 1. 의존성 설치
npm install

# 2. 개발 서버 실행 (port 5173, API는 8000으로 프록시)
npm run dev

# 3. 프로덕션 빌드
npm run build
```

### HWP 출력 활성화 (선택)

HWP 출력은 LibreOffice 설치가 필요합니다.

```bash
# Ubuntu/Debian
sudo apt-get install libreoffice

# Windows: https://www.libreoffice.org/download/ 에서 설치 후
# 환경 변수 PATH에 LibreOffice 실행 경로 추가
```

LibreOffice가 없으면 HWP 출력 시 오류가 발생하지만, PDF / DOCX 출력은 정상 동작합니다.

---

## 9. 핵심 성과

### 자동화 범위

| 기존 수동 작업 | 시스템 자동화 내용 | 관련 모듈 |
|--------------|-----------------|----------|
| 부서별 Excel 취합 및 단위 통일 | CSV/XLSX 업로드 즉시 GRI 지표로 자동 매핑·단위 변환 | `mapping_service.py` |
| 이상값 육안 검토 | 통계(Z-Score) + 물리 한계 + 강도 편차 3단계 자동 탐지 | `outlier_detection.py` |
| 청구서 수기 대조 | Upstage OCR + GPT-4o 구조화 파싱 → DB 값 자동 대조 | `ocr_service.py`, `evidence_verification.py` |
| 이상값 원인 분석 작성 | GPT-4o가 탐지 근거·전년도 비교·증빙 차이를 종합한 한국어 진단문 자동 생성 | `outlier_llm.py` |
| 보고서 초안 작성 | GRI 목차 기준으로 지표 데이터 + AI 설명문 자동 구성 | `esg_report_builder.py` |
| 보고서 파일 변환 | PDF / DOCX / HWP 원클릭 출력 | `report_exporter.py` |

### 데이터 신뢰성 확보 체계

```
원본 데이터 입력
    ↓
[표준화] 정확 매칭 → AI 임베딩 유사도 매칭 → 단위 변환
    ↓
[이상치 탐지] L1 통계적 이상 / L2 물리적 한계 / L3 강도 편차
    ↓
[증빙 대조] OCR 자동 추출 → gap_percent 계산 → v_status 자동 분류
    ↓
[AI 진단] 탐지 레이어별 원인 분석 + 담당자 소명 워크플로우
    ↓
[감사 추적] 모든 변경 이력 before/after 기록 (audit_trail)
    ↓
v_status = 5 (Verified) 데이터만 보고서에 반영
```

### 기술적 구현 포인트

- **임베딩 기반 매핑**: OpenAI 임베딩 + pgvector cosine similarity로 표현이 다른 지표명도 자동 연결
- **다층 이상치 탐지**: 통계·도메인·생산성 세 관점을 동시에 적용, 탐지 누락 최소화
- **v_status 상태 머신**: 0→1→2/3/4/5의 단방향 상태 흐름으로 데이터 처리 단계를 명확히 관리
- **완전한 감사 추적**: 값 수정·확정·복원 전 단계에서 before/after를 기록해 외부 감사 대응 가능
- **3중 보고서 출력**: ReportLab(PDF), python-docx(DOCX), LibreOffice 변환(HWP) 국내 표준 형식 모두 지원
- **Graceful Degradation**: SMTP 미설정·LibreOffice 미설치 시 해당 기능만 비활성화, 나머지 기능 정상 동작
