# 작업 로그 (Work Log)
## ESG 데이터 신뢰성 검증 시스템 - 백엔드 모듈 개발

**작업 기간:** 2026-03-11  
**브랜치:** `Feat/pencil1`  
**작업 디렉토리:** `claude_work/`

---

## ✅ 완료된 작업 전체 목록

### [Task 0] 사전 오류 수정 - 3_outlier_detect.ipynb

- **파일:** `DB_postgresql/3_outlier_detect.ipynb`
- **오류:** `TypeError: Object of type int64 is not JSON serializable`
- **원인:** pandas/numpy에서 추출한 값(`int64`, `float64`)을 그대로 Supabase에 INSERT 시도
- **수정:** `outlier_log` 딕셔너리의 `detected_value`, `threshold` 값을 `float()`으로 변환
- **수정 위치:** `upper_limit`, `val` 할당부 및 `outlier_log` 딕셔너리 3곳

---

### [Task 1] database_utils.py - DB 연결 공통 유틸리티

- **파일:** `claude_work/backend_modules/database_utils.py`
- **역할:** Supabase 클라이언트 싱글턴 초기화 및 공통 쿼리 헬퍼 제공
- **주요 구현:**
  - `.env` 파일 자동 탐색 (프로젝트 루트 → `DB_postgresql/` 순)
  - `get_supabase_client()` : 싱글턴 클라이언트 (모든 모듈이 공유)
  - `fetch_all(table, filters)` : 테이블 전체/필터 조회
  - `fetch_one(table, id)` : id 기준 단일 레코드 조회
  - `insert_record(table, record)` : 단일 레코드 삽입
  - `update_record(table, id, updates)` : id 기준 레코드 업데이트
- **검증 결과:** ✅ `master_sites` 조회 성공 (Site A 확인)
- **특이사항:** `claude_work/backend_modules/` 이동 후 경로 (`.parent.parent.parent`) 수정 완료

---

### [Task 2] outlier_management.py - 이상치 소명 처리

- **파일:** `claude_work/backend_modules/outlier_management.py`
- **역할:** 사용자가 제출한 소명 정보를 DB에 저장하고 v_status 전이 처리
- **주요 구현:**
  - `update_outlier_justification(std_id, user_feedback, action_taken, created_by, ...)` : 소명 저장 메인 함수
    - Step 1: `standard_usage` 스냅샷 조회
    - Step 2: 연관 `outlier_id` 자동 조회
    - Step 3: `justification_logs` INSERT
    - Step 4: `action_taken == '정상'` 시 → `v_status 2 → 1`, `outlier_results.is_resolved = True`
    - Step 5: `audit_trail.log_action()` 호출 (감사 기록)
  - `get_outlier_detail(std_id)` : 이상치 상세 통합 조회
- **상태 전이:** `v_status 2(Outlier) → 1(Normal)` (action_taken='정상' 조건)
- **검증 결과:**
  - 마이그레이션 전: `justification_logs` 테이블 없음 → `error` dict 안전 반환 ✅
  - 마이그레이션 후: `justification_id=1` 생성, `v_status: 2 → 1` 전환 ✅

---

### [Task 3] data_finalization.py - 수치 보정 및 최종 확정

- **파일:** `claude_work/backend_modules/data_finalization.py`
- **역할:** 검증 완료 데이터를 최종 확정 처리 (수치 보정 + v_status=5)
- **주요 구현:**
  - `finalize_usage_data(std_id, corrected_value, user_id, reason)` : 수치 확정 메인 함수
    - Step 1: `standard_usage` 스냅샷 (before_value, before_status)
    - Step 2: 전체 payload 업데이트 시도 → 실패 시 핵심 컬럼(value, v_status)만 fallback
    - Step 3: `audit_trail.log_action()` 호출 → 실패 시 standard_usage 롤백
  - `revert_finalization(std_id, user_id, reason)` : 확정 취소 + original_value 복원
  - `get_finalization_history(std_id)` : 보정 이력 조회
- **트랜잭션 전략** (Supabase 미지원 환경):
  ```
  standard_usage 업데이트 성공
    → audit_trail 기록 실패 → standard_usage 롤백 → rollback_success 반환
    → audit_trail 기록 + 롤백 모두 실패 → rollback_failed 반환 (수동 확인 필요)
  ```
- **상태 전이:** `v_status 2/3/4 → 5(Verified)`
- **검증 결과:**
  - 마이그레이션 전: fallback 동작 확인, 롤백 로직 정상 작동 ✅
  - 마이그레이션 후: `audit_trail_id=2` 생성, `v_status: 2 → 5` 전환 ✅

---

### [Task 4] verification_dashboard.py - 대시보드 통합 조회

- **파일:** `claude_work/backend_modules/verification_dashboard.py`
- **역할:** FE 대시보드에 필요한 모든 데이터를 한 번에 통합 반환
- **주요 구현:**
  - `get_verification_dashboard(site_id, start_date, end_date, v_status, metric_name, limit)` : 메인 조회 함수
    - `standard_usage` 기준으로 4개 테이블 Python-side 조인
    - N+1 방지: 테이블별 IN 쿼리로 일괄 조회 후 메모리 병합
    - 반환 필드: `id, site_id, reporting_date, metric_name, value, v_status_label, production_qty, intensity, outlier 정보, 증빙 검증 정보, OCR 정보` (총 24개 필드)
  - `get_status_summary(site_id)` : v_status별 건수 집계 (차트/카드용)
  - `get_outlier_pending_list(site_id)` : 소명 대기(v_status=2) 목록
- **조인 구조:**
  ```
  standard_usage
    └─ outlier_results      (std_id FK, 최신 1건)
    └─ verification_logs    (std_id FK, 최신 1건)
    └─ evidence_usage       (evidence_id FK)
    └─ activity_data        (site_id + reporting_date 매칭)
  ```
- **검증 결과 (실 DB 데이터):**
  ```
  Site A: Pending 24건 / Outlier 2건 / Mismatch 1건 / Verified 21건
  Site B: Pending 24건 / Outlier 1건 / Mismatch 1건 / Unit Error 1건 / Verified 21건
  소명 대기 총 3건 탐지
  ```

---

### [Task 5] audit_trail.py - 감사 추적 전용 모듈

- **파일:** `claude_work/backend_modules/audit_trail.py`
- **역할:** 모든 데이터 변경 이력을 `audit_trail` 테이블에 기록/조회 (중앙화)
- **주요 구현:**
  - `AuditAction` 클래스 : 액션 코드 상수 정의
    ```python
    UPLOAD | DETECT | AI_DIAG | VERIFY | JUSTIFY | FINALIZE | REVERT
    ```
  - `log_action(std_id, action, performed_by, reason, ...)` : 단일 이벤트 기록
    - 테이블 미존재 시 `skipped` 상태 graceful 반환 (앱 크래시 없음)
  - `get_audit_history(std_id)` : 특정 레코드 전체 이력 조회
  - `get_audit_logs(site_id, action, performed_by, ...)` : 전체 로그 필터 조회
  - `get_action_summary(site_id, start_date, end_date)` : 액션 유형별 집계
- **리팩토링:** `outlier_management`, `data_finalization`의 직접 INSERT 코드를 `log_action()` 단일 호출로 교체
- **검증 결과 (마이그레이션 후):**
  ```
  이상치 탐지 (DETECT  ): 1건
  수치 확정   (FINALIZE): 1건
  소명 제출   (JUSTIFY ): 1건
  ```

---

### [Task 6] DB 스키마 마이그레이션

- **SQL 파일:** `claude_work/migration_schema_v1.sql`
- **Python 스크립트:** `claude_work/7_schema_migration.py`
- **실행 방법:**
  - `SUPABASE_DB_URL` 설정 시: 자동 실행 (psycopg2)
  - 미설정 시: Supabase SQL Editor 수동 실행 안내
  - 검증: `python claude_work/7_schema_migration.py --verify-only`

**마이그레이션 내용:**

| 대상 | 유형 | 추가 항목 |
|------|------|-----------|
| `standard_usage` | ALTER | `original_value`, `updated_by`, `updated_at`, `correction_reason` |
| `outlier_results` | ALTER | `z_score`, `yoy_roc`, `intensity_deviation`, `is_resolved` |
| `verification_logs` | ALTER | `db_value`, `ocr_value`, `unit_mismatch`, `verified_by`, `approved_at` |
| `justification_logs` | CREATE | 소명 이력 전용 테이블 (9개 컬럼) |
| `audit_trail` | CREATE | 감사 추적 전용 테이블 (10개 컬럼) |

**검증 결과:**
```
✅ [standard_usage]    모든 컬럼 확인
✅ [outlier_results]   모든 컬럼 확인
✅ [verification_logs] 모든 컬럼 확인
✅ [justification_logs] 모든 컬럼 확인
✅ [audit_trail]       모든 컬럼 확인
🎉 마이그레이션 완료!
```

---

## 📁 현재 파일 구조

```
claude_work/
├── 00_PROJECT_STATUS.md         # 프로젝트 현황 분석
├── 01_PRIORITY_DECISION.md      # 작업 우선순위 결정
├── 02_WORK_LOG.md               # 이 파일 (작업 로그)
├── migration_schema_v1.sql      # DB 마이그레이션 SQL ✅ 실행 완료
├── 7_schema_migration.py        # 마이그레이션 자동화 스크립트
└── backend_modules/
    ├── __init__.py              # 패키지 공개 API 정의
    ├── database_utils.py        # DB 연결 + 공통 헬퍼
    ├── audit_trail.py           # 감사 추적 (중앙화)
    ├── outlier_management.py    # 이상치 소명 처리
    ├── data_finalization.py     # 수치 보정 및 확정
    └── verification_dashboard.py # 대시보드 통합 조회
```

---

## 🔄 현재 데이터 상태 (작업 중 변경된 레코드)

> 검증 테스트 과정에서 실제 DB 데이터가 일부 변경됨

| std_id | 변경 내용 | 이전 상태 | 현재 상태 |
|--------|-----------|-----------|-----------|
| 37 | 소명 처리 테스트 (Site A / electricity) | v_status=2 | v_status=1 |
| 43 | 수치 확정 테스트 (Site A / electricity) | v_status=2 | v_status=5 |

---

## 🔑 핵심 설계 원칙 (구현 반영)

1. **numpy 타입 변환 필수:** `float()` / `int()` 래핑 → JSON 직렬화 오류 방지
2. **Graceful degradation:** 테이블/컬럼 미존재 시 앱 크래시 없이 상태 코드 반환
3. **단계별 롤백:** Supabase 트랜잭션 미지원 → 실패 지점별 복원 로직 구현
4. **감사 기록 중앙화:** 모든 변경은 `audit_trail.log_action()` 단일 경로로 처리
5. **N+1 방지:** 대시보드 조회 시 테이블별 IN 쿼리 후 Python-side 조인

---

## 🚀 다음 작업 (미진행)

### Week 4: FastAPI 백엔드 구축

```
claude_work/
├── main.py                 ← FastAPI 앱 진입점
├── schemas/
│   ├── __init__.py
│   ├── outlier.py          ← 소명 요청/응답 Pydantic 모델
│   ├── finalization.py     ← 확정 요청/응답 Pydantic 모델
│   └── dashboard.py        ← 대시보드 응답 Pydantic 모델
└── routes/
    ├── __init__.py
    ├── outliers.py         ← 이상치 관련 엔드포인트
    ├── finalization.py     ← 수치 확정 엔드포인트
    ├── dashboard.py        ← 대시보드 조회 엔드포인트
    └── audit.py            ← 감사 이력 조회 엔드포인트
```

**예상 엔드포인트:**
| Method | Path | 함수 |
|--------|------|------|
| GET | `/dashboard` | `get_verification_dashboard()` |
| GET | `/dashboard/summary` | `get_status_summary()` |
| GET | `/outliers/pending` | `get_outlier_pending_list()` |
| GET | `/outliers/{std_id}` | `get_outlier_detail()` |
| POST | `/outliers/{std_id}/justify` | `update_outlier_justification()` |
| POST | `/data/{std_id}/finalize` | `finalize_usage_data()` |
| POST | `/data/{std_id}/revert` | `revert_finalization()` |
| GET | `/audit/{std_id}` | `get_audit_history()` |
| GET | `/audit` | `get_audit_logs()` |
