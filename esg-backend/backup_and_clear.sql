-- ============================================================
-- ESG Pipeline E2E Test - 백업 및 초기화 스크립트
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- ── STEP 1: 백업 테이블 생성 (없으면 생성, 있으면 DROP 후 재생성) ──────────────

DROP TABLE IF EXISTS backup_raw_data;
CREATE TABLE backup_raw_data AS SELECT * FROM raw_data;

DROP TABLE IF EXISTS backup_raw_ocr_data;
CREATE TABLE backup_raw_ocr_data AS SELECT * FROM raw_ocr_data;

DROP TABLE IF EXISTS backup_standardized_data;
CREATE TABLE backup_standardized_data AS SELECT * FROM standardized_data;

-- 백업 건수 확인
SELECT
  (SELECT COUNT(*) FROM backup_raw_data)         AS raw_data_backup,
  (SELECT COUNT(*) FROM backup_raw_ocr_data)     AS raw_ocr_data_backup,
  (SELECT COUNT(*) FROM backup_standardized_data) AS standardized_data_backup;

-- ── STEP 2: 원본 테이블 초기화 ──────────────────────────────────────────────────

-- FK 순서 주의: standardized_data → raw_data 순으로 삭제
TRUNCATE TABLE standardized_data RESTART IDENTITY CASCADE;
TRUNCATE TABLE raw_ocr_data      RESTART IDENTITY CASCADE;
TRUNCATE TABLE raw_data          RESTART IDENTITY CASCADE;

-- 초기화 확인
SELECT
  (SELECT COUNT(*) FROM raw_data)          AS raw_data_count,
  (SELECT COUNT(*) FROM raw_ocr_data)      AS raw_ocr_data_count,
  (SELECT COUNT(*) FROM standardized_data) AS standardized_data_count;

-- ── 복구가 필요할 때 (테스트 후 원복) ──────────────────────────────────────────
-- INSERT INTO raw_data          SELECT * FROM backup_raw_data;
-- INSERT INTO raw_ocr_data      SELECT * FROM backup_raw_ocr_data;
-- INSERT INTO standardized_data SELECT * FROM backup_standardized_data;
