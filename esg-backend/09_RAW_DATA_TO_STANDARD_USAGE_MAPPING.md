# 📊 raw_data → standard_usage 직접 추출

**목적:** 팀원이 이해하고 로직을 만들기 위한 데이터 흐름 및 테이블 구조  
**대상:** raw_data 테이블 + data_points 테이블 → standard_usage 테이블

---

## 🔄 **1단계: 입력 데이터 (raw_data + data_points)**

### **raw_data 테이블 구조**

```sql
CREATE TABLE raw_data (
    id BIGSERIAL PRIMARY KEY,
    
    -- 필수 식별자
    site_id VARCHAR(50) NOT NULL,           -- "Site A", "Site B"
    reporting_date DATE NOT NULL,           -- "2026-03-10"
    
    -- 측정 데이터
    raw_value TEXT NOT NULL,                -- "1,200", "88500", "1.2E+3"
    unit VARCHAR(20),                       -- "MWh", "Nm3", "Ton"
    metric_type VARCHAR(50),                -- "electricity", "lng", "production"
    
    -- 메타데이터
    source_file VARCHAR(255),               -- "site_a_march_2026.csv"
    
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **data_points 테이블 구조 (매핑용)**

```sql
CREATE TABLE data_points (
    id BIGSERIAL PRIMARY KEY,
    
    metric_type VARCHAR(50) NOT NULL,       -- raw_data의 metric_type과 매칭
    metric_name VARCHAR(50) NOT NULL,       -- "electricity", "lng", "production"
    unit VARCHAR(20),                       -- "MWh", "Nm3", "Ton"
    
    UNIQUE(metric_type, metric_name)
);
```

### **입력 데이터 샘플**

#### **raw_data 샘플**

```
id    │ site_id │ reporting_date │ raw_value  │ unit │ metric_type │ source_file          │ confidence_score
──────┼─────────┼────────────────┼────────────┼──────┼─────────────┼──────────────────────┼──────────────────
5001  │ Site A  │ 2026-03-10     │ "1,200"    │ MWh  │ electricity │ site_a_march.csv     │ 0.98
5002  │ Site A  │ 2026-03-10     │ "88,500"   │ Nm3  │ lng         │ site_a_march.csv     │ 0.95
5003  │ Site A  │ 2026-03-10     │ "102"      │ Ton  │ production  │ site_a_march.csv     │ 0.99
5004  │ Site B  │ 2026-03-10     │ "950"      │ MWh  │ electricity │ site_b_march.csv     │ 0.92
5005  │ Site B  │ 2026-03-10     │ "75,000"   │ Nm3  │ lng         │ site_b_march.csv     │ 0.88
```

#### **data_points 샘플 (참조용)**

```
id │ metric_type │ metric_name │ unit
───┼─────────────┼─────────────┼──────
10 │ electricity │ electricity │ MWh
11 │ lng         │ lng         │ Nm3
12 │ production  │ production  │ Ton
```

---

## 📤 **2단계: 출력 데이터 (standard_usage)**

### **standard_usage 테이블 구조 (최종 버전)**

```sql
CREATE TABLE standard_usage (
    -- ════════════════════════════════════════════════════════════
    -- PRIMARY KEY
    -- ════════════════════════════════════════════════════════════
    id BIGSERIAL PRIMARY KEY,
    
    -- ════════════════════════════════════════════════════════════
    -- 비즈니스 키 (유니크 제약)
    -- ════════════════════════════════════════════════════════════
    site_id VARCHAR(50) NOT NULL,
    reporting_date DATE NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    
    UNIQUE (site_id, reporting_date, metric_name),
    
    -- ════════════════════════════════════════════════════════════
    -- 측정 데이터 (필수)
    -- ════════════════════════════════════════════════════════════
    unit VARCHAR(20) NOT NULL,
    value DOUBLE PRECISION NOT NULL,        -- 변환된 숫자값
    
    -- ════════════════════════════════════════════════════════════
    -- 검증 상태
    -- ════════════════════════════════════════════════════════════
    v_status INT DEFAULT 0 NOT NULL,
    CHECK (v_status >= 0 AND v_status <= 5),
    -- 0: Pending, 1: Normal, 2: Outlier, 3: Mismatch, 4: Unit Error, 5: Verified
    
    -- ════════════════════════════════════════════════════════════
    -- 수치 보정 추적
    -- ════════════════════════════════════════════════════════════
    original_value DOUBLE PRECISION,        -- 보정 전 원본값 (NULL 가능)
    
    -- ════════════════════════════════════════════════════════════
    -- 표준화 메타데이터 (raw_data 연계)
    -- ════════════════════════════════════════════════════════════
    raw_data_id BIGINT,
    FOREIGN KEY (raw_data_id) REFERENCES raw_data(id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    
    raw_value_text TEXT,                    -- 원본 TEXT 값 보존 ("1,200")
    
    standardization_confidence FLOAT,
    CHECK (standardization_confidence BETWEEN 0 AND 1 OR standardization_confidence IS NULL),
    
    source_file VARCHAR(255),               -- raw_data.source_file 복사
    
    -- ════════════════════════════════════════════════════════════
    -- 감사 추적
    -- ════════════════════════════════════════════════════════════
    audit_trail_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    correction_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- ════════════════════════════════════════════════════════════
    -- 인덱스
    -- ════════════════════════════════════════════════════════════
    INDEX idx_site_date (site_id, reporting_date),
    INDEX idx_v_status (v_status),
    INDEX idx_raw_data_id (raw_data_id),
    INDEX idx_created_at (created_at)
);
```

### **출력 데이터 샘플 (standard_usage)**

```
id │ site_id │ reporting_date │ metric_name │ unit │ value  │ v_status │ raw_data_id │ raw_value_text │ standardization_confidence │ source_file
───┼─────────┼────────────────┼─────────────┼──────┼────────┼──────────┼─────────────┼────────────────┼────────────────────────────┼──────────────────────
1  │ Site A  │ 2026-03-10     │ electricity │ MWh  │ 1200.0 │ 0        │ 5001        │ "1,200"        │ 0.98                       │ site_a_march.csv
2  │ Site A  │ 2026-03-10     │ lng         │ Nm3  │ 88500  │ 0        │ 5002        │ "88,500"       │ 0.95                       │ site_a_march.csv
3  │ Site A  │ 2026-03-10     │ production  │ Ton  │ 102    │ 0        │ 5003        │ "102"          │ 0.99                       │ site_a_march.csv
4  │ Site B  │ 2026-03-10     │ electricity │ MWh  │ 950    │ 0        │ 5004        │ "950"          │ 0.92                       │ site_b_march.csv
5  │ Site B  │ 2026-03-10     │ lng         │ Nm3  │ 75000  │ 0        │ 5005        │ "75,000"       │ 0.88                       │ site_b_march.csv
```

---

## 🔀 **3단계: 변환 규칙 (팀원이 구현할 로직)**

### **매핑 규칙**

```
raw_data          →  standard_usage
──────────────────────────────────
site_id           →  site_id                (그대로 복사)
reporting_date    →  reporting_date         (그대로 복사)
raw_value         →  value (+ raw_value_text) (TEXT → FLOAT 변환)
unit              →  unit                   (그대로 복사)
metric_type       →  metric_name            (data_points.metric_name으로 매칭)
confidence_score  →  standardization_confidence (그대로 복사)
source_file       →  source_file            (그대로 복사)
id                →  raw_data_id            (FK로 저장)

고정값:
v_status          =  0                      (항상 0, Pending 상태)
created_at        =  NOW()                  (현재 시간)
updated_at        =  NOW()                  (현재 시간)
updated_by        =  "system:raw_import"    (시스템 태깅)
```

### **TEXT → FLOAT 변환 규칙**

```python
입력: raw_data.raw_value (TEXT)
규칙:
  1. 쉼표 제거:    "1,200" → "1200"
  2. 공백 제거:    "1 200" → "1200"
  3. FLOAT 변환:   "1200" → 1200.0
  4. 저장:
     - standard_usage.value = 1200.0 (DOUBLE PRECISION)
     - standard_usage.raw_value_text = "1,200" (원본 TEXT 보존)

예외 처리:
  - 변환 실패 ("INVALID", "N/A", "오류") → 스킵, 로그 기록
```

---

## 📋 **4단계: 컬럼별 매핑 상세**

### **컬럼별 상세 정의**

| standard_usage 컬럼 | 타입 | 필수 | 출처 | 변환 규칙 |
|-------------------|------|------|------|---------|
| `id` | BIGSERIAL | ✅ | 자동 | 자동 증가 |
| `site_id` | VARCHAR(50) | ✅ | raw_data.site_id | 그대로 |
| `reporting_date` | DATE | ✅ | raw_data.reporting_date | 그대로 |
| `metric_name` | VARCHAR(50) | ✅ | data_points.metric_name | raw_data.metric_type으로 JOIN |
| `unit` | VARCHAR(20) | ✅ | raw_data.unit | 그대로 |
| `value` | DOUBLE PRECISION | ✅ | raw_data.raw_value | TEXT → FLOAT (쉼표 제거) |
| `v_status` | INT | ✅ | 고정 | 항상 0 |
| `original_value` | DOUBLE PRECISION | ❌ | - | NULL (초기) |
| `raw_data_id` | BIGINT | ❌ | raw_data.id | 그대로 (FK) |
| `raw_value_text` | TEXT | ❌ | raw_data.raw_value | 원본 보존 ("1,200") |
| `standardization_confidence` | FLOAT | ❌ | raw_data.confidence_score | 그대로 |
| `source_file` | VARCHAR(255) | ❌ | raw_data.source_file | 그대로 |
| `audit_trail_ids` | BIGINT[] | ❌ | - | {} (빈 배열) |
| `updated_by` | TEXT | ❌ | 고정 | "system:raw_import" |
| `updated_at` | TIMESTAMP | ❌ | 고정 | NOW() |
| `correction_reason` | TEXT | ❌ | - | NULL (초기) |
| `created_at` | TIMESTAMP | ❌ | 고정 | NOW() |

---

## ✅ **5단계: 제약조건 정의**

### **제약조건 목록**

```sql
-- 1️⃣ PRIMARY KEY
PRIMARY KEY (id)
└─ 자동 증가하는 고유 ID

-- 2️⃣ UNIQUE 제약 (비즈니스 키)
UNIQUE (site_id, reporting_date, metric_name)
└─ 같은 사업장, 날짜, 지표의 데이터는 최대 1개만

-- 3️⃣ NOT NULL 제약
site_id NOT NULL
reporting_date NOT NULL
metric_name NOT NULL
unit NOT NULL
value NOT NULL
v_status NOT NULL
├─ 이 필드들이 없으면 raw_data 또는 data_points가 잘못됨

-- 4️⃣ CHECK 제약
CHECK (v_status >= 0 AND v_status <= 5)
├─ v_status는 0~5 범위만 허용

CHECK (standardization_confidence BETWEEN 0 AND 1 OR standardization_confidence IS NULL)
├─ 신뢰도는 0~1 사이이거나 NULL만 허용

-- 5️⃣ FOREIGN KEY
FOREIGN KEY (raw_data_id) REFERENCES raw_data(id) 
    ON DELETE CASCADE      -- raw_data 삭제 시 자동 삭제
    ON UPDATE CASCADE      -- raw_data 업데이트 시 자동 반영
```

---

## 🔍 **6단계: 데이터 로딩 조건 (팀원 체크리스트)**

### **로딩 체크리스트**

```
각 raw_data 행에 대해 다음을 확인:

□ site_id가 NULL이 아닌가?
□ reporting_date가 NULL이 아닌가? (유효한 DATE 형식?)
□ raw_value가 NULL이 아닌가?
□ unit이 NULL이 아닌가? (또는 data_points.unit과 일치?)
□ metric_type이 data_points에 존재하는가?
  └─ data_points 테이블에서 metric_type을 metric_name으로 매칭

✅ 모두 만족 → standard_usage INSERT
❌ 하나라도 불만족 → 스킵하고 로그 기록
```

### **마이그레이션 로직 (의사코드)**

```python
for each row in raw_data:
    try:
        # 1. 필수 필드 검증
        if row.site_id is NULL or row.reporting_date is NULL:
            log.warning(f"필수 필드 누락: {row.id}")
            continue
        
        # 2. metric_type → metric_name 매칭
        data_point = find_data_point(row.metric_type)
        if data_point is NULL:
            log.warning(f"data_point 매칭 실패: {row.metric_type}")
            continue
        
        # 3. TEXT → FLOAT 변환
        cleaned_value = row.raw_value.replace(",", "").strip()
        value = float(cleaned_value)
        
        # 4. 중복 체크
        existing = find_by_unique_key(
            site_id=row.site_id,
            reporting_date=row.reporting_date,
            metric_name=data_point.metric_name
        )
        
        if existing:
            # UPDATE (메타데이터만)
            update_record(existing.id, {
                "raw_data_id": row.id,
                "raw_value_text": row.raw_value,
                "standardization_confidence": row.confidence_score,
                "source_file": row.source_file
            })
        else:
            # INSERT (신규)
            insert_record({
                "site_id": row.site_id,
                "reporting_date": row.reporting_date,
                "metric_name": data_point.metric_name,
                "unit": row.unit,
                "value": value,
                "v_status": 0,  # 항상 0
                "raw_data_id": row.id,
                "raw_value_text": row.raw_value,
                "standardization_confidence": row.confidence_score,
                "source_file": row.source_file,
                "updated_by": "system:raw_import",
                "created_at": NOW(),
                "updated_at": NOW()
            })
        
        log.info(f"로드 성공: {row.site_id}/{data_point.metric_name}/{row.reporting_date}")
        
    except ValueError as e:
        log.error(f"값 변환 실패 {row.id}: {row.raw_value}")
        continue
    except Exception as e:
        log.error(f"처리 오류 {row.id}: {e}")
        continue
```

---

## 📊 **7단계: 처리 결과 예시**

### **입력 → 출력 변환 예시**

#### **예시 1: 정상 데이터**

```
입력:
  raw_data.id: 5001
  raw_data.site_id: "Site A"
  raw_data.reporting_date: "2026-03-10"
  raw_data.raw_value: "1,200"
  raw_data.unit: "MWh"
  raw_data.metric_type: "electricity"
  raw_data.confidence_score: 0.98
  raw_data.source_file: "site_a_march.csv"

처리:
  1. metric_type "electricity" → data_points에서 metric_name "electricity" 찾기
  2. "1,200" → 1200.0 변환
  3. 중복 체크: (Site A, 2026-03-10, electricity) 없음
  4. INSERT

출력:
  standard_usage:
    id: 1
    site_id: "Site A"
    reporting_date: "2026-03-10"
    metric_name: "electricity"
    unit: "MWh"
    value: 1200.0
    v_status: 0
    raw_data_id: 5001
    raw_value_text: "1,200"
    standardization_confidence: 0.98
    source_file: "site_a_march.csv"
    created_at: 2026-03-15 10:30:00
    updated_at: 2026-03-15 10:30:00
    updated_by: "system:raw_import"
```

#### **예시 2: 데이터 불완전**

```
입력:
  raw_data.id: 9999
  raw_data.site_id: NULL              ← ❌ 필수 필드 누락
  raw_data.reporting_date: "2026-03-10"
  raw_data.raw_value: "500"
  raw_data.metric_type: "electricity"

처리:
  1. site_id 체크 → NULL 발견
  2. 스킵

로그:
  [SKIP] raw_data.id=9999: 필수 필드 누락 (site_id=NULL)

출력:
  (적재 안됨)
```

#### **예시 3: metric_type 매칭 실패**

```
입력:
  raw_data.id: 8888
  raw_data.site_id: "Site A"
  raw_data.reporting_date: "2026-03-10"
  raw_data.raw_value: "300"
  raw_data.metric_type: "unknown_metric"  ← ❌ data_points에 없음

처리:
  1. metric_type "unknown_metric" 찾기
  2. data_points에 없음
  3. 스킵

로그:
  [SKIP] raw_data.id=8888: data_point 매칭 실패 (metric_type=unknown_metric)

출력:
  (적재 안됨)
```

#### **예시 4: 값 변환 실패**

```
입력:
  raw_data.id: 7777
  raw_data.site_id: "Site A"
  raw_data.reporting_date: "2026-03-10"
  raw_data.raw_value: "INVALID"       ← ❌ 숫자 아님
  raw_data.metric_type: "electricity"

처리:
  1. "INVALID".replace(",", "") → "INVALID"
  2. float("INVALID") → ValueError
  3. 스킵

로그:
  [ERROR] raw_data.id=7777: 값 변환 실패 ("INVALID")

출력:
  (적재 안됨)
```

---

## 🎯 **8단계: 최종 체크리스트 (팀원용)**

### **구현 전 확인사항**

```
□ raw_data 테이블 구조 최종 확인
  └─ site_id, reporting_date, raw_value, unit, metric_type, confidence_score 존재?

□ data_points 테이블 구조 최종 확인
  └─ metric_type과 metric_name의 대응관계 명확?

□ standard_usage 테이블 생성
  └─ 위의 스키마 그대로 사용

□ 데이터 로딩 로직 구현
  └─ 변환 규칙: TEXT → FLOAT (쉼표 제거)
  └─ 중복 처리: UNIQUE 제약에 따라 INSERT or UPDATE
  └─ 에러 처리: 스킵 + 로그

□ 검증 쿼리 준비
  └─ raw_data 행 수 vs standard_usage v_status=0 행 수 비교
  └─ NULL 체크
  └─ 값 범위 체크
```

### **운영 중 모니터링**

```
매일 확인:
  □ 로드된 행 개수: INSERT한 행
  □ 스킵된 행 개수: 조건 불만족
  □ 오류 로그: 변환 실패 항목

주간 보고:
  □ 신뢰도 분포: 0.8 이상 비율
  □ 스킵 비율: 정상 범위?
  □ 이상치 탐지 결과: v_status 분포
```

---

## 📝 **핵심 요약**

```
raw_data (팀원이 수집)
    ↓
[로직: raw_data.id 반복]
  ├─ 필수 필드 검증
  ├─ metric_type → metric_name 매칭
  ├─ raw_value TEXT → FLOAT 변환 (쉼표 제거)
  ├─ UNIQUE 중복 체크
  └─ INSERT or UPDATE
    ↓
standard_usage (v_status=0)
    ↓
[우리의 파이프라인]
  outlier_detection → outlier_llm → evidence_verification ...
```

