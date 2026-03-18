import asyncio
import os
import time
from openai import AsyncOpenAI
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
openai   = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def get_embedding(text: str) -> list[float]:
    response = await openai.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding


async def generate_synonym_embeddings():
    # embedding이 없는 data_point_synonyms 전체 조회
    response = supabase.table("data_point_synonyms") \
        .select("id, term") \
        .is_("embedding", "null") \
        .execute()

    rows = response.data
    total = len(rows)

    if total == 0:
        print("[OK] 모든 data_point_synonyms에 embedding이 이미 존재합니다.")
        return

    print(f"[INFO] embedding 생성 대상: {total}개")
    print("-" * 50)

    success = 0
    failed  = 0

    for i, row in enumerate(rows, start=1):
        try:
            embedding = await get_embedding(row["term"])

            supabase.table("data_point_synonyms") \
                .update({"embedding": embedding}) \
                .eq("id", row["id"]) \
                .execute()

            success += 1
            print(f"  [{i}/{total}] OK  {row['term']}")

        except Exception as e:
            failed += 1
            print(f"  [{i}/{total}] FAIL {row['term']} -> {e}")

        # OpenAI API Rate Limit 방지: 20건마다 1초 대기
        if i % 20 == 0:
            print(f"  [WAIT] Rate limit 방지 대기 (1초)...")
            time.sleep(1)

    print("-" * 50)
    print(f"[DONE] 완료: {success}개 성공 / {failed}개 실패 / 전체 {total}개")


if __name__ == "__main__":
    asyncio.run(generate_synonym_embeddings())
