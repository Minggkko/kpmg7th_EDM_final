# EDM 파이프라인 기술 가이드

> **대상 독자**: 시스템을 처음 인수인계받는 개발자 / ESG 데이터 운영 담당자
> **기술 스택**: FastAPI · Supabase (PostgreSQL + pgvector) · OpenAI GPT-4o · LangChain · Upstage Document AI
> **서비스 목적**: 지주회사·계열사가 제출한 ESG 원본 데이터를 표준화·이상치탐지·증빙검증·소명처리·최종확정까지 일괄 관리하는 EDM(ESG Data Management) 백엔드

---

## 목차

1. [전체 파이프라인 개요](#1-전체-파이프라인-개요)
2. [데이터 상태값(v_status) 완전 정리](#2-데이터-상태값v_status-완전-정리)
3. [DB 테이블 구조 및 연관 관계](#3-db-테이블-구조-및-연관-관계)
4. [STAGE 1 — 원본 데이터 업로드 및 표준화](#4-stage-1--원본-데이터-업로드-및-표준화)
5. [STAGE 2 — 증빙 문서 OCR 처리](#5-stage-2--증빙-문서-ocr-처리)
6. [STAGE 3 — 이상치 탐지 (3단계 탐지 로직)](#6-stage-3--이상치-탐지-3단계-탐지-로직)
7. [STAGE 4 — 증빙 정합성 검증 및 v_status 최종 결정](#7-stage-4--증빙-정합성-검증-및-v_status-최종-결정)
8. [STAGE 5 — AI 진단 (GPT-4o)](#8-stage-5--ai-진단-gpt-4o)
9. [STAGE 6 — 소명 처리](#9-stage-6--소명-처리)
10. [STAGE 7 — 최종 확정 및 취소](#10-stage-7--최종-확정-및-취소)
11. [v_status별 사용자 조치 가이드](#11-v_status별-사용자-조치-가이드)
12. [API 엔드포인트 요약](#12-api-엔드포인트-요약)

---

## 1. 전체 파이프라인 개요

```
[지주회사 내부 인터페이스]
         │
         ▼
┌─────────────────────────────┐
│ STAGE 1: 원본 업로드 & 표준화  │  POST /api/v1/raw-data/upload
│  raw_data → standardized_data│  v_status: 없음 → 0(Pending)
└──────────────┬──────────────┘
               │ 자동 실행
               ▼
┌─────────────────────────────┐
│ STAGE 2: 증빙 OCR 처리       │  POST /api/v1/evidence/upload-ocr
│  이미지/PDF → raw_ocr_data   │  POST /api/v1/evidence/extract
│  → evidence_usage            │  (v_status 변경 없음)
└──────────────┬──────────────┘
               │ 사용자가 탐지 트리거
               ▼
┌─────────────────────────────┐
│ STAGE 3: 이상치 탐지          │  POST /api/v1/outliers/detect
│  L1(통계) + L2(임계값)        │  v_status: 0 → 1(Standardized)
│  + L3(집약도)                 │
└──────────────┬──────────────┘
               │ 탐지 완료 후 자동 연동
               ▼
┌─────────────────────────────┐
│ STAGE 4: 증빙 정합성 검증     │  (detect_outliers 내부 자동 호출)
│  OCR값 ↔ 표준화값 비교        │  POST /api/v1/evidence/verify (수동 재실행)
│  v_status 최종 결정          │  v_status: 1 → 2 / 3 / 4 / 5
└──────────────┬──────────────┘
               │ 사용자가 AI 진단 요청
               ▼
┌─────────────────────────────┐
│ STAGE 5: AI 진단 (GPT-4o)   │  POST /api/v1/outliers/analyze
│  이상치 원인 분석 보고서 생성   │  (v_status 변경 없음)
└──────────────┬──────────────┘
               │ 담당자 검토 후
               ▼
┌─────────────────────────────┐
│ STAGE 6: 소명 처리            │  POST /api/v1/outliers/{std_id}/justify
│  이상치 원인 또는 데이터 오류   │  v_status: 유지(2/3/4) or 1(정상)
│  에 대한 소명 제출             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ STAGE 7: 최종 확정            │  POST /api/v1/finalization/{std_id}
│  값 수정(선택) + 확정 승인     │  v_status: 2/3/4 → 5(Verified)
└─────────────────────────────┘
```

---

## 2. 데이터 상태값(v_status) 완전 정리

`standardized_data` 테이블의 `v_status` 컬럼이 각 데이터의 파이프라인 진행 상태를 나타냅니다.

| v_status | 이름 | 의미 | 전이 주체 |
|:---:|---|---|---|
| **1** | Standardized | 표준화 완료, 이상치 탐지 대기 중 | `mapping_service.run_mapping()` |
| **2** | PASS + 불일치 | 이상치 없음 + 증빙값과 DB값 불일치 | `evidence_verification.verify_evidence_data()` |
| **3** | FAIL + 일치 | 이상치 탐지 + 증빙값과 DB값 일치 | `evidence_verification.verify_evidence_data()` |
| **4** | FAIL + 불일치 | 이상치 탐지 + 증빙값과 DB값도 불일치 | `evidence_verification.verify_evidence_data()` |
| **5** | Verified | 최종 확정 완료 (SR 보고서 사용 가능) | `data_finalization.finalize_usage_data()` |
| **99** | Unit Error | 단위 변환 실패 (파이프라인 제외) | `mapping_service.run_mapping()` |

> `detect_outliers()` 는 v_status 를 직접 변경하지 않습니다. 이상치 탐지 결과를 `outlier_results` 에 기록한 뒤, `verify_evidence_data()` 를 자동 호출하여 최종 v_status(2/3/4/5)를 결정합니다.

### v_status 전이 다이어그램

```
원본 CSV/Excel 업로드
    │
    ▼ mapping_service.run_mapping()
[v_status=1] ← 표준화 완료 (이상치 탐지 대기)
    │
    ▼ detect_outliers()  ← L1/L2/L3 탐지 후 verify_evidence_data() 자동 호출
    │   (탐지 결과는 outlier_results 에 기록, v_status 는 검증 단계에서 결정)
    │
    ├─ 이상치 없음 + 증빙 일치  ──────────────────► [v_status=5] 자동 확정
    ├─ 이상치 없음 + 증빙 불일치 ──────────────────► [v_status=2]
    ├─ 이상치 있음 + 증빙 일치  ──────────────────► [v_status=3]
    └─ 이상치 있음 + 증빙 불일치 ──────────────────► [v_status=4]

[v_status=2/3/4] ─── justify(action='정상') ──► [v_status=1] (재검증)
[v_status=2/3/4] ─── finalize() ──────────────► [v_status=5]
[v_status=5]     ─── revert()   ──────────────► [이전 v_status]
[v_status=99]    ─── 단위 변환 실패, 파이프라인 제외 (수동 처리 필요)
```

---

## 3. DB 테이블 구조 및 연관 관계

### 3-1. 마스터 데이터 계층 구조

```
issues                     ← 중대성 이슈 (예: 에너지, 온실가스)
  └── indicators            ← ESG 지표 (예: 에너지 소비량)
        └── data            ← 데이터 그룹 (예: 직접에너지, 간접에너지)
              └── data_points  ← 데이터포인트 (예: 전력사용량(MWh))
                    └── data_point_synonyms  ← 동의어 (매핑용)
```

### 3-2. 파이프라인 핵심 테이블

```
raw_data                   ← 업로드된 원본 데이터 (wide→long 변환됨)
  │
  ▼ mapping_service
standardized_data          ← 표준화된 데이터 (v_status 관리 핵심 테이블)
  │
  ├──► outlier_results     ← 이상치 탐지 결과
  │       └──► justification_logs  ← 소명 처리 이력
  │
  └──► verification_logs  ← 증빙 검증 결과 (gap_percent, result_code)
         ▲
         │
raw_ocr_data               ← OCR 처리 원본 텍스트
  │
  ▼ evidence_extraction
evidence_usage             ← 구조화된 증빙값 (site_id, metric_name, ocr_value)

audit_trail                ← 전체 파이프라인 동작 감사 로그
```

### 3-3. 기준 데이터 테이블 (이상치 탐지용)

| 테이블 | 역할 | 사용 단계 |
|--------|------|----------|
| `threshold_limits` | L2 탐지용 절대 상한값 | `outlier_detection` L2 |
| `activity_data` | L3 탐지용 생산량(기준년도별) | `outlier_detection` L3 |
| `master_sites` | 사업장 정보 | 시딩 참고용 |
| `site_metric_map` | 고객번호 → 사업장/지표 매핑 | `evidence_extraction` |

### 3-4. standardized_data 주요 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | int | PK |
| `source_type` | text | 계열사/자회사 구분 |
| `source_name` | text | 회사명 (예: 삼성물산) |
| `site_id` | text | 사업장 ID |
| `metric_name` | text | 표준화된 지표명 |
| `data_point_id` | int | data_points FK |
| `value` | float | 현재 적용 값 |
| `original_value` | float | 확정 전 백업 값 (수정 시 보존) |
| `unit` | text | 표준 단위 |
| `v_status` | int | 파이프라인 상태 (0~5, 99) |
| `reporting_date` | date | 보고 기준 월 (YYYY-MM-01) |
| `standardization_confidence` | float | 매핑 신뢰도 (0.0~1.0) |
| `updated_by` | text | 최종 수정 주체 |
| `correction_reason` | text | 수정 사유 (감사용) |

---

## 4. STAGE 1 — 원본 데이터 업로드 및 표준화

### 담당 모듈
- `app/services/raw_data_service.py` → `app/services/mapping_service.py`

### API
```
POST /api/v1/raw-data/upload
Content-Type: multipart/form-data
파일: CSV / XLSX / XLS
```

### 파일명 규칙 (필수)
```
{source_type}_{source_name}_raw.{확장자}

예시:
  계열사_삼성물산_raw.csv
  자회사_삼성전자_raw.xlsx
```

### 처리 흐름

```
1. 파일명에서 source_type, source_name 추출
2. DataFrame 로드 (CSV/Excel)
3. wide → long 변환 (melt)
   - date 컬럼 = reporting_date
   - 나머지 컬럼 = metric_col (+ 단위는 컬럼명 괄호에서 추출)
   예: "전력사용량(MWh)" → metric_col="전력사용량", unit="MWh"
4. raw_data 테이블에 100건 단위 배치 INSERT
5. MappingService.run_mapping() 자동 호출 → standardized_data INSERT
```

### 매핑 서비스 상세 (MappingService)

```
각 raw_data 행에 대해:

STEP 1 — 정확 매칭
  data_points.name == metric_col → 신뢰도 1.0

STEP 2 — 벡터 유사도 매칭 (정확 매칭 실패 시)
  OpenAI text-embedding-3-small → pgvector RPC
    match_data_points (data_points 벡터 검색)
    → 실패 시 match_data_point_synonyms (동의어 벡터 검색)
  신뢰도 = cosine similarity 값

STEP 3 — 단위 변환
  UNIT_CONVERSION 테이블로 자동 변환
  (kWh→MWh, GJ→TJ, kg→ton, Nm3→m3 등 15종 지원)
  변환 불가 시 v_status=99 로 마킹 → 파이프라인 제외

STEP 4 — standardized_data UPSERT
  중복 키: (source_type, source_name, reporting_date, metric_name)
  초기 v_status = 0 (Pending)
```

### 관련 DB 테이블

| 입력 | 출력 |
|------|------|
| `raw_data` | `standardized_data` (v_status=0) |

---

## 5. STAGE 2 — 증빙 문서 OCR 처리

### 담당 모듈
- `app/services/outlier_pipeline/ocr_service.py`
- `app/services/outlier_pipeline/evidence_extraction.py`

### API
```
POST /api/v1/evidence/upload-ocr   ← 파일 업로드 + OCR
POST /api/v1/evidence/extract      ← Pending OCR → evidence_usage 적재
```

### OCR 처리 흐름 (upload-ocr)

```
업로드된 이미지/PDF (JPG, PNG, PDF 등)
    │
    ▼
1. Upstage Document AI API 호출
   - URL: https://api.upstage.ai/v1/document-digitization
   - 모델: document-parse
   - 타임아웃: 60초
   - 응답: content.text (HTML 태그 제거 후 사용)
    │
    ▼
2. GPT-4o 구조화
   - 입력: OCR 원문 (최대 4,000자)
   - 추출 필드:
     · customer_number (고객번호/계량기번호)
     · year / month (청구 연도·월)
     · usage (실소비량, 청구금액 아님)
     · unit (MWh, kWh, Nm3, m3 등)
    │
    ▼
3. raw_ocr_data 테이블 INSERT
   - processing_status = "Pending"
   - raw_content(JSONB): 구조화 결과 + OCR 원문 + 업로더 ID
```

### 증빙 추출 흐름 (extract)

```
raw_ocr_data (processing_status="Pending")
    │
    ▼
1. raw_content 파싱 (customer_number, year, month, usage, unit 추출)
    │
    ▼
2. site_metric_map 조회
   customer_number → {site_id, metric_name, unit} 매핑
    │
    ▼
3. evidence_usage 테이블 INSERT
   (site_id, metric_name, reporting_date, ocr_value, unit, file_name)
    │
    ▼
4. raw_ocr_data.processing_status → "Extracted"
```

### raw_ocr_data 상태 전이

```
Pending → Extracted → Success
  ↑           ↑           ↑
업로드      extract()   verify() 완료
```

### 관련 DB 테이블

| 입력 | 중간 | 출력 |
|------|------|------|
| 업로드 파일 | `raw_ocr_data` (Pending→Extracted) | `evidence_usage` |

> **주의**: `site_metric_map` 테이블에 해당 `customer_number`가 등록되어 있지 않으면 OCR 추출 단계에서 스킵됩니다. OCR 파일 업로드 전 반드시 매핑 테이블을 확인하세요.

---

## 6. STAGE 3 — 이상치 탐지 (3단계 탐지 로직)

### 담당 모듈
- `app/services/outlier_pipeline/outlier_detection.py`

### API
```
POST /api/v1/outliers/detect
Body (선택): {"site_id": "삼성물산_서울", "metric_name": "전력사용량"}
```

### 탐지 대상
`standardized_data.v_status = 0` (Pending) 인 레코드

### 3단계 탐지 로직 상세

#### L1 — 통계적 이상치 (Z-Score + YoY 변화율)

```python
# 슬라이딩 윈도우: 직전 12개월 데이터 기준
Z-Score = |현재값 - 12개월 평균| / 12개월 표준편차
YoY-RoC = |현재값 - 전년동월값| / 전년동월값 × 100

# 임계값
Z-Score  > 3.0  → L1 플래그
YoY-RoC > 30.0% → L1 플래그  (둘 중 하나만 초과해도 탐지)
```

| 의미 | 판단 기준 |
|------|----------|
| Z-Score | 최근 1년 평균에서 3σ 이상 벗어난 경우 |
| YoY-RoC | 전년 동월 대비 30% 초과 증감 |

#### L2 — 절대 임계값 초과

```python
# threshold_limits 테이블에서 (site_id, metric_name) 기준 조회
value > threshold_limits.upper_limit → L2 플래그

# 예시:
# 삼성물산 전체 전력: 상한 14,000 MWh
# 삼성전자 전력:     상한 18,000 MWh
```

#### L3 — 집약도(원단위) 편차

```python
# activity_data 테이블의 생산량과 결합
집약도(현재) = 현재값 / 해당월 생산량
집약도(과거평균) = 직전 12개월 (값/생산량) 평균

편차 = |집약도(현재) - 집약도(과거평균)| / 집약도(과거평균) × 100

# 임계값
편차 > 50% → L3 플래그
```

#### 심각도 등급 결정

```
L2 초과           → Critical  (설비 가동 한계 초과, 최우선 조치)
L3 초과(L2 미초과) → Major    (에너지 투입 효율 이상)
L1만 초과          → Warning  (통계적 이상, 확인 필요)
```

#### 데이터 부족 시 처리

```
슬라이딩 윈도우 최소 요건: 13건 이상 (현재 1 + 이전 12)

데이터 < 13건인 경우:
  - L1/L3 판정 불가 → 스킵
  - L2 단독 체크만 수행

i < 12 (baseline 구간):
  - rolling window 기준 데이터 → 정상 처리
  - v_status = 0 → 1 전이
```

### 탐지 결과 저장

```
이상치 탐지된 경우 → outlier_results 테이블 INSERT
  · std_id, layer, detected_value, threshold, severity
  · z_score, yoy_roc, intensity_deviation

이상치 여부 무관하게 → standardized_data.v_status = 0 → 1
(최종 v_status 결정은 STAGE 4에서 수행)
```

### 탐지 완료 후 자동 동작

```
detect_outliers() 완료
    └──► verify_evidence_data() 자동 호출 (STAGE 4)
              → v_status 최종 결정 (1 → 2/3/4/5)
```

### 관련 DB 테이블

| 읽기 | 쓰기 |
|------|------|
| `standardized_data` (v_status=0) | `standardized_data` (v_status 업데이트) |
| `activity_data` | `outlier_results` |
| `threshold_limits` | `audit_trail` |

---

## 7. STAGE 4 — 증빙 정합성 검증 및 v_status 최종 결정

### 담당 모듈
- `app/services/outlier_pipeline/evidence_verification.py`

### API
```
POST /api/v1/evidence/verify   ← 수동 재실행
(통상적으로는 detect_outliers 완료 후 자동 호출됨)
```

### 핵심 로직

#### STEP 1 — 매칭 키
```
evidence_usage (site_id, metric_name, reporting_date)
    ↔ standardized_data (site_id, metric_name, reporting_date, v_status=1)
```

#### STEP 2 — gap 계산
```python
gap_value   = DB값 - OCR값
gap_percent = |gap_value| / DB값 × 100

# 예시:
# DB값=1,200 MWh, OCR값=1,150 MWh
# gap_percent = |1200-1150| / 1200 × 100 = 4.17%
```

#### STEP 3 — 단위 오류 감지
```python
# 1000배 단위 오기입 의심 (kWh ↔ MWh, Nm3 ↔ kNm3 등)
unit_mismatch = True
  조건: |DB값 × 1000 - OCR값| < 1.0
     또는 |DB값 / 1000 - OCR값| < 1.0
```

#### STEP 4 — result_code 결정 (증빙 비교 결과)

| result_code | 의미 | 조건 |
|:-----------:|------|------|
| **0** | 일치 | `gap_percent == 0.0` (완전 일치) |
| **1** | 불일치 | `gap_percent != 0.0` |
| **2** | 단위 오류 의심 | `unit_mismatch == True` |

> **주의**: 일치 판정은 `gap_percent == 0.0` 완전 일치만 허용합니다. 0.001%라도 차이가 나면 불일치로 처리됩니다.

#### STEP 5 — v_status 최종 결정 (4가지 케이스)

```
outlier_results 존재 여부 (has_outlier) × 증빙 일치 여부 (evidence_match)

┌──────────────┬───────────────┬───────────────┐
│              │  증빙 일치     │  증빙 불일치   │
├──────────────┼───────────────┼───────────────┤
│ 이상치 없음   │ v_status = 5  │ v_status = 2  │
│ (PASS)       │ 자동 확정 ✅   │ 조치 필요 ⚠️  │
├──────────────┼───────────────┼───────────────┤
│ 이상치 있음   │ v_status = 3  │ v_status = 4  │
│ (FAIL)       │ 소명 필요 ⚠️  │ 긴급 조치 🚨  │
└──────────────┴───────────────┴───────────────┘
```

### 관련 DB 테이블

| 읽기 | 쓰기 |
|------|------|
| `evidence_usage` | `verification_logs` |
| `standardized_data` (v_status=1) | `standardized_data` (v_status 업데이트) |
| `outlier_results` | `raw_ocr_data` (processing_status→Success) |
| `raw_ocr_data` | `audit_trail` |

---

## 8. STAGE 5 — AI 진단 (GPT-4o)

### 담당 모듈
- `app/services/outlier_pipeline/outlier_llm.py`

### API
```
POST /api/v1/outliers/analyze
Body (선택): {"outlier_id": 123}   ← 특정 건만 처리
```

### 처리 대상
`outlier_results.analysis_summary IS NULL` 인 레코드
(이미 진단된 건은 재실행하지 않음)

### 스킵 조건
- `v_status = 5` (이미 자동 확정된 데이터)
- `standardized_data` 레코드 없음

### 케이스별 프롬프트 분기

| v_status | 상황 설명 | 진단 포커스 |
|:---:|---|---|
| **2** | 이상치 없음 + 증빙 불일치 | DB값 vs OCR값 중 어느 쪽이 맞는지 판별. 수동 입력 오류 또는 OCR 오류 가능성 분석 |
| **3** | 이상치 있음 + 증빙 일치 | 실제 이상 소비가 발생한 원인 분석. 설비 교체, 공정 변경, 특수 운영 상황 추정 |
| **4** | 이상치 있음 + 증빙 불일치 | 가장 심각한 케이스. 실제 이상 현상 + 입력 오류 복합 가능성 분석 |

### AI 진단 출력 형식

```json
{
    "이상치_식별자": "삼성물산_2024-01-01_전력사용량",
    "위험_등급": "Critical / Major / Warning",
    "진단_요약": "현장 담당자용 핵심 메시지 (1~2문장)",
    "판단_근거_및_해설": "L1/L2/L3 탐지 결과를 비즈니스 언어로 설명",
    "추론_가설": "데이터 오기입 또는 현장 이슈 원인 추정",
    "현장_체크리스트": [
        "점검항목 1",
        "점검항목 2",
        "점검항목 3"
    ]
}
```

> AI 진단은 **v_status를 변경하지 않습니다**. 순수하게 `outlier_results.analysis_summary`만 업데이트합니다.

---

## 9. STAGE 6 — 소명 처리

### 담당 모듈
- `app/services/outlier_pipeline/outlier_management.py`

### API
```
POST /api/v1/outliers/{std_id}/justify
Body:
{
    "user_feedback": "설비 정기 점검으로 인한 일시적 증가입니다.",
    "action_taken":  "정상"    ← 또는 "수정", "확인중" 등
}
```

### 소명 가능 대상

| v_status | 상황 | 소명 내용 |
|:---:|---|---|
| **2** | 이상치 없음 + 증빙 불일치 | DB값이 맞는지, OCR값이 맞는지 확인 후 소명 |
| **3** | 이상치 있음 + 증빙 일치 | 이상치 원인 소명 (데이터 수정 불가) |
| **4** | 이상치 있음 + 증빙 불일치 | 이상 원인 소명 (OCR값으로 자동 수정 진행) |

### action_taken 값에 따른 처리

```
action_taken == "정상"
  → justification_logs INSERT
  → standardized_data.v_status = 1 (재검증 트리거)
  → outlier_results.is_resolved = True
  → audit_trail 기록

action_taken != "정상" (예: "수정 예정", "확인중")
  → justification_logs INSERT
  → v_status 유지 (최종 확정은 /finalization 에서)
  → outlier_results.is_resolved = True
  → audit_trail 기록
```

### 관련 DB 테이블

| 읽기 | 쓰기 |
|------|------|
| `standardized_data` | `justification_logs` |
| `outlier_results` | `standardized_data` (v_status, action='정상'일 때) |
| | `outlier_results` (is_resolved=True) |
| | `audit_trail` |

---

## 10. STAGE 7 — 최종 확정 및 취소

### 담당 모듈
- `app/services/outlier_pipeline/data_finalization.py`

### API
```
POST /api/v1/finalization/{std_id}         ← 최종 확정
POST /api/v1/finalization/{std_id}/revert  ← 확정 취소
GET  /api/v1/finalization/{std_id}/history ← 이력 조회
```

### 최종 확정 처리 흐름

```
STEP 1: standardized_data 현재 상태 스냅샷
  - before_value, before_status 저장

STEP 2: standardized_data 업데이트
  - original_value = 이전 value (최초 원본 보존)
  - value = corrected_value (수정값, 변경 없으면 기존값 그대로)
  - v_status = 5 (Verified)
  - updated_by = user_id
  - correction_reason = reason

STEP 3: audit_trail 기록
  - 기록 실패 시 STEP 2 자동 롤백 시도
```

### 확정 취소 (revert)

```
STEP 1: v_status=5 인지 검증
STEP 2: original_value 존재 여부 확인
STEP 3: audit_trail에서 직전 FINALIZE 액션의 before_status 복원
STEP 4: value = original_value 복원
        v_status = 직전 상태 (audit_trail 기록 기반)
```

> **주의**: `original_value`가 없으면 취소가 불가능합니다. 반드시 값 확인 후 확정하세요.

### 관련 DB 테이블

| 읽기 | 쓰기 |
|------|------|
| `standardized_data` | `standardized_data` (value, original_value, v_status) |
| `audit_trail` (revert 시) | `audit_trail` |

---

## 11. v_status별 사용자 조치 가이드

### v_status = 1 (Standardized)
> **상황**: 표준화 완료. 이상치 탐지 대기 중인 정상적인 초기 상태

| 항목 | 내용 |
|------|------|
| 원인 | 표준화(매핑) 완료 직후의 정상 상태 |
| 필요 조치 | `POST /api/v1/outliers/detect` 실행 → 탐지 + 증빙 검증 자동 수행 |

---

### v_status = 2 (PASS + 불일치)
> **상황**: 이상치 없음. 그런데 DB값과 OCR 증빙값이 다름

```
진단 요약: 통계적으로는 정상이나, 입력값 또는 OCR 인식에 오류가 있을 가능성
```

| 체크 순서 | 조치 |
|----------|------|
| 1. AI 진단 확인 | `POST /api/v1/outliers/analyze` → analysis_summary 참고 |
| 2. 원본 문서 대조 | DB값 vs OCR값 중 어느 쪽이 정확한지 육안 확인 |
| 3-A. DB값이 맞는 경우 | `POST /api/v1/outliers/{std_id}/justify`<br>`action_taken: "정상"` → 소명 후 v_status=1 전환 |
| 3-B. OCR값이 맞는 경우 | `POST /api/v1/finalization/{std_id}`<br>`corrected_value: {OCR값}` → 값 수정 + 확정 |
| 3-C. 불명확한 경우 | 소명(`action_taken: "확인중"`)으로 기록 후 보류 |

---

### v_status = 3 (FAIL + 일치)
> **상황**: 이상치 탐지됨. DB값과 OCR 증빙값은 같음 → 실제 이상 소비 가능성

```
진단 요약: 데이터는 맞을 가능성이 높음. 이상 소비의 원인을 소명해야 함
데이터 수정 불가 (DB값 = 증빙값 = 실제값)
```

| 체크 순서 | 조치 |
|----------|------|
| 1. AI 진단 확인 | `POST /api/v1/outliers/analyze` → 현장 체크리스트 참고 |
| 2. 현장 확인 | 설비 교체, 공정 변경, 야간작업 증가 등 확인 |
| 3. 소명 제출 | `POST /api/v1/outliers/{std_id}/justify`<br>`user_feedback: "설비 교체로 인한 일시적 증가"`<br>`action_taken: "이상치 원인 확인"` |
| 4. 최종 확정 | `POST /api/v1/finalization/{std_id}`<br>`corrected_value: {기존값 그대로}` |

---

### v_status = 4 (FAIL + 불일치) 🚨 가장 심각
> **상황**: 이상치 탐지 + DB값과 OCR 증빙값도 다름 → 실제 이상 + 입력 오류 복합 가능성

```
진단 요약: 데이터 오류 가능성 + 실제 현장 이상 가능성 모두 존재. 우선 순위 최고
```

| 체크 순서 | 조치 |
|----------|------|
| 1. AI 진단 확인 | `POST /api/v1/outliers/analyze` → 위험 등급, 추론 가설 우선 확인 |
| 2. 단위 오류 여부 | `verification_logs.unit_mismatch` 확인<br>True이면 kWh↔MWh 오기입 확인 |
| 3. 원본 문서 대조 | 실제 청구서와 DB 입력값 비교 |
| 4-A. 단순 입력 오류 | `POST /api/v1/finalization/{std_id}`<br>`corrected_value: {OCR값 또는 정확한 값}` |
| 4-B. 실제 이상 소비 | 소명 제출 후 → 최종 확정 |
| 4-C. 불명확 | `action_taken: "긴급 조사 중"` 으로 소명 기록 후 보류 |

---

### v_status = 5 (Verified)
> **상황**: 최종 확정 완료. SR 보고서에 사용 가능한 데이터

| 항목 | 내용 |
|------|------|
| 정상 상태 | 추가 조치 불필요 |
| 취소 필요 시 | `POST /api/v1/finalization/{std_id}/revert`<br>→ `original_value`로 복원, 이전 v_status로 되돌아감 |

---

### v_status = 99 (Unit Error)
> **상황**: 매핑 시 단위 변환 실패. 파이프라인에서 제외됨

| 항목 | 내용 |
|------|------|
| 원인 | `UNIT_CONVERSION` 테이블에 없는 단위 조합 |
| 필요 조치 | 1. `standardized_data`에서 해당 레코드 확인 |
| | 2. 단위 정보 수동 보정 후 mapping 재실행 |
| | 3. 또는 `data_points.unit` 수정 후 재매핑 |

---

## 12. API 엔드포인트 요약

### 파이프라인 실행 순서

```
1. POST /api/v1/raw-data/upload              ← 원본 CSV/Excel 업로드
2. POST /api/v1/evidence/upload-ocr          ← 증빙 이미지/PDF OCR
3. POST /api/v1/evidence/extract             ← OCR → evidence_usage 적재
4. POST /api/v1/outliers/detect              ← 이상치 탐지 (증빙 검증 자동 포함)
5. POST /api/v1/outliers/analyze             ← AI 진단 (선택)
6. POST /api/v1/outliers/{std_id}/justify    ← 소명 처리 (v_status=2/3/4인 경우)
7. POST /api/v1/finalization/{std_id}        ← 최종 확정
```

### 조회 및 모니터링

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/v1/dashboard/` | 전체 표준화 데이터 현황 |
| `GET /api/v1/dashboard/status-summary` | v_status별 건수 집계 |
| `GET /api/v1/dashboard/outlier-pending` | 소명 대기 이상치 목록 |
| `GET /api/v1/outliers/{std_id}` | 특정 데이터의 이상치·소명 상세 |
| `GET /api/v1/finalization/{std_id}/history` | 수정 이력 조회 |
| `GET /api/v1/audit/` | 전체 감사 로그 |
| `GET /api/v1/audit/summary` | 액션 타입별 집계 |
| `GET /api/v1/audit/{std_id}` | 특정 데이터 변경 이력 |

---

## 부록 — 자주 묻는 질문

**Q. detect 실행 시 일부 데이터가 "스킵"되었습니다.**
A. 해당 `(site_id, metric_name)` 조합의 이력이 13건 미만이면 L1/L3 분석이 스킵됩니다. L2(절대 임계값) 체크는 별도로 수행됩니다. 이력 데이터가 쌓이면 자동으로 전체 분석이 가능해집니다.

**Q. 증빙 검증 결과가 항상 불일치(gap_percent > 0)로 나옵니다.**
A. 일치 판정은 `gap_percent == 0.0` 완전 일치만 허용합니다. 소수점 오차라도 불일치로 처리됩니다. 단위 변환 차이(예: 반올림)가 원인일 수 있으니 `unit_mismatch` 여부를 우선 확인하세요.

**Q. AI 진단(analyze)을 실행했는데 "새로운 데이터 없음"이 나옵니다.**
A. `outlier_results.analysis_summary`가 이미 채워진 경우 재실행하지 않습니다. 재분석이 필요하면 DB에서 `analysis_summary = NULL` 로 초기화 후 재실행하세요.

**Q. 최종 확정(v_status=5)을 취소하려면?**
A. `POST /api/v1/finalization/{std_id}/revert` 를 호출하세요. `original_value`가 저장되어 있어야만 복원 가능합니다. `original_value`가 없는 경우 취소가 불가능합니다.
