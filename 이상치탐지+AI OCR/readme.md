# ESG Data Integrity & AI OCR Verification System

통계적 이상치 탐지(L1/L2 Filter)와 AI OCR 증빙 대조(Validation)를 결합하여, ESG 공시 데이터의 '무결성'을 확보하는 엔드투엔드 파이프라인

## 1. 시스템 아키텍처 및 업무 흐름 (Workflow)

- Baseline Setup: 사업장 정보 및 이상치 판단 임계치(threshold_limits) 설정.

- L1/L2 Outlier Detection: 입력된 실적을 통계적으로 분석하여 이상치 식별 후 **outlier_results**에 기록.

- AI OCR Ingestion: 증빙 고지서를 Upstage API로 읽어 raw_ocr_data에 저장.

- Reconciliation: OCR 정제 데이터(evidence_usage)와 실적을 1:1 대조하여 verification_logs 생성.

- Final Gold Data: 검증 완료 시 v_status: 5 부여

## 2. DB 테이블 구성 및 역할
A. 기준 및 실적
- master_sites: 사업장 마스터 정보 (ID, 명칭).
- site_metric_map: 고객번호와 내부 사업장/지표 간의 매핑 정보.

- standard_usage: 월별 에너지 사용량 원천 데이터 및 최종 검증 상태(v_status).

- activity_data: 검증된 실적에 배출계수를 적용한 탄소 배출량($tCO_2e$) 결과물.

B. Analysis & Audit (분석 및 감사)
- threshold_limits: 이상치 판단의 근거가 되는 사업장별/지표별 상한선 지표.

- outlier_results: [신규 추가] 이상치 탐지 엔진의 결과물. (Z-Score, 임계치 초과 여부, 진단 내용 기록)

- verification_logs: 실적 데이터와 OCR 증빙 데이터 간의 1:1 대조 결과 및 오차율 기록.

C. Evidence & OCR (원천 및 증빙)
- raw_ocr_data: AI OCR 엔진이 추출한 원천 JSON 전문.

- evidence_usage: OCR JSON에서 파싱하여 구조화한 '정제된 증빙 수치'.

## 3. 핵심 검증 로직 상세
A. 이상치 탐지

- 1단계 : 통계적 및 시계열 변동 탐지
    - Z-Score 분석: 과거 12개월 평균값 및 표준편차 기준, 현재 수치의 편차율($|Z|$) 3.0 초과 여부 확인
    - YoY 변동성 분석: 전년 동월 대비 에너지 사용량 증감률 30.0% 초과 여부 검증
    - 목적: 과거 패턴 및 일반적인 통계 분포를 벗어난 비정상적 특이치 식별

- 2단계 : 물리적 한계치 탐지
    - 절대 임계치 비교 : 사업장 설비 용량 및 계약 전력 기반 사전 정의된 상한선 초과 여부 대조
    - 목적 : 기입 실수(오타) 등 물리적으로 불가능한 수치에 대한 즉시 차단 및 Critical 심각도 부여
- 3단계 : 활동량(생산량) 비례 상관성 검증
    - 생산-에너지 상관계수 분석: 활동량 데이터(production_qty)와 에너지 사용량 간의 선형적 상관관계 검토
    - 판단 목적: 단순 사용량 증감이 아닌, '생산 활동량과의 상관성' 내에서 설명되지 않는 에너지 손실 및 누수 식별

B. 증빙자료 정합성 검증
- 1단계: 증빙-실적 데이터 매핑 및 구조화
    - 객체 식별 및 추출: Upstage AI OCR 엔진을 통해 고지서 내 고객번호, 청구 연월, 검침량 정보 자동 디지털화
    - 상관 데이터 매핑: site_metric_map 테이블을 참조하여 고지서 고객번호와 내부 사업장 ID 간의 1:1 매칭 수행
    - 시공간 정합성 검토: 고지서 내 '사용 기간'과 실적 데이터의 '보고 기간(reporting_date)' 간의 일치 여부 선행 검증

- 2단계 : 수치 상관성 및 정합성 판정
    - 완전 일치 판정 (Match): 사용자 입력값과 OCR 추출값 간의 오차 절대값이 1.0 미만일 경우 정합성 확보로 간주
    - 단위 표기 오류 판정 : 두 데이터 간 1,000배수 또는 1/1000배수 차이 발생 여부 분석 (kWh ↔ MWh 등 단위 기입 오류 탐지)

- 3단계 : 데이터 무결성 진단 및 예외 처리
    - 수치 불일치 판정 (Mismatch): 오차 범위 및 단위 상관성을 벗어난 수치 차이 발생 시 데이터 결함으로 분류

## 4. 데이터 상태 코드 체계
- **0** : 데이터 입력 직후 초기 상태
- **1** :	1차 통계적 검증(Outlier Detection) 통과
- **2** :	outlier_results에 의해 이상치로 분류상태
- **3** :	verification_logs 대조 결과 실적-증빙 수치 불일치
- **4** :	수치는 다르나 단위 기입 오류로 판명됨
- **5** :	증빙과 실적이 완벽히 일치하는 데이터 (공시 가능)