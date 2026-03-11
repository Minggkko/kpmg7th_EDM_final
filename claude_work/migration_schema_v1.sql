-- ============================================================
-- migration_schema_v1.sql
-- ESG 데이터 신뢰성 검증 시스템 - DB 스키마 마이그레이션 v1
-- ============================================================
-- 실행 방법:
--   A. Supabase 대시보드 → SQL Editor → 전체 붙여넣기 후 실행
--   B. 7_schema_migration.py 로 자동 실행 (SUPABASE_DB_URL 필요)
--
-- 작업 범위:
--   [ALTER] standard_usage    - 4개 컬럼 추가
--   [ALTER] outlier_results   - 4개 컬럼 추가
--   [ALTER] verification_logs - 5개 컬럼 추가
--   [CREATE] justification_logs - 신규 테이블
--   [CREATE] audit_trail        - 신규 테이블
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- STEP 1. standard_usage 확장 컬럼 추가
--   original_value  : 보정 전 원본 수치 백업
--   updated_by      : 최종 수정자 ID
--   updated_at      : 최종 수정 시각
--   correction_reason : 보정 사유
-- ──────────────────────────────────────────────────────────
ALTER TABLE standard_usage
  ADD COLUMN IF NOT EXISTS original_value    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_by        TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_reason TEXT;


-- ──────────────────────────────────────────────────────────
-- STEP 2. outlier_results 확장 컬럼 추가
--   z_score              : L1 Z-Score 수치 근거
--   yoy_roc              : 전년동기대비 변화율(%)
--   intensity_deviation  : 원단위 편차(%)
--   is_resolved          : 소명 완료 여부
-- ──────────────────────────────────────────────────────────
ALTER TABLE outlier_results
  ADD COLUMN IF NOT EXISTS z_score             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS yoy_roc             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS intensity_deviation DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_resolved         BOOLEAN DEFAULT FALSE;


-- ──────────────────────────────────────────────────────────
-- STEP 3. verification_logs 확장 컬럼 추가
--   db_value       : 시스템 기록값 (대조용 스냅샷)
--   ocr_value      : OCR 추출값 (대조용 스냅샷)
--   unit_mismatch  : 단위 불일치 여부
--   verified_by    : 검증 수행자 ID
--   approved_at    : 최종 승인 시각
-- ──────────────────────────────────────────────────────────
ALTER TABLE verification_logs
  ADD COLUMN IF NOT EXISTS db_value      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ocr_value     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS unit_mismatch BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_by   TEXT,
  ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ;


-- ──────────────────────────────────────────────────────────
-- STEP 4. justification_logs 신규 테이블 생성
--   사용자 소명 이력 전용 테이블
--   (outlier_management.py → update_outlier_justification 사용)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS justification_logs (
  id                 BIGSERIAL    PRIMARY KEY,
  std_id             BIGINT       NOT NULL REFERENCES standard_usage(id) ON DELETE CASCADE,
  outlier_id         BIGINT       REFERENCES outlier_results(id) ON DELETE SET NULL,
  justification_type TEXT         NOT NULL DEFAULT 'user_input',
  user_feedback      TEXT         NOT NULL,
  action_taken       TEXT         NOT NULL,
  created_by         TEXT         NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_justification_std_id  ON justification_logs (std_id);
CREATE INDEX IF NOT EXISTS idx_justification_created ON justification_logs (created_at DESC);

COMMENT ON TABLE  justification_logs               IS '이상치 소명 이력 테이블';
COMMENT ON COLUMN justification_logs.justification_type IS 'user_input | system_auto';
COMMENT ON COLUMN justification_logs.action_taken        IS '정상 입력 시 v_status → 1 전환';
COMMENT ON COLUMN justification_logs.resolved_at         IS 'action_taken=정상 일 때 채워짐';


-- ──────────────────────────────────────────────────────────
-- STEP 5. audit_trail 신규 테이블 생성
--   모든 데이터 변경 이력 감사 추적 테이블
--   (audit_trail.py → log_action 사용)
--
-- 액션 코드:
--   UPLOAD | DETECT | AI_DIAG | VERIFY | JUSTIFY | FINALIZE | REVERT
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_trail (
  trail_id      BIGSERIAL    PRIMARY KEY,
  std_id        BIGINT       NOT NULL REFERENCES standard_usage(id) ON DELETE CASCADE,
  action        TEXT         NOT NULL,
  before_value  DOUBLE PRECISION,
  after_value   DOUBLE PRECISION,
  before_status INTEGER,
  after_status  INTEGER,
  reason        TEXT,
  performed_by  TEXT         NOT NULL,
  performed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_std_id    ON audit_trail (std_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_trail (action);
CREATE INDEX IF NOT EXISTS idx_audit_performed ON audit_trail (performed_at DESC);

COMMENT ON TABLE  audit_trail              IS '전체 데이터 변경 감사 추적 테이블';
COMMENT ON COLUMN audit_trail.action       IS 'UPLOAD|DETECT|AI_DIAG|VERIFY|JUSTIFY|FINALIZE|REVERT';
COMMENT ON COLUMN audit_trail.before_value IS '변경 전 수치 (수치 변경 없는 이벤트는 NULL)';
COMMENT ON COLUMN audit_trail.after_value  IS '변경 후 수치';


-- ──────────────────────────────────────────────────────────
-- 검증 쿼리 (실행 후 결과 확인용)
-- ──────────────────────────────────────────────────────────
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'standard_usage', 'outlier_results', 'verification_logs',
    'justification_logs', 'audit_trail'
  )
GROUP BY table_name
ORDER BY table_name;
