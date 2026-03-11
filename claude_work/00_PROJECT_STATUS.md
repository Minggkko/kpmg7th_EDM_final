# ESG 데이터 신뢰성 검증 시스템
## 📊 프로젝트 현황 분석 (2026-03-11)

---

## 🎯 프로젝트 목표
**데이터의 의심 → AI 진단 → 현장 소명 → 증빙 대조 → 수치 확정**으로 이어지는
**신뢰성 검증 파이프라인** 구축 및 **배치 스크립트 → 모듈형 백엔드 함수** 전환

---

## ✅ 현재까지 완료된 작업

### Phase 1: 설계 & 분석 (완료 ✅)
- [x] 현재 DB 스키마 분석 (8개 테이블)
- [x] 부족한 테이블/컬럼 식별
- [x] 4단계 검증 프로세스 설계 (설계안 문서)
- [x] 데이터 상태 흐름(v_status) 정의

### Phase 2: DB 스키마 설계 & 마이그레이션 스크립트 (완료 ✅)
- [x] **ESG_DB_Schema_Design.docx** (전문 설계 문서)
- [x] **migration_schema_v1.sql** (Supabase 직접 실행용)
- [x] **7_schema_migration.py** (Python 자동화)
- [x] **ROADMAP.md** (8주 구현 계획)

### Phase 3: 기존 배치 코드 분석 (완료 ✅)
현재 Git의 6개 Jupyter 노트북 분석 완료:
1. **1_upload_data.ipynb** - 데이터 초기 적재
2. **2_migrate_configs.ipynb** - 설정 테이블 마이그레이션
3. **3_outlier_detect.ipynb** - 이상치 탐지 (L1/L2/L3)
4. **4_outlier_llm.ipynb** - AI 진단 (GPT-4o 활용)
5. **5_evidence_data_upload.ipynb** - OCR 데이터 적재
6. **6_standard_evidence_check.ipynb** - 증빙 정합성 검증

---

## 🔴 **다음 필수 작업 (현재 상태: 미진행)**

### 🚀 Priority 1: 핵심 백엔드 모듈 생성 (지금 바로 해야 함!)

#### Module 1: 이상치 소명 처리
```python
def update_outlier_justification(
    std_id: int,
    user_feedback: str,
    action_taken: str,
    created_by: str
) -> dict
```
- **역할**: 사용자가 제출한 소명 정보를 DB에 저장
- **출력**: outlier_results + standard_usage 업데이트
- **상태 전이**: v_status 2 → 1 (조치가 정상인 경우)

#### Module 2: 수치 보정 및 확정
```python
def finalize_usage_data(
    std_id: int,
    corrected_value: float,
    user_id: str,
    reason: str
) -> dict
```
- **역할**: 검증된 데이터를 최종 확정
- **트랜잭션**: original_value 백업 + value 갱신 + audit_logs 기록
- **상태 전이**: v_status 2/3/4 → 5 (Verified)

#### Module 3: 통합 조회 (대시보드용)
```python
def get_verification_dashboard(
    site_id: str = None,
    start_date: str = None,
    end_date: str = None,
    v_status: int = None
) -> list
```
- **역할**: FE 대시보드에 필요한 모든 데이터 한 번에 반환
- **조인**: standard_usage ← outlier_results ← verification_logs ← evidence_usage
- **반환**: [{'id', 'site_id', 'date', 'metric', 'value', 'status', 'ai_diagnosis', 'gap_percent', ...}]

---

## 📁 현재 폴더 구조 & 코드 분석

### 기존 배치 스크립트 (Jupyter Notebooks)
```
DB_postgresql/
├── 1_upload_data.ipynb              (데이터 초기 적재)
├── 2_migrate_configs.ipynb          (설정 정보)
├── 3_outlier_detect.ipynb           (이상치 탐지 핵심 로직)
├── 4_outlier_llm.ipynb              (AI 진단)
├── 5_evidence_data_upload.ipynb     (OCR 적재)
├── 6_standard_evidence_check.ipynb  (증빙 검증)
└── 7_schema_migration.py            (스키마 마이그레이션)
```

### 새로 생성해야 할 파일
```
backend_modules/
├── __init__.py
├── outlier_management.py            ⭐ NEW (Module 1: 소명 처리)
├── data_finalization.py             ⭐ NEW (Module 2: 수치 보정)
├── verification_dashboard.py        ⭐ NEW (Module 3: 통합 조회)
├── audit_trail.py                   ⭐ NEW (감사 추적 기록)
└── database_utils.py                (DB 연결 유틸)
```

---

## 📝 스키마 정의 (확정)

### [현재] 기존 테이블 (8개)
| 테이블 | 용도 | 핵심 컬럼 |
|--------|------|---------|
| standard_usage | 실적 | id, site_id, value, **v_status** |
| activity_data | 생산량 | activity_id, production_qty |
| master_sites | 사업장 | site_id, site_name |
| outlier_results | AI 탐지 | std_id, severity, analysis_summary |
| verification_logs | 증빙 검증 | std_id, gap_percent, result_code |
| evidence_usage | OCR 증빙 | ocr_value, file_name |
| raw_ocr_data | OCR 원본 | raw_content(JSONB) |
| site_metric_map | 매핑 | metric_name, unit |
| threshold_limits | 임계치 | upper_limit |

### [확장] 신규/수정 필요 컬럼

#### ✏️ standard_usage에 추가
- `original_value` (DOUBLE PRECISION) - 보정 전 원본값
- `updated_by` (TEXT) - 수정자 ID
- `updated_at` (TIMESTAMP) - 수정 시각
- `correction_reason` (TEXT) - 수정 사유

#### ✏️ outlier_results에 추가
- `z_score` (DOUBLE PRECISION) - L1 통계 근거
- `yoy_roc` (DOUBLE PRECISION) - 전년동기 대비 변화율
- `intensity_deviation` (DOUBLE PRECISION) - 원단위 편차
- `is_resolved` (BOOLEAN) - 소명 완료 여부

#### ✏️ verification_logs에 추가
- `db_value` (DOUBLE PRECISION) - 시스템값
- `ocr_value` (DOUBLE PRECISION) - OCR값
- `unit_mismatch` (BOOLEAN) - 단위 불일치 여부
- `verified_by` (TEXT) - 검증자
- `approved_at` (TIMESTAMP) - 승인 시각

#### 🆕 신규 테이블: justification_logs
- id (PK), std_id (FK), outlier_id, justification_type
- user_feedback, action_taken, created_by, created_at, resolved_at

#### 🆕 신규 테이블: audit_trail
- trail_id (PK), std_id (FK), action, before_value, after_value
- before_status, after_status, reason, performed_by, performed_at

---

## 🔄 데이터 상태 흐름 (v_status)

```
0 (Pending)        초기 적재 → 분석 대기
    ↓
1 (Normal)         시스템 검토 결과 정상 ✅ (최종 확정)
    ↓
2 (Outlier)        이상치 탐지 ⚠️ (사용자 검토 필요)
    ↓
3 (Mismatch)       증빙과 수치 불일치 ❌
    ↓
4 (Unit Error)     단위 오기입 의심 ⚠️
    ↓
5 (Verified)       증빙 검증 + 수치 보정 완료 ✅ (최종 확정)
```

---

## 🎯 4단계 검증 프로세스

### 1단계: 이상치 검토
- FE: outlier_results 목록 조회 (severity 필터링)
- BE: `get_verification_dashboard()` 함수 활용
- 반환 정보: AI 진단, 과거 추이, 위험도

### 2단계: 사용자 소명
- FE: 소명 폼 입력 (justification_type, user_feedback)
- BE: `update_outlier_justification()` 호출
- DB: justification_logs 생성 + v_status 업데이트

### 3단계: 증빙 정합성 검증
- FE: DB값 vs OCR값 대조 화면
- BE: verification_logs 조회 (gap_percent 확인)
- 자동 판정: 오차 < 1% → 정합 / 단위 오류 감지 → 4

### 4단계: 수치 보정 및 마감
- FE: 최종 승인 버튼 클릭
- BE: `finalize_usage_data()` 호출
  - original_value에 기존값 백업
  - value 업데이트
  - audit_trail 기록
  - v_status = 5 설정

---

## 💻 구현 순서 (권장)

### Week 1-2: 핵심 모듈 개발
```bash
# 1. 기존 배치 스크립트에서 핵심 함수 추출
# 2. update_outlier_justification() 작성
# 3. finalize_usage_data() 작성 (트랜잭션 처리)
# 4. audit_trail 기록 함수 작성
```

### Week 3: 통합 조회 모듈
```bash
# 1. get_verification_dashboard() 작성 (복잡한 조인)
# 2. 상태별 필터링 로직
# 3. 캐싱 전략 (Redis)
```

### Week 4: FastAPI 백엔드 구축
```bash
# 1. main.py (FastAPI 앱)
# 2. routes/ - 4단계별 엔드포인트
# 3. schemas/ - Pydantic 모델
# 4. tests/ - 단위 테스트
```

### Week 5-8: FE 개발 & 배포
```bash
# 1. React 대시보드
# 2. 4단계 UI 컴포넌트
# 3. E2E 테스트
# 4. 프로덕션 배포
```

---

## 🔑 핵심 구현 팁

### ✅ 모든 수정은 transaction 필수
```python
# MUST: original_value 보존
with transaction:
    old_value = supabase.table("standard_usage").select("value").eq("id", std_id).execute()
    supabase.table("standard_usage").update({
        "original_value": old_value,
        "value": corrected_value,
        "updated_by": user_id,
        "updated_at": now(),
        "v_status": 5
    }).eq("id", std_id).execute()
```

### ✅ 모든 변경은 audit_trail 기록
```python
# MUST: 감사 추적 의무
supabase.table("audit_trail").insert({
    "std_id": std_id,
    "action": "CORRECT",
    "before_value": old_value,
    "after_value": corrected_value,
    "reason": reason,
    "performed_by": user_id
}).execute()
```

### ✅ 컬럼명 100% 일치
- DB 테이블과 Python 함수의 컬럼명이 정확히 일치해야 함
- snake_case 통일 (created_at, updated_by 등)

---

## 📊 현재 준비된 산출물

### ✅ 완료
1. **ESG_DB_Schema_Design.docx** - 설계 명세
2. **migration_schema_v1.sql** - SQL 마이그레이션
3. **7_schema_migration.py** - 자동화 스크립트
4. **ROADMAP.md** - 8주 계획

### ⏳ 다음 대상
1. **backend_modules/** - 핵심 Python 함수 모음 (지금 시작해야 함)
2. **tests/** - 단위 테스트
3. **main.py** - FastAPI 앱
4. **FE components** - React UI

---

## 🎓 Claude와 함께 진행할 작업

### 명확한 요청 예시:
```
"backend_modules/outlier_management.py를 작성해 주세요.
- 함수명: update_outlier_justification
- 입력: std_id, user_feedback, action_taken, created_by
- 출력: {'status': 'success', 'updated_record': {...}}
- 로직: 
  1. justification_logs 테이블에 record 생성
  2. action_taken이 '정상'이면 standard_usage.v_status = 1로 변경
  3. audit_trail에 변경 기록
  4. 트랜잭션 처리 (에러 시 롤백)
- 모든 컬럼명은 스키마 정의와 정확히 일치"
```

---

## 📞 주요 연락 정보

- **DB 스키마**: 확정됨 (migration_schema_v1.sql 참고)
- **데이터 상태 코드**: v_status 0~5 명확히 정의
- **기존 배치 로직**: 6개 .ipynb에서 참고 가능
- **API 엔드포인트**: ROADMAP.md의 Phase 2 참고

---

**다음 단계:** backend_modules/ 디렉토리의 3가지 핵심 함수 작성 시작
**예상 소요시간:** 각 모듈 2~4시간 (총 1주일)
**난이도:** ★★★ (트랜잭션 + 조인 쿼리)

