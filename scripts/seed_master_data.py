"""
seed_master_data.py
--------------------
프로덕션 DB의 마스터 데이터를 테스트 DB로 복사합니다.

실행 방법:
    python -m scripts.seed_master_data

- .env       : 프로덕션 DB (소스)
- .env.test  : 테스트 DB (대상)

복사 대상 테이블 (의존성 순서):
    esg_category → issues → indicators → data → data_points
    → data_point_synonyms → master_sites → activity_data
    → threshold_limits
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client

# ── .env 직접 파싱 (dotenv 없이) ──────────────────────────────────────────────
def load_env(path: str) -> dict:
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
prod_env = load_env(os.path.join(BASE_DIR, ".env"))
test_env = load_env(os.path.join(BASE_DIR, ".env.test"))

prod = create_client(prod_env["SUPABASE_URL"], prod_env["SUPABASE_SERVICE_KEY"])
test = create_client(test_env["SUPABASE_URL"], test_env["SUPABASE_SERVICE_KEY"])

# ── 테이블별 설정 ─────────────────────────────────────────────────────────────
# embedding 컬럼은 vector 타입 → list로 변환 필요
TABLES = [
    {"name": "companies",           "embedding_cols": []},
    {"name": "esg_category",        "embedding_cols": []},
    {"name": "master_sites",        "embedding_cols": []},
    {"name": "issues",              "embedding_cols": []},
    {"name": "indicators",          "embedding_cols": []},
    {"name": "data",                "embedding_cols": []},
    {"name": "data_points",         "embedding_cols": ["embedding"]},
    {"name": "data_point_synonyms", "embedding_cols": ["embedding"]},
]

BATCH = 50


def fix_embeddings(rows: list[dict], embedding_cols: list[str]) -> list[dict]:
    """vector 컬럼 값을 Supabase 삽입 가능한 형태로 변환"""
    if not embedding_cols:
        return rows
    result = []
    for row in rows:
        row = dict(row)
        for col in embedding_cols:
            val = row.get(col)
            if val is None:
                continue
            # 문자열 "[0.1, 0.2, ...]" → list
            if isinstance(val, str):
                val = json.loads(val)
            row[col] = val
        result.append(row)
    return result


def seed_table(table_name: str, embedding_cols: list[str]):
    # 1. 프로덕션에서 전체 읽기
    rows = prod.table(table_name).select("*").execute().data
    if not rows:
        print(f"  [{table_name}] 데이터 없음 — 건너뜀")
        return

    # 2. 테스트 DB 기존 데이터 삭제 (재실행 대비)
    try:
        test.table(table_name).delete().neq("id" if "id" in rows[0] else list(rows[0].keys())[0], -999999).execute()
    except Exception:
        # PK가 id가 아닌 테이블 처리 (master_sites: site_id, threshold_limits: composite)
        pass

    rows = fix_embeddings(rows, embedding_cols)

    # 3. 배치 삽입
    inserted = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        try:
            test.table(table_name).upsert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            print(f"  [{table_name}] 배치 오류 (offset={i}): {e}")

    print(f"  [{table_name}] {inserted}/{len(rows)}건 완료")


def main():
    print("=== 마스터 데이터 시드 시작 ===\n")
    print(f"소스: {prod_env['SUPABASE_URL']}")
    print(f"대상: {test_env['SUPABASE_URL']}\n")

    for t in TABLES:
        seed_table(t["name"], t["embedding_cols"])

    print("\n=== 완료 ===")


if __name__ == "__main__":
    main()
