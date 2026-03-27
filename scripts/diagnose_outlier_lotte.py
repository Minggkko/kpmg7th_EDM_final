"""
diagnose_outlier_lotte.py
--------------------------
롯데건설_raw 데이터 이상치 탐지 진단 스크립트.

1. raw CSV를 읽어 표준화 없이 직접 L1/L2/L3 계산
2. DB의 standardized_data 상태 확인 (데이터가 있는지, v_status 무엇인지)
3. 이상치로 판정되면 LLM(GPT-4o) 진단 실행
"""
import os
import sys
import json
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.outlier_pipeline.database_utils import get_supabase_client
from app.core.config import get_settings

settings = get_settings()

# ── 임계값 (outlier_detection.py 동일) ──────────────────────────────────────
L1_Z_THRESHOLD    = 3.0
L1_YOY_THRESHOLD  = 30.0
L3_INTENSITY_THR  = 50.0
SITE_ID           = "롯데건설"
SOURCE_TYPE       = "계열사"

# ────────────────────────────────────────────────────────────────────────────
# PART 1: DB 상태 확인
# ────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("PART 1: DB standardized_data 상태 확인")
print("=" * 60)

client = get_supabase_client()
std_rows = (
    client.table("standardized_data")
    .select("id, metric_name, reporting_date, value, v_status")
    .eq("site_id", SITE_ID)
    .order("reporting_date")
    .execute()
    .data
)

if not std_rows:
    print(f"[경고] standardized_data에 {SITE_ID} 데이터 없음!")
    print("  → 파일이 업로드·표준화되지 않았습니다.")
else:
    from collections import Counter
    v_counts = Counter(r["v_status"] for r in std_rows)
    metrics  = set(r["metric_name"] for r in std_rows)
    print(f"총 {len(std_rows)}건 | v_status 분포: {dict(v_counts)}")
    print(f"지표 목록:")
    for m in sorted(metrics):
        print(f"  - {m}")
print()

# ────────────────────────────────────────────────────────────────────────────
# PART 2: CSV 직접 읽어서 L1 이상치 수동 계산
# ────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("PART 2: CSV 직접 이상치 탐지 (L1 Z-Score / YoY)")
print("=" * 60)

csv_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "testdata", "계열사_롯데건설_raw.csv"
)
df = pd.read_csv(csv_path)
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date").reset_index(drop=True)

# wide → long
metric_cols = [c for c in df.columns if c != "date"]
df_long = df.melt(id_vars=["date"], value_vars=metric_cols,
                  var_name="metric_raw", value_name="value")
df_long["value"] = pd.to_numeric(df_long["value"], errors="coerce")
df_long = df_long.dropna(subset=["value"]).sort_values(["metric_raw","date"]).reset_index(drop=True)

outliers_found = []

for metric, grp in df_long.groupby("metric_raw"):
    grp = grp.reset_index(drop=True)
    if len(grp) < 13:
        print(f"[SKIP] {metric}: 데이터 {len(grp)}건 (최소 13건 필요)")
        continue

    for i in range(12, len(grp)):
        row   = grp.iloc[i]
        val   = float(row["value"])
        win   = grp.iloc[i-12:i]["value"]

        # L1 Z-Score
        mean, std = float(win.mean()), float(win.std())
        z = abs(val - mean) / std if std > 0 else 0.0

        # L1 YoY
        yoy_val = float(grp.iloc[i-12]["value"])
        yoy = abs((val - yoy_val) / yoy_val * 100) if yoy_val != 0 else 0.0

        layers = []
        if z > L1_Z_THRESHOLD:
            layers.append(f"L1-Z(z={z:.1f})")
        if yoy > L1_YOY_THRESHOLD:
            layers.append(f"L1-YoY({yoy:.1f}%)")

        if layers:
            outliers_found.append({
                "metric": metric,
                "date":   row["date"].strftime("%Y-%m-%d"),
                "value":  val,
                "mean_12m": round(mean, 2),
                "z_score":  round(z, 2),
                "yoy_roc":  round(yoy, 2),
                "layers":   ", ".join(layers),
            })
            print(f"[이상치] {row['date'].strftime('%Y-%m')} | {metric}")
            print(f"  값: {val:,.1f} | 12개월평균: {mean:,.1f} | Z={z:.1f} | YoY={yoy:.1f}%")
            print(f"  탐지: {', '.join(layers)}")
            print()

if not outliers_found:
    print("이상치 없음")

# ────────────────────────────────────────────────────────────────────────────
# PART 3: 탐지 안 되는 원인 진단
# ────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("PART 3: outlier-verification 미탐지 원인 분석")
print("=" * 60)

if std_rows:
    v1_count = sum(1 for r in std_rows if r["v_status"] == 1)
    if v1_count == 0:
        print("[원인] v_status=1 인 레코드가 0건 → detect_outliers 탐지 대상 없음")
        print("  → 이미 탐지 실행됨(v_status 변경됨) 또는 표준화 실패(v_status=99)")
    else:
        # audit_trail DETECT 확인
        std_ids = [r["id"] for r in std_rows if r["v_status"] == 1]
        detected = (
            client.table("audit_trail")
            .select("std_id")
            .eq("action", "DETECT")
            .in_("std_id", std_ids)
            .execute()
            .data
        )
        detected_ids = {r["std_id"] for r in detected}
        undetected = [sid for sid in std_ids if sid not in detected_ids]
        print(f"v_status=1 레코드: {v1_count}건")
        print(f"이미 DETECT 기록된 레코드: {len(detected_ids)}건")
        print(f"미탐지(pending) 레코드: {len(undetected)}건")

        # 지표명 매핑 확인
        raw_metrics = set(c for c in df.columns if c != "date")
        std_metrics = set(r["metric_name"] for r in std_rows)
        print(f"\nCSV 컬럼명 예시: {list(raw_metrics)[:3]}")
        print(f"standardized 지표명 예시: {list(std_metrics)[:3]}")

# ────────────────────────────────────────────────────────────────────────────
# PART 4: LLM 진단
# ────────────────────────────────────────────────────────────────────────────
if not outliers_found:
    print("\nLLM 진단 대상 없음")
    sys.exit(0)

print()
print("=" * 60)
print("PART 4: GPT-4o LLM 진단")
print("=" * 60)

from openai import OpenAI

client_llm = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """
너는 ESG 데이터의 정합성을 최종 진단하고 현장에 명확한 가이드를 내리는 'ESG 실무 데이터 감사인'이다.
딱딱한 시스템 용어(L1, L2, L3)를 지우고, 데이터의 성격에 맞는 '현장용 비즈니스 언어'로 재구성하라.

[실무 용어 치환 매핑]
- L1 (Z-score/YoY) → '과거 운영 기록 대비 변동'
- L2 (Physical Limit) → '설비 가동 한계 초과'
- L3 (Intensity Deviation) → '에너지 투입 효율 저하'

[진단 원칙]
1. 서술형으로 풀어서 설명할 것
2. '평소 대비 X배', '상한선 대비 Y% 초과' 형식으로 심각성 부각
3. 임계치 5배 초과 시 단위 오기입(kWh ↔ MWh 등)으로 단정하여 안내
"""

for item in outliers_found:
    ratio = item["value"] / item["mean_12m"] if item["mean_12m"] else 0
    user_prompt = f"""
[진단 대상 데이터]
- 사업장: {SITE_ID} ({item['date']})
- 지표: {item['metric']}
- 측정값: {item['value']:,.1f}
- 12개월 평균: {item['mean_12m']:,.1f} (평소 대비 {ratio:.1f}배)
- Z-Score: {item['z_score']}
- 전년 동월 대비 변화율: {item['yoy_roc']}%
- 탐지 계층: {item['layers']}

위 정보를 바탕으로 아래 JSON 형식으로 진단 보고서를 작성하라.
{{
    "이상치_식별자": "{SITE_ID}_{item['date']}_{item['metric'][:10]}",
    "위험_등급": "Critical/Major/Warning 중 택1",
    "진단_요약": "현장 담당자용 핵심 메시지",
    "판단_근거_및_해설": "비즈니스 언어로 풀어서 설명",
    "추론_가설": "데이터 오기입 또는 현장 이슈 추정",
    "현장_체크리스트": ["점검항목1", "점검항목2", "점검항목3"]
}}
"""
    print(f"\n[{item['date']}] {item['metric'][:30]}")
    print(f"  값: {item['value']:,.1f} | Z={item['z_score']} | YoY={item['yoy_roc']}%")
    try:
        resp = client_llm.chat.completions.create(
            model="gpt-4o",
            temperature=0.1,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = resp.choices[0].message.content.replace("```json","").replace("```","").strip()
        try:
            parsed = json.loads(raw)
            print(f"  위험등급: {parsed.get('위험_등급')}")
            print(f"  진단요약: {parsed.get('진단_요약')}")
            print(f"  추론가설: {parsed.get('추론_가설')}")
            print(f"  체크리스트:")
            for c in parsed.get('현장_체크리스트', []):
                print(f"    - {c}")
        except json.JSONDecodeError:
            print(raw)
    except Exception as e:
        print(f"  LLM 오류: {e}")

print("\n=== 진단 완료 ===")
