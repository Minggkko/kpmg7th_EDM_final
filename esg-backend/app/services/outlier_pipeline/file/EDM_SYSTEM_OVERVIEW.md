# EDM 파이프라인 시스템 개요

> **작성일**: 2026-03-12  
> **대상 환경**: Python + Supabase (PostgreSQL)  
> **프로젝트 경로**: `c:\final_project\git_branch\민석+혁준\`

---

## 1. 시스템 목적

ESG 에너지 데이터(전기·연료 소비량)의 수집 → 이상치 탐지 → AI 진단 → 증빙 검증 → 최종 확정까지 전 과정을 자동화하는 데이터 품질 관리 파이프라인.

---

## 2. 테이블 구성

### 2-1. 기준(Base) 테이블

| 테이블 | 주요 컬럼 | 역할 |
|---|---|---|
| `master_sites` | `site_id`, `site_name` | 사업장 마스터 |
| `site_metric_map` | `customer_number`, `site_id`, `metric_name`, `unit` | OCR 고객번호 → 사업장/지표 매핑 |
| `threshold_limits` | `site_id`, `metric_name`, `upper_limit`, `unit` | L2 이상치 탐지 상한 임계치 |
| `activity_data` | `site_id`, `reporting_date`, `production_qty`, `unit` | 월별 생산량 (L3 원단위 계산용) |

### 2-2. 처리(Processing) 테이블

| 테이블 | 주요 컬럼 | 역할 |
|---|---|---|
| `standardized_data` | `id`, `site_id`, `metric_name`, `reporting_date`, `value`, `unit`, `v_status`, `original_value` | **핵심 테이블** — 모든 상태 전이의 기준 |
| `raw_ocr_data` | `id`, `file_name`, `raw_content` (JSONB), `processing_status` | OCR 원본 파일 보관 |
| `evidence_usage` | `id`, `site_id`, `metric_name`, `reporting_date`, `ocr_value`, `unit`, `file_name` | OCR 파싱 후 정규화된 증빙값 |

### 2-3. 결과(Result) 테이블

| 테이블 | 주요 컬럼 | 역할 |
|---|---|---|
| `outlier_results` | `id`, `std_id` (FK), `layer`, `severity`, `threshold`, `analysis_summary`, `is_resolved` | 이상치 탐지 결과 + AI 진단 보고서 |
| `verification_logs` | `log_id`, `std_id` (FK), `evidence_id`, `db_value`, `ocr_value`, `gap_percent`, `result_code`, `unit_mismatch`, `diagnosis` | 증빙 정합성 검증 이력 |
| `justification_logs` | `id`, `std_id` (FK), `outlier_id`, `user_feedback`, `action_taken`, `created_by` | 이상치 소명(사용자 입력) 이력 |
| `audit_trail` | `trail_id`, `std_id` (FK), `action`, `before_status`, `after_status`, `before_value`, `after_value`, `performed_by`, `reason` | 전 모듈 공통 변경 이력 |

### 2-4. FK 관계도

```
master_sites ──── site_id ────┬── standardized_data ──── id ────┬── outlier_results
                              ├── activity_data                  ├── verification_logs
                              ├── threshold_limits               ├── justification_logs
                              └── site_metric_map                └── audit_trail
                                       │
                              customer_number
                                       │
                                raw_ocr_data ──── file_name ──── evidence_usage
```

---

## 3. v_status 상태 코드

| 코드 | 이름 | 의미 |
|---|---|---|
| `0` | Pending | 적재 직후 미처리 상태 |
| `1` | Normal | 이상치 없음 (탐지 통과) |
| `2` | Outlier | 이상치 탐지됨 (소명 대기) |
| `3` | Mismatch | OCR 수치 불일치 (오차 ≥ 1%) |
| `4` | UnitError | 단위 오기입 (1,000배 오차 감지) |
| `5` | Verified | 최종 확정 (증빙 정합성 OK) |
| `99` | Legacy | 구버전 데이터 (처리 제외) |

---

## 4. 전체 처리 흐름

```
[데이터 적재]
raw_ocr_data (Pending)          standardized_data (v_status=0)
      │                                    │
      ▼                                    ▼
[STEP 1] evidence_extraction      [STEP 2] outlier_detection
  · Pending → Extracted             · L1 / L2 / L3 분석
  · evidence_usage INSERT           · v_status 0 → 1 or 2
                                    · outlier_results INSERT
                                    · audit_trail: DETECT
                                          │
                           ┌──────────────┴──────────────┐
                     v_status=1 (Normal)           v_status=2 (Outlier)
                           │                             │
                           │                    [STEP 2-A] outlier_llm
                           │                      · GPT-4o 진단 보고서
                           │                      · analysis_summary UPDATE
                           │                      · audit_trail: AI_DIAG
                           │                             │
                           │                    [STEP 2-B] outlier_management
                           │                      · 사용자 소명 입력
                           │                      · action_taken='정상' → v_status=1
                           │                      · justification_logs INSERT
                           │                      · audit_trail: JUSTIFY
                           │                             │
                           └──────────────┬──────────────┘
                                    v_status=1
                                          │
                                [STEP 3] evidence_verification
                                  · evidence_usage ↔ standardized_data 비교
                                  · gap_percent 계산
                                  · unit_mismatch 판정
                                  ├── gap < 1%            → v_status=5 (Verified)
                                  ├── gap ≥ 1%            → v_status=3 (Mismatch)
                                  └── 1000배 오차          → v_status=4 (UnitError)
                                  · verification_logs INSERT
                                  · audit_trail: VERIFY
                                          │
                           ┌─────────────┼─────────────┐
                     v_status=5     v_status=3     v_status=4
                    (완료)         (재검증 필요)   (재검증 필요)
                                       │               │
                                [OCR 교정값 재투입]
                                       │
                                [STEP 3 반복 실행]
                                       │
                                  v_status=5 ✅
```

---

## 5. 이상치 탐지 3단계 (outlier_detection)

### L1 — 통계적 이상치

| 지표 | 기준 | 임계값 |
|---|---|---|
| Z-Score | 12개월 rolling window 기준 | ≥ 3.0 |
| YoY 변화율 | 전년 동월 대비 증감률 | ≥ 30% |

```
Z = |value - mean(window)| / std(window)
YoY = |value - value_12m_ago| / value_12m_ago × 100
```

### L2 — 물리적 상한 초과

```
value > threshold_limits.upper_limit
```

### L3 — 원단위(Intensity) 편차

```
intensity         = value / production_qty
hist_intensity    = hist_value / hist_production_qty  (12개월 평균)
intensity_dev(%)  = |intensity - hist_intensity| / hist_intensity × 100

기준: ≥ 50%
```

### 심각도(Severity) 판정

| 조건 | 등급 |
|---|---|
| L2 초과 | **Critical** |
| L3 편차 ≥ 50% (L2 미초과) | **Major** |
| L1만 해당 | **Warning** |

---

## 6. 증빙 검증 로직 (evidence_verification)

### 갭 계산

```python
gap_value   = db_value - ocr_value
gap_percent = abs(gap_value) / db_value × 100
```

### 단위 오기입 판정 (unit_mismatch)

```python
abs(db_value × 1000 - ocr_value) < 1.0   # OCR이 1000배 작은 경우
abs(db_value / 1000 - ocr_value) < 1.0   # OCR이 1000배 큰 경우
```

### v_status 전이 규칙

| 조건 | 결과 |
|---|---|
| `unit_mismatch = True` | v_status = **4** (UnitError) |
| `gap_percent ≥ 1%` | v_status = **3** (Mismatch) |
| `gap_percent < 1%` | v_status = **5** (Verified) |

> **재검증 허용**: v_status=3, 4 레코드는 교정 OCR 재투입 후 재검증 가능  
> (result_code=5인 evidence만 스킵, 3/4는 새 OCR 기준으로 재판정)

---

## 7. 백엔드 모듈 구성

| 모듈 파일 | 핵심 함수 | 역할 |
|---|---|---|
| `database_utils.py` | `get_supabase_client()`, `fetch_one()` | DB 연결 공통 유틸 |
| `outlier_detection.py` | `detect_outliers()` | L1/L2/L3 이상치 탐지 |
| `outlier_llm.py` | `analyze_outlier_with_llm()` | GPT-4o AI 진단 |
| `outlier_management.py` | `update_outlier_justification()`, `get_outlier_detail()` | 이상치 소명 처리 |
| `evidence_extraction.py` | `extract_pending_ocr_data()` | OCR → evidence_usage 적재 |
| `evidence_verification.py` | `verify_evidence_data()` | DB vs OCR 정합성 검증 |
| `verification_dashboard.py` | `get_verification_dashboard()`, `get_status_summary()` | FE 대시보드용 통합 조회 |
| `data_finalization.py` | `finalize_usage_data()`, `revert_finalization()` | 수치 보정 및 최종 확정 |
| `audit_trail.py` | `log_action()`, `get_audit_history()` | 전 모듈 변경 이력 기록 |

---

## 8. audit_trail 액션 코드

| 액션 | 발생 시점 | 기록 모듈 |
|---|---|---|
| `UPLOAD` | 데이터 최초 적재 | - |
| `DETECT` | 이상치 탐지 완료 (v_status 0→1/2) | `outlier_detection` |
| `AI_DIAG` | GPT-4o 진단 완료 | `outlier_llm` |
| `VERIFY` | 증빙 검증 완료 (v_status 갱신) | `evidence_verification` |
| `JUSTIFY` | 사용자 소명 제출 (v_status 2→1) | `outlier_management` |
| `FINALIZE` | 수치 보정 + 최종 확정 | `data_finalization` |
| `REVERT` | 확정 취소 + 복원 | `data_finalization` |

---

## 9. 전체 v_status 전이 경로 요약

```
                         ┌─────────────────────────────────────┐
0 (Pending)              │                                     │
   │                     │                                     │
   ├──[이상치 없음]──→ 1 (Normal) ──[증빙 정합]────────────→ 5 (Verified) ✅
   │                          │                                │
   │                          ├──[OCR 오차≥1%]──→ 3 (Mismatch)──┤
   │                          │                                │
   │                          └──[단위 오류]───→ 4 (UnitError)──┘
   │                               ↑ 재검증(교정OCR 재투입)
   │
   └──[이상치 탐지]──→ 2 (Outlier)
                           │
                    [소명: action='정상']
                           │
                           └──→ 1 (Normal) ──→ (위 경로 동일)
```

---

## 10. 실행 스크립트 목록

| 스크립트 | 역할 |
|---|---|
| `_setup_test_data.py` | 전체 초기화 + 더미 데이터 삽입 (테스트용) |
| `run_outlier_detection.py` | STEP 2: 이상치 탐지 실행 |
| `run_outlier_llm.py` | STEP 2-A: AI 진단 실행 |
| `_run_evidence_pipeline.py` | STEP 3: OCR 추출 + 증빙 검증 실행 |
| `_run_correction_pipeline.py` | 교정 파이프라인: 소명(2→1) + 재검증(3,4→5) |
| `_show_ai_diagnosis.py` | AI 진단 결과 출력 |
| `check_outlier_result.py` | v_status 분포 + outlier_results 현황 확인 |
