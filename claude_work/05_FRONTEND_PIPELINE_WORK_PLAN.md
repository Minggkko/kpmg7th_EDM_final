# 🔧 앞단 파이프라인 모듈화 작업 계획

**목표:** Jupyter Notebook → 프로덕션급 Python 모듈로 전환  
**기간:** 약 4~5일  
**모듈 개수:** 4개  
**최종 상태:** backend_modules에 4개 새로운 파일 추가

---

## 📊 **최종 파이프라인 구조**

```
초기 데이터 (v_status=0)
    ↓
[1️⃣ outlier_detection.py]
   이상치 탐지 (L1/L2/L3)
   → outlier_results INSERT
   → v_status: 0 → 1 (정상) or 2 (이상치)
    ↓
[2️⃣ outlier_llm.py]
   AI 분석 (GPT-4o 활용)
   → outlier_results.analysis_summary UPDATE
   → v_status 변경 없음
    ↓
[3️⃣ evidence_extraction.py]
   증빙 자료 추출 (OCR 파싱)
   → evidence_usage INSERT
   → v_status 변경 없음
    ↓
[4️⃣ evidence_verification.py]
   정합성 확인 (DB vs OCR 비교)
   → verification_logs INSERT
   → v_status: 1 → 3 (불일치) / 4 (단위오류) / 5 (정상)
    ↓
[기존] outlier_management.py
   소명 처리
   → v_status: 2 → 1 (소명 완료)
    ↓
[기존] data_finalization.py
   수치 수정
   → v_status: 3, 4 → 5 (최종 확정)
```

---

## 🎯 **작업 순서 (MUST DO)**

### **Phase 1: 분석 & 설계 (Day 1 오전)**

#### Step 1-1: Notebook 분석
```
작업: 3개 Notebook 상세 분석
├─ 3_outlier_detect.ipynb 분석
│  ├─ L1 계산 로직 (Z-Score, YoY)
│  ├─ L2 계산 로직 (임계치)
│  ├─ L3 계산 로직 (원단위 편차)
│  ├─ 이상치 판정 로직
│  └─ Severity 판정 로직
│
├─ 4_outlier_llm.ipynb 분석
│  ├─ GPT-4o 호출 방식
│  ├─ 프롬프트 구성
│  ├─ 응답 처리
│  └─ analysis_summary 저장
│
├─ 5_evidence_data_upload.ipynb 분석
│  ├─ raw_ocr_data JSON 구조
│  ├─ 파일명 패턴
│  ├─ 데이터 정규화
│  └─ evidence_usage INSERT
│
└─ 6_standard_evidence_check.ipynb 분석
   ├─ DB값 vs OCR값 비교
   ├─ gap_percent 계산
   ├─ result_code 판정
   ├─ unit_mismatch 감지
   └─ v_status 자동 전이
```

#### Step 1-2: 함수 설계
```
각 모듈별로 필요한 함수 설계
├─ outlier_detection.py
│  └─ detect_outliers(site_id, metric_name, thresholds)
│
├─ outlier_llm.py
│  └─ analyze_outlier_with_llm(outlier_id, outlier_data)
│
├─ evidence_extraction.py
│  └─ extract_and_upload_evidence(file_path, site_id, reporting_date)
│
└─ evidence_verification.py
   └─ verify_evidence_data(std_id, gap_percent_threshold)
```

---

### **Phase 2: 모듈 개발 (Day 1~3)**

#### Step 2-1: outlier_detection.py (Day 1)
```
작업:
1. database_utils 임포트
2. 12개월 데이터 조회 로직
3. L1 계산 함수 (Z-Score, YoY)
4. L2 계산 함수 (임계치)
5. L3 계산 함수 (원단위 편차)
6. 이상치 판정 로직
7. Severity 판정 로직
8. outlier_results INSERT
9. v_status 자동 전이 (0 → 1 or 2)
10. audit_trail 기록

예상 시간: 8시간
상태 확인:
  □ 함수 작성 완료
  □ 단위 테스트 통과
  □ outlier_results에 데이터 생성됨
  □ v_status 전이 확인
  □ audit_trail에 기록됨
```

#### Step 2-2: outlier_llm.py (Day 1~2)
```
작업:
1. database_utils & audit_trail 임포트
2. outlier_results 데이터 조회
3. 프롬프트 구성 (L1/L2/L3 수치 포함)
4. GPT-4o API 호출
5. 응답 처리
6. analysis_summary UPDATE
7. audit_trail 기록

예상 시간: 4시간
상태 확인:
  □ 함수 작성 완료
  □ GPT-4o 연결 테스트
  □ analysis_summary 업데이트됨
  □ audit_trail에 기록됨
```

#### Step 2-3: evidence_extraction.py (Day 2)
```
작업:
1. database_utils 임포트
2. raw_ocr_data 조회
3. JSON 파싱
4. 숫자 정규화
5. evidence_usage INSERT (metric별 3개 레코드)
6. audit_trail 기록

예상 시간: 5.5시간
상태 확인:
  □ 함수 작성 완료
  □ JSON 파싱 테스트
  □ evidence_usage에 데이터 생성됨
  □ audit_trail에 기록됨
```

#### Step 2-4: evidence_verification.py (Day 2~3)
```
작업:
1. database_utils & audit_trail 임포트
2. standard_usage (v_status=1) 조회
3. evidence_usage 조회 (같은 date+metric)
4. gap_percent 계산
5. result_code 판정 (0/1/2/3)
6. unit_mismatch 감지
7. v_status 자동 전이 (1 → 3/4/5)
8. verification_logs INSERT
9. audit_trail 기록

예상 시간: 8시간
상태 확인:
  □ 함수 작성 완료
  □ gap_percent 계산 검증
  □ result_code 판정 검증
  □ verification_logs에 데이터 생성됨
  □ v_status 자동 전이 확인
  □ audit_trail에 기록됨
```

---

### **Phase 3: 통합 & 검증 (Day 3~4)**

#### Step 3-1: 모듈 통합 테스트
```
작업:
1. __init__.py 업데이트
2. 4개 모듈 동시 임포트 테스트
3. 의존성 확인
4. 함수 연계 테스트

예상 시간: 2시간
상태 확인:
  □ __init__.py 업데이트됨
  □ from backend_modules import * 성공
  □ 순환 참조 없음
```

#### Step 3-2: 전체 파이프라인 테스트
```
작업:
1. 실제 데이터로 전체 흐름 테스트
2. 각 단계별 v_status 확인
3. 각 단계별 audit_trail 확인
4. DB 데이터 정합성 확인

테스트 순서:
  1) outlier_detection 실행
     → outlier_results 생성 확인
     → v_status: 0 → 1 or 2 확인
  
  2) outlier_llm 실행
     → analysis_summary 업데이트 확인
     → v_status 유지 확인
  
  3) evidence_extraction 실행
     → evidence_usage 생성 확인
     → v_status 변경 없음 확인
  
  4) evidence_verification 실행
     → verification_logs 생성 확인
     → v_status: 1 → 3/4/5 확인
  
  5) 기존 모듈들과 연계 테스트
     → outlier_management (v_status=2)
     → data_finalization (v_status=3,4)

예상 시간: 4시간
상태 확인:
  □ 모든 단계 정상 작동
  □ v_status 전이 정확함
  □ 데이터 무결성 유지
```

---

## 📋 **지켜야 하는 규칙**

### **Rule 1: Numpy 타입 변환 (MUST)**
```python
# ❌ 절대 안됨
result = {
    "z_score": numpy_value,          # int64, float64
    "yoy_roc": numpy_value
}

# ✅ 반드시 해야함
result = {
    "z_score": float(numpy_value),   # Python float
    "yoy_roc": float(numpy_value)
}

# ✅ 또는 이렇게
detected_value = float(row['value'])
gap_percent = float(gap_percent)
```

**이유:** Supabase JSON 직렬화 오류 방지

---

### **Rule 2: 모든 변경은 audit_trail 기록 (MUST)**
```python
# ✅ 반드시 이렇게
from .audit_trail import log_action, AuditAction

# outlier_detection에서
log_action(
    std_id=std_id,
    action=AuditAction.DETECT,
    performed_by="system",
    reason=f"L1(Z:{z_score:.1f}), L2(Limit:{threshold})",
    before_status=0,
    after_status=2 if is_outlier else 1
)

# outlier_llm에서
log_action(
    std_id=std_id,
    action=AuditAction.AI_DIAG,
    performed_by="system",
    reason=f"GPT-4o analysis: {summary[:100]}"
)

# evidence_verification에서
log_action(
    std_id=std_id,
    action=AuditAction.VERIFY,
    performed_by="system",
    reason=f"gap:{gap_percent:.2f}%, result_code:{result_code}",
    before_status=1,
    after_status=new_status
)
```

**이유:** 완벽한 감사 추적 + 디버깅

---

### **Rule 3: v_status 전이는 명확한 조건으로 (MUST)**

#### outlier_detection.py
```python
# v_status 전이 규칙
if is_outlier:
    new_v_status = 2  # Outlier
else:
    new_v_status = 1  # Normal
```

#### evidence_verification.py
```python
# v_status 전이 규칙
if unit_mismatch:
    new_v_status = 4  # Unit Error
elif gap_percent >= 5:
    new_v_status = 3  # Mismatch
elif gap_percent >= 1:
    new_v_status = 3  # Mismatch (경고도 불일치로)
else:
    new_v_status = 5  # Verified
```

**이유:** 상태 전이의 일관성 보장

---

### **Rule 4: 에러 처리는 Graceful하게 (MUST)**
```python
# ❌ 안됨
result = client.table("outlier_results").insert(record).execute()

# ✅ 해야함
try:
    result = client.table("outlier_results").insert(record).execute()
    if not result.data:
        return {
            "status": "error",
            "message": "INSERT failed"
        }
except Exception as e:
    logger.error(f"Error: {e}")
    return {
        "status": "error",
        "message": str(e)
    }
```

**이유:** 앱 크래시 방지 + 명확한 에러 메시지

---

### **Rule 5: 함수의 반환 형식은 통일 (MUST)**
```python
# ✅ 모든 함수는 이 형식으로
{
    "status": "success" | "error",
    "data": [...],           # 주요 데이터
    "message": str,          # 설명
    "count": int,            # 처리 건수 (필요시)
}
```

**예시:**
```python
# outlier_detection
{
    "status": "success",
    "data": [{"std_id": 1, "layer": "L1", "severity": "Major"}, ...],
    "message": "5개 이상치 탐지",
    "count": 5
}

# evidence_verification
{
    "status": "success",
    "data": {"std_id": 123, "gap_percent": 0.84, "result_code": 0},
    "message": "정합성 확인 완료"
}
```

---

### **Rule 6: Notebook 코드는 최대한 재사용 (MUST)**
```python
# Notebook에서 이 부분:
for _, row in df.iterrows():
    z_score = abs(val - window.mean()) / window.std()

# 이렇게 함수로 추출:
def calculate_z_score(value, historical_values):
    mean = historical_values.mean()
    std = historical_values.std()
    if std > 0:
        return abs(value - mean) / std
    return 0

# 사용:
z_score = calculate_z_score(val, window)
```

**이유:** 기존 검증된 로직 활용 + 버그 최소화

---

### **Rule 7: 컬럼명은 DB 스키마와 100% 일치 (MUST)**

**standard_usage:**
- `id`, `site_id`, `reporting_date`, `metric_name`, `unit`, `value`, `v_status`
- `original_value`, `updated_by`, `updated_at`, `correction_reason`

**outlier_results:**
- `id`, `std_id`, `site_id`, `layer`, `severity`, `detected_value`, `threshold`
- `z_score`, `yoy_roc`, `intensity_deviation`, `is_resolved`, `analysis_summary`

**evidence_usage:**
- `id`, `site_id`, `reporting_date`, `metric_name`, `unit`, `ocr_value`, `file_name`

**verification_logs:**
- `log_id`, `std_id`, `evidence_id`, `gap_value`, `gap_percent`, `result_code`
- `db_value`, `ocr_value`, `unit_mismatch`, `diagnosis`

```python
# ❌ 틀린 예
record = {
    "outlier_id": 1,      # 잘못된 이름
    "z_score_value": 3.5  # 잘못된 이름
}

# ✅ 맞은 예
record = {
    "std_id": 1,          # 정확한 이름
    "z_score": 3.5        # 정확한 이름
}
```

---

### **Rule 8: 로깅은 명확하게 (SHOULD)**
```python
# ✅ 좋은 예
logger.info(f"[outlier_detection] Site A, electricity: {count}건 탐지")
logger.warning(f"[evidence_verification] std_id={std_id}, gap={gap_percent}%")
logger.error(f"[outlier_llm] GPT-4o API error: {error}")

# ❌ 나쁜 예
print("done")
print(result)
```

---

### **Rule 9: 마이그레이션 전 호환성 (SHOULD)**
```python
# 새 컬럼이 아직 없을 수 있음
try:
    # 새 컬럼 포함해서 시도
    result = client.table("standard_usage").update({
        "z_score": z_score,
        "yoy_roc": yoy_roc,
        "intensity_deviation": intensity_dev
    }).eq("id", std_id).execute()
except:
    # 실패하면 기존 컬럼만 업데이트
    result = client.table("standard_usage").update({
        "v_status": new_status
    }).eq("id", std_id).execute()
```

---

### **Rule 10: 데이터 정합성 확인 (MUST)**
```python
# 각 단계 후 검증
def verify_data_integrity():
    # 1. outlier_detection 후
    outliers = client.table("outlier_results").select("count").execute()
    assert len(outliers.data) > 0, "outlier_results 비어있음"
    
    # 2. evidence_verification 후
    verif = client.table("verification_logs").select("count").execute()
    assert len(verif.data) > 0, "verification_logs 비어있음"
    
    # 3. v_status 전이 확인
    result = client.table("standard_usage").select("v_status").execute()
    statuses = [r["v_status"] for r in result.data]
    assert 1 in statuses or 2 in statuses, "v_status 전이 안됨"
```

---

## 📁 **최종 파일 구조**

```
backend_modules/
├── __init__.py (UPDATE 필수)
├── database_utils.py ✅
├── audit_trail.py ✅
├── outlier_detection.py ✨ NEW
├── outlier_llm.py ✨ NEW
├── evidence_extraction.py ✨ NEW
├── evidence_verification.py ✨ NEW
├── outlier_management.py ✅
├── data_finalization.py ✅
└── verification_dashboard.py ✅
```

---

## ✅ **최종 체크리스트**

### **전체 완료 기준**
- [ ] 4개 모듈 모두 작성 완료
- [ ] __init__.py 업데이트 완료
- [ ] Numpy 타입 변환 완벽히 적용
- [ ] 모든 변경에 audit_trail 기록
- [ ] v_status 전이 규칙 정확함
- [ ] 에러 처리 완벽함
- [ ] 반환 형식 통일됨
- [ ] 컬럼명 100% 일치
- [ ] 단위 테스트 통과
- [ ] 전체 파이프라인 테스트 통과
- [ ] 데이터 정합성 확인됨

---

## 🚀 **시작하기**

**Step 1:** 3개 Notebook 상세 분석 (2시간)

**Step 2:** 4개 모듈 순차 작성 (24시간)
- outlier_detection.py (8h)
- outlier_llm.py (4h)
- evidence_extraction.py (5.5h)
- evidence_verification.py (8h)

**Step 3:** 통합 테스트 (6시간)
- 모듈 통합 테스트 (2h)
- 전체 파이프라인 테스트 (4h)

**총 예상 시간: 32시간 ≈ 4일 (집중 작업 시)**

---

**준비되셨나요?** 🚀

이제 규칙을 지키면서 작업을 진행하겠습니다!

