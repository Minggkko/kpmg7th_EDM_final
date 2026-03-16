"""
ESG Backend - End-to-End Pipeline Test
======================================
실행 전 확인사항:
  1. uvicorn 서버가 http://localhost:8000 에서 실행 중이어야 합니다.
  2. 아래 IMAGE_GAS / IMAGE_ELEC 경로에 청구서 JPG 이미지가 존재해야 합니다.
  3. Supabase에서 raw_data / raw_ocr_data / standardized_data 테이블을 미리 초기화해야 합니다.
     (이 스크립트 실행 전에 Supabase SQL 에디터에서 backup_and_clear.sql 실행)

실행 방법:
  conda activate esg-backend
  python test_e2e.py
"""

import requests
import sys
import json
import os

BASE_URL = "http://localhost:8000/api/v1"

# ── 파일 경로 설정 ──────────────────────────────────────────────────────────────
PREPROCESSING_DIR = r"C:\MyDrive\KPMG7th_lab\last_project_test\esg-backend\Preprocessing_file"

CSV_SAMSUNG = os.path.join(PREPROCESSING_DIR, "계열사_삼성물산_raw.csv")
CSV_SEC     = os.path.join(PREPROCESSING_DIR, "자회사_삼성전자_raw.csv")
IMAGE_GAS   = os.path.join(PREPROCESSING_DIR, "ocr_test", "gas_bill.jpg")
IMAGE_ELEC  = os.path.join(PREPROCESSING_DIR, "ocr_test", "electric_bill.jpg")

# ── 테스트 계정 설정 ────────────────────────────────────────────────────────────
TEST_USERNAME = "e2e_tester_01"
TEST_PASSWORD = "Test1234!"
TEST_DISPLAY  = "E2E 테스터"

# ── 유틸리티 ────────────────────────────────────────────────────────────────────

def ok(label: str, res: requests.Response, expect=200):
    passed = res.status_code == expect
    mark = "[PASS]" if passed else "[FAIL]"
    print(f"  {mark} {label} → HTTP {res.status_code}")
    if not passed:
        try:
            print(f"         {res.json()}")
        except Exception:
            print(f"         {res.text[:300]}")
    return passed

def header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def check_files():
    missing = []
    for path in [CSV_SAMSUNG, CSV_SEC]:
        if not os.path.exists(path):
            missing.append(path)
    for path in [IMAGE_GAS, IMAGE_ELEC]:
        if not os.path.exists(path):
            missing.append(path)
    return missing

# ════════════════════════════════════════════════════════════════════════════════
# STEP 0 : 파일 존재 확인
# ════════════════════════════════════════════════════════════════════════════════
def step0_preflight():
    print("\n[STEP 0] 파일 존재 확인")
    missing = check_files()
    if missing:
        print("  [WARN] 누락된 파일:")
        for f in missing:
            print(f"         - {f}")
        if IMAGE_GAS in missing or IMAGE_ELEC in missing:
            print("\n  ** 아래 경로에 청구서 이미지를 저장 후 재실행하세요 **")
            print(f"     가스 청구서  → {IMAGE_GAS}")
            print(f"     전기 청구서  → {IMAGE_ELEC}")
            return False
    else:
        print("  [PASS] 모든 파일 확인")
    return True

# ════════════════════════════════════════════════════════════════════════════════
# STEP 1 : 서버 헬스체크
# ════════════════════════════════════════════════════════════════════════════════
def step1_health():
    print("\n[STEP 1] 서버 헬스체크")
    try:
        res = requests.get("http://localhost:8000/health", timeout=5)
        ok("GET /health", res)
        return res.status_code == 200
    except requests.exceptions.ConnectionError:
        print("  [FAIL] 서버에 연결할 수 없습니다. uvicorn을 먼저 실행하세요.")
        print("         uvicorn app.main:app --reload --port 8000")
        return False

# ════════════════════════════════════════════════════════════════════════════════
# STEP 2 : 회사 조회 (회원가입에 필요한 company_id, email_domain 파악)
# ════════════════════════════════════════════════════════════════════════════════
def step2_get_company():
    print("\n[STEP 2] 회사 목록 조회")
    res = requests.get(f"{BASE_URL}/auth/companies", timeout=10)
    ok("GET /auth/companies", res)
    companies = res.json() if res.status_code == 200 else []
    if not companies:
        print("  [FAIL] 회사 데이터가 없습니다. Supabase companies 테이블을 확인하세요.")
        return None, None
    print(f"  회사 목록 ({len(companies)}건):")
    for c in companies[:5]:
        print(f"    id={c['id']:3d}  name={c['name']:<20s}  domain={c['email_domain']}")
    # 첫 번째 회사 사용
    company = companies[0]
    print(f"  → 사용할 회사: id={company['id']}, domain={company['email_domain']}")
    return company['id'], company['email_domain']

# ════════════════════════════════════════════════════════════════════════════════
# STEP 3 : 회원가입
# ════════════════════════════════════════════════════════════════════════════════
def step3_signup(company_id: int, email_domain: str):
    print("\n[STEP 3] 회원가입")
    work_email = f"{TEST_USERNAME}@{email_domain}"
    payload = {
        "username":     TEST_USERNAME,
        "password":     TEST_PASSWORD,
        "display_name": TEST_DISPLAY,
        "work_email":   work_email,
        "company_id":   company_id,
    }
    res = requests.post(f"{BASE_URL}/auth/signup", json=payload, timeout=15)
    if res.status_code == 400 and "이미 사용 중인" in res.text:
        print("  [INFO] 이미 등록된 계정 → 로그인 단계로 스킵")
        return True
    return ok("POST /auth/signup", res, expect=200)

# ════════════════════════════════════════════════════════════════════════════════
# STEP 4 : 로그인
# ════════════════════════════════════════════════════════════════════════════════
def step4_login() -> str | None:
    print("\n[STEP 4] 로그인")
    res = requests.post(f"{BASE_URL}/auth/login",
                        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
                        timeout=15)
    if not ok("POST /auth/login", res):
        return None
    data = res.json()
    token = data.get("access_token")
    print(f"  user_id : {data.get('user_id')}")
    print(f"  token   : {token[:40]}...")
    return token

# ════════════════════════════════════════════════════════════════════════════════
# STEP 5 : 내 정보 확인
# ════════════════════════════════════════════════════════════════════════════════
def step5_me(token: str):
    print("\n[STEP 5] 내 정보 확인 (토큰 검증)")
    res = requests.get(f"{BASE_URL}/auth/me", headers=header(token), timeout=10)
    ok("GET /auth/me", res)
    if res.status_code == 200:
        print(f"  {res.json()}")

# ════════════════════════════════════════════════════════════════════════════════
# STEP 6 : CSV 업로드 (raw_data 저장 + 표준화 자동 실행)
# ════════════════════════════════════════════════════════════════════════════════
def step6_upload_csv(token: str):
    print("\n[STEP 6] CSV 파일 업로드 (raw_data + 자동 표준화)")
    results = []
    for csv_path in [CSV_SAMSUNG, CSV_SEC]:
        fname = os.path.basename(csv_path)
        print(f"\n  ▶ {fname}")
        with open(csv_path, "rb") as f:
            res = requests.post(
                f"{BASE_URL}/raw-data/upload",
                headers=header(token),
                files={"file": (fname, f, "text/csv")},
                timeout=120,
            )
        passed = ok(f"  POST /raw-data/upload [{fname}]", res)
        if passed:
            data = res.json()
            mapping = data.get("mapping_result", {})
            print(f"    source_type    : {data.get('source_type')}")
            print(f"    site_id        : {data.get('site_id')}")
            print(f"    raw rows       : {data.get('row_count')}")
            print(f"    standardized   : {mapping.get('success', 0)}건 성공 / "
                  f"{mapping.get('skipped_match', 0)}건 미매칭 / "
                  f"{mapping.get('unit_error', 0)}건 단위오류")
        results.append(passed)
    return all(results)

# ════════════════════════════════════════════════════════════════════════════════
# STEP 7 : JPG OCR 업로드 (raw_ocr_data 저장)
# ════════════════════════════════════════════════════════════════════════════════
def step7_upload_ocr(token: str):
    print("\n[STEP 7] 청구서 이미지 OCR 업로드 (raw_ocr_data)")
    results = []
    for img_path, label in [(IMAGE_GAS, "가스 청구서"), (IMAGE_ELEC, "전기 청구서")]:
        if not os.path.exists(img_path):
            print(f"\n  [SKIP] {label} 파일 없음: {img_path}")
            results.append(None)
            continue
        fname = os.path.basename(img_path)
        print(f"\n  ▶ {label} ({fname})")
        with open(img_path, "rb") as f:
            res = requests.post(
                f"{BASE_URL}/evidence/upload-ocr",
                headers=header(token),
                files={"file": (fname, f, "image/jpeg")},
                timeout=120,
            )
        passed = ok(f"  POST /evidence/upload-ocr [{fname}]", res)
        if passed:
            data = res.json()
            print(f"    status         : {data.get('status')}")
            print(f"    ocr_id         : {data.get('raw_ocr_id')}")
            structured = data.get("structured") or {}
            print(f"    customer_number: {structured.get('customer_number')}")
            print(f"    year/month     : {structured.get('year')}/{structured.get('month')}")
            print(f"    usage          : {structured.get('usage')} {structured.get('unit')}")
        results.append(passed)
    return results

# ════════════════════════════════════════════════════════════════════════════════
# STEP 8 : raw_data 목록 조회 확인
# ════════════════════════════════════════════════════════════════════════════════
def step8_check_raw(token: str):
    print("\n[STEP 8] raw_data 저장 확인")
    res = requests.get(f"{BASE_URL}/raw-data/", headers=header(token), timeout=10)
    ok("GET /raw-data/", res)
    if res.status_code == 200:
        data = res.json()
        count = len(data) if isinstance(data, list) else data.get("count", "?")
        print(f"  저장된 raw_data 건수: {count}")

# ════════════════════════════════════════════════════════════════════════════════
# STEP 9: standardized_data 현황 조회 (mapping API로 확인)
# ════════════════════════════════════════════════════════════════════════════════
def step9_check_standardized(token: str):
    print("\n[STEP 9] standardized_data 현황 확인 (재매핑으로 결과 재출력)")
    # 이미 step6에서 자동 실행되었으나, 명시적으로 한 번 더 확인
    for source_type, site_id in [("계열사", "삼성물산"), ("자회사", "삼성전자")]:
        res = requests.post(
            f"{BASE_URL}/mapping/run",
            headers=header(token),
            params={"source_type": source_type, "site_id": site_id},
            timeout=120,
        )
        if res.status_code == 200:
            data = res.json()
            print(f"  [{source_type}/{site_id}]")
            print(f"    success={data.get('success')}  skipped_parse={data.get('skipped_parse')}  "
                  f"skipped_match={data.get('skipped_match')}  unit_error={data.get('unit_error')}")
        else:
            ok(f"  POST /mapping/run [{source_type}/{site_id}]", res)

# ════════════════════════════════════════════════════════════════════════════════
# STEP 10: outlier detection 실행 (v_status 0 → 1 or 2)
# ════════════════════════════════════════════════════════════════════════════════
def step10_outlier_detect(token: str):
    print("\n[STEP 10] 이상치 탐지 실행 (v_status: 0 → 1 or 2)")
    res = requests.post(
        f"{BASE_URL}/outliers/detect",
        headers=header(token),
        timeout=120,
    )
    ok("POST /outliers/detect", res)
    if res.status_code == 200:
        data = res.json()
        print(f"  status  : {data.get('status')}")
        print(f"  count   : {data.get('count')} (이상치 탐지 건수)")
        print(f"  message : {data.get('message')}")

# ════════════════════════════════════════════════════════════════════════════════
# STEP 11: v_status 분포 확인 (대시보드 status-summary)
# ════════════════════════════════════════════════════════════════════════════════
def step11_status_summary(token: str):
    print("\n[STEP 11] v_status 분포 확인")
    res = requests.get(
        f"{BASE_URL}/dashboard/status-summary",
        headers=header(token),
        timeout=20,
    )
    ok("GET /dashboard/status-summary", res)
    if res.status_code == 200:
        # 응답: [{site_id, v_status, v_status_label, count}, ...]
        rows = res.json()
        # v_status별 합산
        totals: dict[int, tuple] = {}
        for r in rows:
            code  = int(r["v_status"])
            label = r.get("v_status_label", "")
            cnt   = int(r.get("count", 0))
            prev  = totals.get(code, (label, 0))
            totals[code] = (prev[0], prev[1] + cnt)
        for code in sorted(totals):
            label, cnt = totals[code]
            print(f"  v_status={code:2d}  {label:<22s}: {cnt}건")

# ════════════════════════════════════════════════════════════════════════════════
# STEP 12: OCR 증빙 추출 (raw_ocr_data Pending → evidence_usage)
# ════════════════════════════════════════════════════════════════════════════════
def step12_evidence_extract(token: str):
    print("\n[STEP 12] OCR 증빙 추출 (raw_ocr_data → evidence_usage)")
    print("  [INFO] site_metric_map 에 customer_number 매핑이 있어야 적재됩니다.")
    res = requests.post(
        f"{BASE_URL}/evidence/extract",
        headers=header(token),
        timeout=60,
    )
    ok("POST /evidence/extract", res)
    if res.status_code == 200:
        data = res.json()
        print(f"  status  : {data.get('status')}")
        print(f"  count   : {data.get('count')} (evidence_usage 적재 건수)")
        print(f"  message : {data.get('message')}")
        for item in (data.get("data") or []):
            print(f"    → {item.get('site_id')}/{item.get('metric_name')}"
                  f"  {item.get('reporting_date')}  {item.get('ocr_value')} {item.get('unit')}")

# ════════════════════════════════════════════════════════════════════════════════
# STEP 13: 증빙 정합성 검증 (evidence_usage ↔ standardized_data → v_status 5/3/4)
# ════════════════════════════════════════════════════════════════════════════════
def step13_evidence_verify(token: str):
    print("\n[STEP 13] 증빙 정합성 검증 (evidence_usage ↔ standardized_data)")
    print("  [INFO] v_status=1 레코드와 evidence_usage를 비교합니다.")
    res = requests.post(
        f"{BASE_URL}/evidence/verify",
        headers=header(token),
        timeout=60,
    )
    ok("POST /evidence/verify", res)
    if res.status_code == 200:
        data = res.json()
        print(f"  status  : {data.get('status')}")
        print(f"  count   : {data.get('count')} (검증 처리 건수)")
        print(f"  message : {data.get('message')}")
        for item in (data.get("data") or []):
            vstatus = item.get("new_v_status")
            label = {3: "Mismatch", 4: "UnitError", 5: "Verified"}.get(vstatus, str(vstatus))
            print(f"    → {item.get('site_id')}/{item.get('metric_name')}"
                  f"  gap={item.get('gap_percent'):.2f}%  v_status={vstatus}({label})")

# ════════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════════
def main():
    print("=" * 70)
    print("  ESG Backend - End-to-End Pipeline Test")
    print("=" * 70)

    # 파일 확인
    ok_files = step0_preflight()

    # 서버 확인
    if not step1_health():
        sys.exit(1)

    # 회사 정보
    company_id, email_domain = step2_get_company()
    if company_id is None:
        sys.exit(1)

    # 회원가입
    step3_signup(company_id, email_domain)

    # 로그인
    token = step4_login()
    if not token:
        sys.exit(1)

    # 내 정보 확인
    step5_me(token)

    # CSV 업로드 (raw_data + 자동 표준화)
    step6_upload_csv(token)

    # OCR 업로드 (이미지가 있을 때만)
    if ok_files:
        step7_upload_ocr(token)
    else:
        print("\n[STEP 7] OCR 이미지 파일 없음 → SKIP")
        print(f"  ▶ 가스 청구서 이미지를  저장하세요: {IMAGE_GAS}")
        print(f"  ▶ 전기 청구서 이미지를 저장하세요: {IMAGE_ELEC}")

    # 조회 확인
    step8_check_raw(token)
    step9_check_standardized(token)

    # 이상치 탐지 (v_status 0 → 1 or 2)
    step10_outlier_detect(token)

    # v_status 분포 확인
    step11_status_summary(token)

    # OCR 증빙 추출 (raw_ocr_data Pending → evidence_usage)
    step12_evidence_extract(token)

    # 증빙 정합성 검증 (evidence_usage ↔ standardized_data → v_status 5/3/4)
    step13_evidence_verify(token)

    # 최종 v_status 분포 재확인
    print("\n[STEP 14] 최종 v_status 분포 재확인")
    step11_status_summary(token)

    print("\n" + "=" * 70)
    print("  테스트 완료.")
    print("  Supabase Table Editor에서 아래 테이블을 확인하세요:")
    print("    - raw_data          (CSV 파싱 결과)")
    print("    - raw_ocr_data      (OCR 구조화 결과, processing_status=Extracted/Success)")
    print("    - standardized_data (매핑/표준화 결과, v_status=1/5 목표)")
    print("    - evidence_usage    (OCR 증빙 정형화 결과)")
    print("    - verification_logs (gap 검증 로그)")
    print("    - outlier_results   (이상치 탐지 결과)")
    print("=" * 70)


if __name__ == "__main__":
    main()
