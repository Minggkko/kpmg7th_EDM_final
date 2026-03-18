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
    """단일 텍스트 임베딩 생성"""
    response = await openai.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding


async def generate_all_embeddings():
    # 1. embedding이 없는 data_points + 상위 data(name) 함께 조회
    response = supabase.table('data_points') \
        .select("id, name, unit, data(name)") \
        .is_('embedding', 'null') \
        .execute()

    rows = response.data
    total = len(rows)

    if total == 0:
        print("✅ 모든 data_points에 embedding이 이미 존재합니다.")
        return

    print(f"📊 embedding 생성 대상: {total}개")
    print("-" * 50)

    success = 0
    failed  = 0

    for i, row in enumerate(rows, start=1):
        # 임베딩 텍스트: name + unit + 상위 data 그룹명 조합 (검색 품질 향상)
        embed_text = f"{row['name']}"
        if row.get('unit'):
            embed_text += f" ({row['unit']})"
        data_group_name = (row.get('data') or {}).get('name')
        if data_group_name:
            embed_text += f" - {data_group_name}"

        try:
            embedding = await get_embedding(embed_text)

            # 2. 해당 row에 embedding 업데이트
            supabase.table('data_points') \
                .update({"embedding": embedding}) \
                .eq('id', row['id']) \
                .execute()

            success += 1
            print(f"  [{i}/{total}] ✅ {row['name']}")

        except Exception as e:
            failed += 1
            print(f"  [{i}/{total}] ❌ {row['name']} → 에러: {e}")

        # OpenAI API Rate Limit 방지: 20건마다 1초 대기
        if i % 20 == 0:
            print(f"  ⏳ Rate limit 방지 대기 (1초)...")
            time.sleep(1)

    print("-" * 50)
    print(f"✅ 완료: {success}개 성공 / {failed}개 실패 / 전체 {total}개")


if __name__ == "__main__":
    asyncio.run(generate_all_embeddings())
