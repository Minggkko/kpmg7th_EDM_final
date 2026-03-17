# ESG 데이터 관리 시스템 (EDM) 파이프라인 보고서

> **작성일:** 2026-03-12  
> **대상 모듈:** `complete/backend_modules/`  
> **DB:** Supabase (PostgreSQL)

---

## 1. 데이터베이스 테이블 정의

### 1-1. 핵심 데이터 테이블

| 테이블명 | 역할 | 주요 컬럼 |
|---------|------|----------|
| **standardized_data** | ESG 표준화 실적 데이터 (파이프라인 중심) | `id`, `source_name`, `metric_name`, `reporting_date`, `value`, `unit`, `v_status`, `original_value`, `correction_reason`, `updated_by`, `updated_at` |
| **activity_data** | 사업장별 생산량(원단위 계산용) | `activity_id`, `site_id`, `reporting_date`, `production_qty`, `unit` |
| **threshold_limits** | 지표별 물리적 상한 임계치 | `site_id`, `metric_name`, `upper_limit`, `unit` |

### 1-2. 이상치 관련 테이블

| 테이블명 | 역할 | 주요 컬럼 |
|---------|------|----------|
| **outlier_results** | 이상치 탐지 결과 저장 | `id`, `std_id`(FK), `layer`, `severity`, `detected_value`, `threshold`, `z_score`, `yoy_roc`, `intensity_deviation`, `analysis_summary`, `is_resolved` |
| **justification_logs** | 이상치 소명 내역 | `id`, `std_id`(FK), `outlier_id`(FK), `justification_type`, `user_feedback`, `action_taken`, `created_by`, `resolved_at` |

### 1-3. 증빙 관련 테이블

| 테이블명 | 역할 | 주요 컬럼 |
|---------|------|----------|
| **raw_ocr_data** | OCR 원문 데이터 (미가공) | `id`, `file_name`, `raw_content`(JSONB), `processing_status` |
| **evidence_usage** | OCR에서 파싱된 정형 증빙 데이터 | `id`, `site_id`, `reporting_date`, `metric_name`, `ocr_value`, `unit`, `file_name` |
| **verification_logs** | 증빙 정합성 검증 결과 | `log_id`, `std_id`(FK), `evidence_id`(FK), `db_value`, `ocr_value`, `gap_value`, `gap_percent`, `result_code`, `unit_mismatch`, `diagnosis` |

### 1-4. 감사·이력 테이블

| 테이블명 | 역할 | 주요 컬럼 |
|---------|------|----------|
| **audit_trail** | 모든 데이터 변경 이력 (감사 추적) | `trail_id`, `std_id`(FK), `action`, `before_value`, `after_value`, `before_status`, `after_status`, `reason`, `performed_by`, `performed_at` |

---

## 2. v_status 코드 정의

`standardized_data.v_status` 는 파이프라인 전체의 진행 상태를 나타냅니다.

| 코드 | 상태명 | 의미 | 진입 경로 |
|-----|--------|------|----------|
| **0** | Pending | 최초 적재 후 미처리 | 데이터 업로드 시 초기값 |
| **1** | Normal | 이상치 없음 (정상) | `outlier_detection` 통과 또는 소명 처리 완료 |
| **2** | Outlier | 이상치 탐지됨 (소명 대기) | `outlier_detection` 이상 감지 |
| **3** | Mismatch | 증빙 수치 불일치 | `evidence_verification` gap ≥ 1% |
| **4** | Unit Error | 단위 오기입 | `evidence_verification` 1000배 오차 |
| **5** | Verified | 증빙 정합성 확인 완료 | `evidence_verification` gap < 1% 또는 `data_finalization` 확정 |
| **99** | Unknown | 미분류/레거시 데이터 | — |

---

## 3. 전체 파이프라인 흐름

```
[데이터 원천]
  raw_ocr_data (Pending)
        │
        ▼ [STEP 0] evidence_extraction.py
  evidence_usage (정형화 OCR 데이터 적재)
  raw_ocr_data.processing_status = "Extracted"

[실적 데이터]
  standardized_data (v_status = 0, Pending)
        │
        ▼ [STEP 1] outlier_detection.py
        ├─ 정상 → v_status = 1  ───────────────────────────────────────┐
        └─ 이상치 → v_status = 2                                        │
               │                                                        │
               ▼ [STEP 2] outlier_llm.py                                │
         outlier_results.analysis_summary 채워짐 (AI 진단)              │
         (v_status 변경 없음)                                           │
               │                                                        │
               ▼ [STEP 3] outlier_management.py                         │
         소명 "정상" → v_status = 2 → 1 ─────────────────────────────── │
         소명 기타  → v_status = 2 유지 (추가 검토)                     │
                                                                        │
        ◄───────────────────────────────────────────────────────────────┘
        │ v_status = 1 (정상 데이터)
        ▼ [STEP 4] evidence_verification.py
        ├─ gap < 1%    → v_status = 5 (Verified)
        ├─ gap ≥ 1%    → v_status = 3 (Mismatch)
        └─ 1000배 오차 → v_status = 4 (Unit Error)
               │
               ▼ [STEP 5] data_finalization.py  ← 필요 시
         수치 보정 후 v_status = 5 확정
         또는 revert_finalization() 으로 원복

        ▼ [조회] verification_dashboard.py
  FE 대시보드용 통합 데이터 반환
  (기본값: v_status = 1 만 조회, Option A)

  ★ 모든 단계에서 audit_trail 자동 기록
```

---

## 4. 각 파이프라인 단계 상세

---

### STEP 0 — evidence_extraction.py
**OCR 원문 파싱 → evidence_usage 적재**

| 항목 | 내용 |
|------|------|
| **입력** | `raw_ocr_data` (processing_status = "Pending") |
| **출력** | `evidence_usage` INSERT, `raw_ocr_data.processing_status = "Extracted"` |
| **v_status 변경** | 없음 (standardized_data 독립) |
| **audit 기록** | 없음 |

**처리 로직:**
1. `raw_ocr_data`에서 미처리(`Pending`) 레코드 조회
2. `raw_content`(JSONB) 파싱 → `customer_number`, `year`, `month`, `usage`, `unit` 추출
3. `site_metric_map` 으로 사업장·지표 매핑
4. `evidence_usage` 삽입
5. `raw_ocr_data.processing_status = "Extracted"` 갱신

---

### STEP 1 — outlier_detection.py
**3단계 이상치 탐지 → v_status 0→1/2 전이**

| 항목 | 내용 |
|------|------|
| **입력** | `standardized_data` (v_status = 0), `activity_data`, `threshold_limits` |
| **출력** | `standardized_data.v_status` UPDATE, `outlier_results` INSERT (이상치만) |
| **v_status 변경** | 0 → 1 (정상) 또는 0 → 2 (이상치) |
| **audit 기록** | `DETECT` |

**3단계 탐지 알고리즘:**

| 레이어 | 방법 | 판정 기준 | 심각도 |
|--------|------|-----------|--------|
| **L1** | Z-Score (12개월 rolling window) | Z > 3.0 | Warning |
| **L1** | 전년 동월 변화율 (YoY RoC) | 변화율 > 30% | Warning |
| **L2** | 고정 상한 임계치 (`threshold_limits`) | value > upper_limit | **Critical** |
| **L3** | 원단위 편차 (value / production_qty) | 편차 > 50% | **Major** |

> ⚠️ **필수 조건:** (사업장 × 지표) 조합당 최소 **13행** 이상 이력 필요 (12개월 window + 현재행).  
> 이력 부족 시 해당 조합은 스킵 처리됩니다.

**심각도(severity) 결정 규칙:**
- L2 초과 → `Critical`
- L3만 초과 → `Major`  
- L1만 해당 → `Warning`

---

### STEP 2 — outlier_llm.py
**GPT-4o AI 진단 보고서 생성**

| 항목 | 내용 |
|------|------|
| **입력** | `outlier_results` (analysis_summary = NULL), `standardized_data`, `activity_data` |
| **출력** | `outlier_results.analysis_summary` UPDATE |
| **v_status 변경** | **없음** |
| **audit 기록** | `AI_DIAG` |

**처리 로직:**
1. `analysis_summary = NULL` 인 `outlier_results` 조회
2. `standardized_data` 별도 조회 (FK join 미사용, 2-step)
3. GPT-4o 에 사업장·지표·측정값·임계치·탐지레이어·생산량 전달
4. **현장용 비즈니스 언어**로 진단 보고서 생성  
   - "평소 대비 X배 증가", "설비 한계 Y% 초과" 등 직관적 표현
   - 임계치 5배 초과 시 "단위 오기입 의심" 자동 안내
5. 결과 JSON을 `analysis_summary` 에 저장

---

### STEP 3 — outlier_management.py
**이상치 소명 처리 → v_status 2→1 전이**

| 항목 | 내용 |
|------|------|
| **입력** | `std_id`, `user_feedback`, `action_taken`, `created_by` |
| **출력** | `justification_logs` INSERT, `standardized_data.v_status` UPDATE (조건부), `outlier_results.is_resolved` UPDATE |
| **v_status 변경** | `action_taken = "정상"` 일 때만 2 → 1 |
| **audit 기록** | `JUSTIFY` |

**상태 전이 규칙:**

| action_taken | v_status 변화 | 다음 단계 |
|--------------|--------------|----------|
| `"정상"` | 2 → **1** | evidence_verification 대상 |
| 그 외 | 2 → 2 유지 | 추가 검토 대기 |

---

### STEP 4 — evidence_verification.py
**증빙 정합성 검증 → v_status 1→3/4/5 전이**

| 항목 | 내용 |
|------|------|
| **입력** | `evidence_usage` (미검증), `standardized_data` (v_status = **1** 만) |
| **출력** | `verification_logs` INSERT, `standardized_data.v_status` UPDATE, `raw_ocr_data.processing_status = "Success"` |
| **v_status 변경** | 1 → 3 / 4 / 5 |
| **audit 기록** | `VERIFY` |

**판정 로직:**

| 조건 | v_status | result_code | 의미 |
|------|---------|-------------|------|
| `abs(db ×1000 - ocr) < 1` 또는 `abs(db ÷1000 - ocr) < 1` | **4** | 4 | 단위 오기입 (kWh↔MWh 등) |
| gap_percent ≥ 1% | **3** | 3 | 수치 불일치 |
| gap_percent < 1% | **5** | 5 | 정합성 확인 완료 |

> ✅ **v_status=1 데이터만 처리** — 이상치(2) 또는 소명 전 데이터는 건드리지 않습니다.

**중복 방지:** `verification_logs`에 이미 존재하는 `evidence_id`는 재처리하지 않습니다.

---

### STEP 5 — data_finalization.py
**수치 보정 및 최종 확정 (선택적 단계)**

| 항목 | 내용 |
|------|------|
| **입력** | `std_id`, `corrected_value`, `user_id`, `reason` |
| **출력** | `standardized_data.value` 보정, `original_value` 백업, `v_status = 5` |
| **v_status 변경** | 2/3/4 → 5 |
| **audit 기록** | `FINALIZE` 또는 `REVERT` |

**함수:**
- `finalize_usage_data()` — 수치 보정 후 v_status=5 확정
- `revert_finalization()` — `original_value` 복원, v_status 이전 상태로 원복

---

### 조회 — verification_dashboard.py
**FE 대시보드용 통합 데이터 반환**

| 항목 | 내용 |
|------|------|
| **기본 필터** | v_status = **1** (Option A, 정상 데이터만) |
| **조인 테이블** | `outlier_results`, `verification_logs`, `evidence_usage`, `activity_data` |

**주요 함수:**

| 함수 | 설명 |
|------|------|
| `get_verification_dashboard()` | 건별 통합 데이터 (v_status, 이상치 정보, 증빙 정보, 생산량, 원단위 포함) |
| `get_status_summary()` | v_status별 건수 집계 (모니터링/차트용) |

---

### 공통 — audit_trail.py
**모든 단계 자동 감사 기록**

| 액션 코드 | 발생 시점 | 기록 모듈 |
|-----------|----------|---------|
| `UPLOAD` | 최초 데이터 적재 | (업로드 모듈) |
| `DETECT` | 이상치 탐지 완료 | `outlier_detection` |
| `AI_DIAG` | GPT-4o 진단 완료 | `outlier_llm` |
| `JUSTIFY` | 소명 제출 | `outlier_management` |
| `VERIFY` | 증빙 검증 완료 | `evidence_verification` |
| `FINALIZE` | 수치 확정 | `data_finalization` |
| `REVERT` | 확정 취소 | `data_finalization` |

각 이벤트마다 `before_value`, `after_value`, `before_status`, `after_status`, `performed_by`, `reason` 을 모두 기록합니다.

---

## 5. 테이블 연관 관계 (ERD 요약)

```
standardized_data (중심 테이블)
    │
    ├──< outlier_results         (std_id FK)
    │       └──< justification_logs  (outlier_id FK, std_id FK)
    │
    ├──< verification_logs       (std_id FK)
    │       └── evidence_usage   (evidence_id FK)
    │               └── raw_ocr_data  (file_name 연결)
    │
    └──< audit_trail             (std_id FK)

activity_data      ← outlier_detection 에서 JOIN (site_id + reporting_date)
threshold_limits   ← outlier_detection 에서 JOIN (site_id + metric_name)
```

---

## 6. 수정 이력 (이번 세션)

| 모듈 | 변경 내용 |
|------|----------|
| `database_utils.py` | `.env` 경로 3단계→2단계 수정 (`parent.parent.parent` → `parent.parent`) |
| `outlier_llm.py` | PostgREST FK join (`standardized_data(*)`) → 2-step 개별 쿼리로 변경, `site_id` → `source_name` 컬럼명 수정 |
| `outlier_detection.py` | 테이블명 `standard_usage` → `standardized_data` |
| `outlier_management.py` | 테이블명 `standard_usage` → `standardized_data` |
| `data_finalization.py` | 테이블명 `standard_usage` → `standardized_data` |
| `evidence_verification.py` | 테이블명 변경 + `v_status=1` 필터 추가 (소명 전 데이터 보호) |
| `verification_dashboard.py` | 테이블명 변경 + `v_status` 기본값 `None` → `1` (Option A 적용) |
