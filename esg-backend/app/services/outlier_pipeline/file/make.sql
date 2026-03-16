-- 1. 사업장 정보
CREATE TABLE IF NOT EXISTS public.master_sites (
    site_id text NOT NULL,
    site_name text NOT NULL,
    CONSTRAINT master_sites_pkey PRIMARY KEY (site_id)
);

-- 2. OCR 원천 데이터
CREATE TABLE IF NOT EXISTS public.raw_ocr_data (
    id serial NOT NULL,
    file_name text NULL,
    raw_content jsonb NULL,
    ocr_provider text NULL,
    processing_status text NULL,
    extracted_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT raw_ocr_data_pkey PRIMARY KEY (id)
);

-- 3. 사이트-지표 매핑
CREATE TABLE IF NOT EXISTS public.site_metric_map (
    customer_number text NOT NULL,
    site_id text NULL,
    metric_name text NOT NULL,
    unit text NOT NULL,
    description text NULL,
    CONSTRAINT site_metric_map_pkey PRIMARY KEY (customer_number),
    CONSTRAINT site_metric_map_site_id_fkey FOREIGN KEY (site_id) REFERENCES master_sites (site_id)
);

-- 4. 임계치 기준
CREATE TABLE IF NOT EXISTS public.threshold_limits (
    site_id text NOT NULL,
    metric_name text NOT NULL,
    unit text NOT NULL,
    upper_limit double precision NULL,
    updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT threshold_limits_pkey PRIMARY KEY (site_id, metric_name),
    CONSTRAINT threshold_limits_site_id_fkey FOREIGN KEY (site_id) REFERENCES master_sites (site_id)
);

-- 5. 생산량 데이터
CREATE TABLE IF NOT EXISTS public.activity_data (
    activity_id serial NOT NULL,
    site_id text NULL,
    reporting_date date NOT NULL,
    production_qty double precision NULL,
    unit text NULL DEFAULT 'Ton'::text,
    CONSTRAINT activity_data_pkey PRIMARY KEY (activity_id),
    CONSTRAINT activity_data_site_id_fkey FOREIGN KEY (site_id) REFERENCES master_sites (site_id)
);

-- 6. 정제된 증빙 수치
CREATE TABLE IF NOT EXISTS public.evidence_usage (
    id serial NOT NULL,
    site_id text NULL,
    reporting_date date NOT NULL,
    metric_name text NOT NULL,
    unit text NOT NULL,
    ocr_value double precision NULL,
    file_name text NULL,
    created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT evidence_usage_pkey PRIMARY KEY (id),
    CONSTRAINT evidence_usage_site_id_fkey FOREIGN KEY (site_id) REFERENCES master_sites (site_id)
);

-- 7. 이상치 탐지 결과 (std_id 타입을 bigint로 일치)
CREATE TABLE IF NOT EXISTS public.outlier_results (
    id serial NOT NULL,
    std_id bigint NULL, -- standardized_data.id 참조를 위해 bigint 사용
    layer text NULL,
    detected_value double precision NULL,
    threshold double precision NULL,
    severity text NULL,
    analysis_summary text NULL,
    z_score double precision NULL,
    yoy_roc double precision NULL,
    intensity_deviation double precision NULL,
    is_resolved boolean NULL DEFAULT false,
    CONSTRAINT outlier_results_pkey PRIMARY KEY (id),
    CONSTRAINT outlier_results_std_id_fkey FOREIGN KEY (std_id) REFERENCES standardized_data (id) ON DELETE CASCADE
);

-- 8. 데이터 수정 감사 이력
CREATE TABLE IF NOT EXISTS public.audit_trail (
    trail_id bigserial NOT NULL,
    std_id bigint NOT NULL,
    action text NOT NULL,
    before_value double precision NULL,
    after_value double precision NULL,
    before_status integer NULL,
    after_status integer NULL,
    reason text NULL,
    performed_by text NOT NULL,
    performed_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT audit_trail_pkey PRIMARY KEY (trail_id),
    CONSTRAINT audit_trail_std_id_fkey FOREIGN KEY (std_id) REFERENCES standardized_data (id) ON DELETE CASCADE
);

-- 9. 소명 및 조치 로그
CREATE TABLE IF NOT EXISTS public.justification_logs (
    id bigserial NOT NULL,
    std_id bigint NOT NULL,
    outlier_id integer NULL, -- outlier_results.id 참조
    justification_type text NOT NULL DEFAULT 'user_input'::text,
    user_feedback text NOT NULL,
    action_taken text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    resolved_at timestamp with time zone NULL,
    CONSTRAINT justification_logs_pkey PRIMARY KEY (id),
    CONSTRAINT justification_logs_std_id_fkey FOREIGN KEY (std_id) REFERENCES standardized_data (id) ON DELETE CASCADE,
    CONSTRAINT justification_logs_outlier_id_fkey FOREIGN KEY (outlier_id) REFERENCES outlier_results (id) ON DELETE SET NULL
);

-- 10. 증빙 정합성 검증 로그
CREATE TABLE IF NOT EXISTS public.verification_logs (
    log_id serial NOT NULL,
    std_id bigint NULL,
    evidence_id integer NULL,
    gap_value double precision NULL,
    gap_percent double precision NULL,
    result_code integer NULL,
    diagnosis text NULL,
    verified_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
    db_value double precision NULL,
    ocr_value double precision NULL,
    unit_mismatch boolean NULL DEFAULT false,
    verified_by text NULL,
    approved_at timestamp with time zone NULL,
    CONSTRAINT verification_logs_pkey PRIMARY KEY (log_id),
    CONSTRAINT verification_logs_std_id_fkey FOREIGN KEY (std_id) REFERENCES standardized_data (id) ON DELETE CASCADE,
    CONSTRAINT verification_logs_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES evidence_usage (id)
);