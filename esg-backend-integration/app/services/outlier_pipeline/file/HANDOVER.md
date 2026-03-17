# ESG 데이터 검증 파이프라인 — 팀원 인계 문서

> **담당자**: 데이터 검증 파트 (이상치 탐지 + 증빙 정합성 검증 통합)
> **작성일**: 2026-03-16

---

## 1. 담당 영역 개요

| 파트 | 담당자 |
|------|--------|
| raw_data 업로드 + 표준화(standardized_data 적재) | **팀원** |
| 데이터 검증 파이프라인 (이상치 탐지 + 증빙 정합성 검증 + AI 진단) | **나** |
| 프론트엔드 | **팀원** |

스택: `FastAPI` + `Supabase(PostgreSQL)` + `OpenAI GPT-4o` + `LangChain`

---

## 2. v_status 정의 (최종 확정)

`standardized_data.v_status` 컬럼의 의미:

| 값 | 의미 | 담당 |
|----|------|------|
| 0 | rawdata 적재 완료 | 팀원 |
| 1 | 표준화 완료 → 검증 파이프라인 시작점 | 팀원 |
| 2 | PASS + 불일치 (이상치 없음, 증빙과 다름) | **나** |
| 3 | FAIL + 일치 (이상치 탐지됨, 증빙과는 같음) | **나** |
| 4 | FAIL + 불일치 (이상치 탐지됨, 증빙과도 다름) | **나** |
| 5 | Verified (최종 확정 완료) | **나** |

DB CHECK 조건: `v_status >= 0 AND v_status <= 5`

---

## 3. 전체 파이프라인 흐름

```
[팀원 담당]
  raw_data 업로드
      ↓
  standardized_data (v_status=0)
      ↓ 표준화 완료 후 v_status=1로 전환 (팀원)

[내 담당 — 아래부터]
  STEP 0-A. OCR 업로드     POST /api/v1/evidence/upload-ocr
                            raw_ocr_data (Pending) 생성

  STEP 0-B. OCR 추출       POST /api/v1/evidence/extract
                            raw_ocr_data (Pending) → evidence_usage
                            raw_ocr_data.processing_status: Pending → Extracted

  STEP 1. 이상치 탐지      POST /api/v1/outliers/detect
                            L1(Z-Score/YoY) + L2(임계치) + L3(원단위 편차)
                            → outlier_results INSERT
                            → v_status: 0→1 (탐지 여부 무관)
                            → 완료 후 STEP 2 자동 호출

  STEP 2. 증빙 검증 (자동) [detect_outliers() 내부에서 자동 호출]
                            evidence_usage ↔ standardized_data 비교
                            → verification_logs INSERT
                            → v_status 최종 결정 (2/3/4/5)
                            → raw_ocr_data.processing_status: Extracted → Success

  STEP 3. AI 진단          POST /api/v1/outliers/analyze
                            v_status=2/3/4인 이상치에 GPT-4o 진단
                            → outlier_results.analysis_summary UPDATE
                            (v_status=5는 자동 스킵)

  STEP 4. 소명 제출        POST /api/v1/outliers/{std_id}/justify
                            사용자 소명 텍스트 입력
                            → justification_logs INSERT

  STEP 5. 최종 확정        POST /api/v1/finalization/{std_id}
                            → standardized_data.value 보정 + v_status=5
```

---

## 4. v_status 결정 조합 규칙

```
outlier = outlier_results에 해당 std_id 레코드 존재 여부
match   = verification_logs.gap_percent == 0.0  (완전 일치만)

not outlier + match     → v_status=5  PASS + 일치  (자동 확정)
not outlier + not match → v_status=2  PASS + 불일치
outlier     + match     → v_status=3  FAIL + 일치
outlier     + not match → v_status=4  FAIL + 불일치
```

### 케이스별 처리 방식

| Case | v_status | 자동 처리 | 사용자 액션 |
|------|----------|-----------|-------------|
| PASS + 일치 | 5 | 자동 확정 | 없음 |
| PASS + 불일치 | 2 | 없음 | [수정/유지] 선택 + 이유 입력 |
| FAIL + 일치 | 3 | 없음 | 수정 금지, 소명 이유 입력 |
| FAIL + 불일치 | 4 | OCR값으로 자동 수정 | 소명 이유 입력 |

---

## 5. 수정된 파일 목록 및 변경 내용

### `app/services/outlier_pipeline/evidence_verification.py` ★ 핵심 수정

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| gap 기준 | `gap_percent >= 1%` 불일치 | `gap_percent != 0.0` 불일치 (완전 일치만 통과) |
| v_status 결정 | evidence 단독으로 결정 | outlier_results + evidence 조합으로 결정 |
| `_determine_v_status` 시그니처 | `(gap_percent, unit_mismatch)` | `(gap_percent, unit_mismatch, has_outlier)` |
| `result_code` 의미 | `new_v_status` 복사 | `0=일치 / 1=불일치 / 2=단위오류` 독립 정의 |
| outlier_results 참조 | 없음 | STEP 3-5에서 std_id 캐시 조회 후 판정 |

### `app/services/outlier_pipeline/outlier_detection.py` ★ 핵심 수정

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 이상치 탐지 후 v_status | 이상치 있으면 `v_status=2` 직접 결정 | 항상 `v_status=1` 유지 (최종 결정은 evidence_verification에 위임) |
| evidence_verification 연동 | 없음 | `detect_outliers()` 완료 후 `verify_evidence_data()` 자동 호출 |
| 반환값 | `{status, data, message, count}` | `{..., "verification": {...}}` 포함 |

### `app/services/outlier_pipeline/outlier_llm.py` ★ 핵심 수정

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| `_build_user_prompt` 파라미터 | site, date, metric, value, threshold, layer, prod | + `v_status`, `ocr_value`, `gap_percent`, `unit_mismatch` 추가 |
| v_status별 프롬프트 분기 | 없음 (단일 프롬프트) | Case 2/3/4별 `[검증 상황]` 설명 텍스트 분기 |
| unit_mismatch 경고 | 없음 | `[단위 오류 경고]` 추가 |
| v_status=5 처리 | 분석 대상에 포함 | 분석 스킵 |
| verification_logs 참조 | 없음 | `ocr_value`, `gap_percent`, `unit_mismatch` 조회 후 프롬프트에 전달 |

### `app/api/v1/evidence.py` 수정

- `POST /verify` 엔드포인트에서 `gap_percent_threshold` 파라미터 제거
- docstring을 새로운 v_status 결정 로직에 맞게 업데이트

---

## 6. API 엔드포인트 전체 목록

모든 엔드포인트는 JWT Bearer 토큰 인증 필요.

### Evidence (증빙 처리)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/evidence/upload-ocr` | 청구서 이미지/PDF 업로드 + OCR 처리 |
| POST | `/api/v1/evidence/extract` | raw_ocr_data → evidence_usage 적재 |
| POST | `/api/v1/evidence/verify` | 증빙 정합성 검증 (단독 재실행용) |

### Outliers (이상치 탐지 + AI 진단)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/outliers/detect` | 이상치 탐지 실행 (증빙 검증 자동 연동) |
| POST | `/api/v1/outliers/analyze` | GPT-4o AI 진단 실행 |
| POST | `/api/v1/outliers/{std_id}/justify` | 소명 제출 |
| GET | `/api/v1/outliers/{std_id}` | 이상치 상세 조회 |

### Finalization (최종 확정)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/finalization/{std_id}` | 수치 보정 + 최종 확정 (v_status→5) |
| POST | `/api/v1/finalization/{std_id}/revert` | 확정 취소 + original_value 복원 |
| GET | `/api/v1/finalization/{std_id}/history` | 보정 이력 조회 |

### Dashboard (대시보드)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/dashboard` | 검증 현황 통합 데이터 (이상치+증빙+OCR 포함) |
| GET | `/api/v1/dashboard/status-summary` | v_status별 건수 집계 |
| GET | `/api/v1/dashboard/outlier-pending` | 소명 대기 이상치 목록 |

### Audit (감사 추적)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/audit` | 전체 감사 로그 조회 |
| GET | `/api/v1/audit/summary` | 액션 유형별 집계 |
| GET | `/api/v1/audit/{std_id}` | 특정 레코드 변경 이력 |

---

## 7. main.py 라우터 등록 (반드시 추가 필요)

현재 `app/main.py`에 아래 import와 `include_router` 5줄을 추가해야 합니다.

```python
# ── import 추가 (기존 import 라인 끝에 붙이기) ───────────────────────────────
from app.api.v1 import outliers, evidence, finalization, dashboard, audit

# ── include_router 추가 (기존 라우터 등록 블록 아래에 추가) ──────────────────
app.include_router(outliers.router,     prefix="/api/v1/outliers",     tags=["Outliers"],     dependencies=[Depends(get_current_user)])
app.include_router(evidence.router,     prefix="/api/v1/evidence",     tags=["Evidence"],     dependencies=[Depends(get_current_user)])
app.include_router(finalization.router, prefix="/api/v1/finalization", tags=["Finalization"], dependencies=[Depends(get_current_user)])
app.include_router(dashboard.router,    prefix="/api/v1/dashboard",    tags=["Dashboard"],    dependencies=[Depends(get_current_user)])
app.include_router(audit.router,        prefix="/api/v1/audit",        tags=["Audit"],        dependencies=[Depends(get_current_user)])
```

---

## 8. 테이블별 주요 컬럼 (검증 파이프라인 관련)

### `verification_logs`
```
std_id        : standardized_data 참조
evidence_id   : evidence_usage 참조
db_value      : standardized_data.value
ocr_value     : evidence_usage.ocr_value
gap_value     : db_value - ocr_value
gap_percent   : |gap_value / db_value| * 100
unit_mismatch : 1000배 차이 여부 (True/False)
result_code   : 0=일치(gap==0) / 1=불일치(gap≠0) / 2=단위오류
diagnosis     : 자동 생성 진단 텍스트
```

### `outlier_results`
```
std_id              : standardized_data 참조
layer               : "L1", "L2", "L3" (복합 시 콤마 구분)
severity            : "Critical" / "Major" / "Warning"
z_score             : L1 Z-Score 결과
yoy_roc             : L1 전년 동월 대비 변화율(%)
intensity_deviation : L3 원단위 편차(%)
analysis_summary    : GPT-4o LLM 분석 결과 (JSON)
is_resolved         : 소명 완료 여부
```

### `audit_trail`
```
action        : UPLOAD / DETECT / AI_DIAG / VERIFY / JUSTIFY / FINALIZE / REVERT
before_status : 변경 전 v_status
after_status  : 변경 후 v_status
reason        : 변경 사유 (자동 생성 또는 사용자 입력)
performed_by  : "system" 또는 사용자 ID
```

---

## 9. 전달 파일 구조

```
delivery/
├── HANDOVER.md                          ← 이 문서
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── outliers.py              ← 이상치 탐지·AI진단·소명 API
│   │       ├── evidence.py              ← OCR 업로드·추출·증빙검증 API
│   │       ├── finalization.py          ← 최종 확정·취소 API
│   │       ├── dashboard.py             ← 대시보드 조회 API
│   │       └── audit.py                 ← 감사 추적 조회 API
│   └── services/
│       └── outlier_pipeline/
│           ├── evidence_verification.py ← ★ 핵심 수정 (v_status 조합 로직)
│           ├── outlier_detection.py     ← ★ 핵심 수정 (증빙검증 자동 연동)
│           ├── outlier_llm.py           ← ★ 핵심 수정 (케이스별 프롬프트)
│           ├── evidence_extraction.py   ← OCR → evidence_usage 추출
│           ├── outlier_management.py    ← 소명 처리
│           ├── data_finalization.py     ← 최종 확정
│           ├── audit_trail.py           ← 감사 기록
│           ├── database_utils.py        ← DB 유틸리티
│           ├── verification_dashboard.py← 대시보드 조회
│           └── ocr_service.py           ← Upstage OCR + GPT-4o 구조화
```

---

## 10. 환경변수 (.env)

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
SUPABASE_JWT_SECRET=...
OPENAI_API_KEY=...          ← GPT-4o AI 진단에 필요
```

---

## 11. 필수 패키지 (requirements.txt 추가 항목)

```
langchain-openai    # GPT-4o LLM 호출
numpy               # 이상치 탐지 수치 계산
pandas              # 시계열 rolling window 분석
```
