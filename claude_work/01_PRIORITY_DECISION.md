# 🎯 가장 먼저 해야 할 일 - 우선순위 결정

---

## 🤔 질문: "DB부터 수정하고 생성해야 하나?"

### ❌ **답변: 아니오. DB 마이그레이션은 최후의 공정입니다.**

---

## 📊 **우선순위 순서**

### 1️⃣ **[지금 바로]** 백엔드 함수 개발 (backend_modules/)
**예상 시간:** 1주일  
**난이도:** ★★★  
**왜?** 기존 배치 스크립트의 로직을 그대로 활용 가능

### 2️⃣ **[함수 개발 후]** FastAPI 앱 구축 (main.py)
**예상 시간:** 3-4일  
**난이도:** ★★

### 3️⃣ **[모두 준비 후]** DB 마이그레이션 실행
**예상 시간:** 1시간  
**난이도:** ★

---

## 🔄 **왜 이 순서인가?**

### ❌ DB 먼저 하면 안 되는 이유

```
DB 마이그레이션 실행 → 백엔드 함수 개발 (틀림!)
       ↓
   문제: 새 컬럼들이 생겼는데 
        이를 사용할 코드가 없음
       ↓
   결과: 빈 컬럼만 남겨짐
```

### ✅ 함수 먼저 개발하는 이유

```
백엔드 함수 개발 → DB 마이그레이션 → FE 개발 (맞음!)
       ↓
   1. 함수가 어떤 컬럼을 사용할지 명확함
   2. 필요한 컬럼만 추가됨
   3. 함수의 동작을 즉시 테스트 가능
   4. DB는 준비된 상태에서 마이그레이션
```

---

## 🚀 **지금 당장 할 일 (TODAY)**

### Step 1: backend_modules/ 디렉토리 생성 (5분)
```bash
mkdir -p backend_modules
touch backend_modules/__init__.py
touch backend_modules/database_utils.py
touch backend_modules/outlier_management.py
touch backend_modules/data_finalization.py
touch backend_modules/verification_dashboard.py
touch backend_modules/audit_trail.py
```

### Step 2: database_utils.py 작성 (30분)
```python
# 기본 DB 연결 유틸리티
# - Supabase 클라이언트 초기화
# - 재사용 가능한 쿼리 함수들
```

### Step 3: outlier_management.py 작성 (2시간)
```python
# Module 1: update_outlier_justification()
# - justification_logs 테이블에 기록
# - standard_usage.v_status 업데이트
# - audit_trail 기록
```

### Step 4: data_finalization.py 작성 (3시간)
```python
# Module 2: finalize_usage_data()
# - original_value에 기존값 백업
# - value 업데이트
# - v_status = 5로 설정
# - 트랜잭션 처리
```

### Step 5: verification_dashboard.py 작성 (2시간)
```python
# Module 3: get_verification_dashboard()
# - 복잡한 조인 쿼리
# - 필터링 로직
```

### Step 6: audit_trail.py 작성 (1시간)
```python
# 감사 추적 기록 함수
# - 모든 변경사항 기록
```

---

## 📝 **현재 DB 상태 vs 함수 개발 관계**

### 현재 상태 (마이그레이션 전)
```
standard_usage 테이블
├── id ✓
├── site_id ✓
├── reporting_date ✓
├── metric_name ✓
├── unit ✓
├── value ✓
├── v_status ✓ (이미 있음!)
├── original_value ✗ (아직 없음)
├── updated_by ✗ (아직 없음)
└── updated_at ✗ (아직 없음)
```

### 함수 개발 중에도 동작 가능한가?
**YES!** 다음 방법으로:

#### Option A: 현재 데이터로 먼저 개발
```python
# 기존 컬럼들(id, site_id, value, v_status)만 사용하여 함수 개발
# 나중에 새 컬럼이 추가되면 코드에 추가

def finalize_usage_data(std_id, corrected_value, user_id, reason):
    # 현재는 이렇게
    supabase.table("standard_usage").update({
        "value": corrected_value,
        "v_status": 5
    }).eq("id", std_id).execute()
    
    # 나중에 DB에 새 컬럼이 추가되면 이렇게 수정
    supabase.table("standard_usage").update({
        "original_value": old_value,        # ← 추가됨
        "value": corrected_value,
        "updated_by": user_id,             # ← 추가됨
        "updated_at": "now()",             # ← 추가됨
        "correction_reason": reason,       # ← 추가됨
        "v_status": 5
    }).eq("id", std_id).execute()
```

#### Option B: 로컬 테스트 + 최종 마이그레이션
```
1. 함수 개발 및 테스트 (로컬 환경)
   ↓
2. 단위 테스트 작성 및 검증
   ↓
3. 모든 함수가 완성되면 DB 마이그레이션 실행
   ↓
4. 프로덕션 데이터로 E2E 테스트
```

---

## ✅ **함수 개발 시 참고할 기존 코드**

### 이상치 소명 처리
```
참고: 3_outlier_detect.ipynb
     6_standard_evidence_check.ipynb
로직: v_status 업데이트, 조건부 처리
```

### 수치 보정
```
참고: 6_standard_evidence_check.ipynb
     3_outlier_detect.ipynb
로직: 값 업데이트, 오차율 계산, 상태 판정
```

### 통합 조회
```
참고: 6_standard_evidence_check.ipynb (조인 로직)
     3_outlier_detect.ipynb (필터링)
로직: 여러 테이블 조인, 필터링, 정렬
```

---

## 📅 **구체적인 일정**

| 날짜 | 작업 | 상세 |
|------|------|------|
| **Day 1** | database_utils.py | Supabase 클라이언트, 기본 쿼리 함수 |
| **Day 2** | outlier_management.py | update_outlier_justification() |
| **Day 3-4** | data_finalization.py | finalize_usage_data() + 트랜잭션 |
| **Day 5** | verification_dashboard.py | get_verification_dashboard() + 조인 |
| **Day 6** | audit_trail.py | 감사 추적 기록 |
| **Day 7** | 테스트 & 수정 | 단위 테스트 작성 및 버그 수정 |
| **Day 8** | DB 마이그레이션 | migration_schema_v1.sql 실행 |

---

## 🎯 **DB 마이그레이션 체크리스트**

마이그레이션 전에 다음을 확인하세요:

### ✅ 준비 완료 항목
- [ ] 모든 백엔드 함수가 개발되었는가?
- [ ] 함수들이 어떤 컬럼을 사용하는지 문서화되었는가?
- [ ] 로컬 테스트가 완료되었는가?
- [ ] API 엔드포인트가 정의되었는가?

### ✅ 마이그레이션 실행 전
- [ ] 프로덕션 DB 백업 완료
- [ ] 스테이징 환경에서 테스트 완료
- [ ] 마이그레이션 롤백 계획 수립
- [ ] 팀 공지 및 일정 조율

### ✅ 마이그레이션 실행
```sql
-- Supabase SQL Editor에서 Phase 1 실행
-- migration_schema_v1.sql의 Phase 1 섹션만 먼저 실행

-- 검증
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'standard_usage' 
AND column_name IN ('original_value', 'updated_by', 'updated_at')
LIMIT 3;
-- 3개가 나와야 함!
```

---

## 🚨 **주의사항**

### ❌ 하지 말아야 할 것
1. DB 마이그레이션을 함수 개발과 동시에 하지 마세요
   - 버전 불일치 발생 가능
   
2. 마이그레이션 후 함수를 개발하지 마세요
   - 프로덕션 데이터에 바로 영향
   
3. 백업 없이 마이그레이션 하지 마세요
   - 데이터 손실 위험

### ✅ 해야 할 것
1. 함수 개발 → 테스트 → DB 마이그레이션 순서
2. 각 함수마다 단위 테스트 작성
3. 마이그레이션 전 스테이징 환경에서 검증
4. 변경 이력을 Git에 커밋

---

## 💡 **함수 개발 팁**

### 1. Supabase 클라이언트 초기화
```python
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
supabase: Client = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_KEY")
)
```

### 2. 트랜잭션 처리 (에러 안전)
```python
try:
    # 1단계
    old_data = supabase.table("standard_usage").select("*").eq("id", std_id).execute()
    old_value = old_data.data[0]["value"]
    
    # 2단계
    supabase.table("standard_usage").update({
        "original_value": old_value,
        "value": corrected_value
    }).eq("id", std_id).execute()
    
    # 3단계
    supabase.table("audit_trail").insert({
        "std_id": std_id,
        "before_value": old_value,
        "after_value": corrected_value
    }).execute()
    
    return {"status": "success"}
except Exception as e:
    return {"status": "error", "message": str(e)}
```

### 3. 조인 쿼리 예시
```python
# Supabase에서 Foreign Key를 통한 자동 조인
result = supabase.table("standard_usage").select(
    "*, outlier_results(*), verification_logs(*)"
).eq("site_id", "Site A").execute()
```

---

## 📊 **최종 의사결정**

### 🎯 **정답: 함수부터 개발하세요!**

```
[지금]     [1주일 후]     [1주일 후]     [1일]
함수 개발 → API 구축 → 테스트 검증 → DB 마이그레이션
  ↓         ↓          ↓             ↓
정확도 높음  빠른 개발   버그 최소화   안전한 적용
```

### 💪 **당신의 다음 행동**

1. ✅ **지금**: `backend_modules/database_utils.py` 작성 요청
2. ✅ **내일**: `backend_modules/outlier_management.py` 작성
3. ✅ **3일 후**: 백엔드 함수 완성 + 테스트
4. ✅ **1주일 후**: FastAPI 앱 완성
5. ✅ **2주일 후**: DB 마이그레이션 실행

---

**준비가 되셨나요? 첫 번째 함수 개발을 시작하겠습니다!** 🚀

다음 요청: "backend_modules/database_utils.py를 작성해 주세요..."
