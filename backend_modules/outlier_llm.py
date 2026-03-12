"""
outlier_llm.py
--------------
GPT-4o 기반 이상치 AI 진단 모듈.

4_outlier_llm.ipynb 로직을 프로덕션 모듈로 전환합니다.
analysis_summary 가 NULL 인 outlier_results 레코드를 대상으로
GPT-4o 진단 보고서를 생성하고 DB에 업데이트합니다.

v_status 변경 없음 (진단 결과만 outlier_results.analysis_summary UPDATE)
"""

import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from .audit_trail import AuditAction, log_action
from .database_utils import get_supabase_client

logger = logging.getLogger(__name__)

# .env 탐색 (database_utils 와 동일한 경로)
_ROOT = Path(__file__).resolve().parent.parent  # 민석+혁준/
for _p in [_ROOT / ".env"]:
    if _p.exists():
        load_dotenv(dotenv_path=_p, override=False)
        break

# ── 시스템 프롬프트 (4_outlier_llm.ipynb 그대로) ──────────────────────────────
_SYSTEM_INSTRUCTION = """
너는 ESG 데이터의 정합성을 최종 진단하고 현장에 명확한 가이드를 내리는 'ESG 실무 데이터 감사인'이다. 
딱딱한 시스템 용어(L1, L2, L3)를 지우고, 데이터의 성격에 맞는 '현장용 비즈니스 언어'로 재구성하라.

[실무 용어 치환 매핑]
- L1 (Z-score/YoY) -> '과거 운영 기록 대비 변동'
- L2 (Physical Limit) -> '설비 가동 한계 초과'
- L3 (Intensity Deviation) -> '에너지 투입 효율 저하'

[진단 및 해설 원칙]
1. 사람 중심의 해설: 서술형으로 풀어서 설명할 것.
2. 직관적 수치 배수: '평소 대비 X배', '상한선 대비 Y% 초과'를 사용하여 심각성을 부각할 것.
3. Extreme Rule 적용: 임계치의 5배 초과 시 '단위 오기입(kWh ↔ MWh)'으로 단정하여 안내할 것.
"""


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _get_llm() -> ChatOpenAI:
    """GPT-4o 클라이언트를 반환합니다."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "OPENAI_API_KEY 환경 변수가 설정되지 않았습니다."
        )
    return ChatOpenAI(model="gpt-4o", temperature=0.1)


def _build_user_prompt(
    site: str,
    date: str,
    metric_name: str,
    value: float,
    threshold: float,
    layer: str,
    production_qty,
) -> str:
    """GPT-4o 에 전달할 사용자 프롬프트를 구성합니다 (노트북 형식 그대로)."""
    return f"""
    [진단 대상 데이터]
    - 사업장: {site} ({date})
    - 지표: {metric_name}
    - 측정값: {value}
    - 시스템 임계치: {threshold}
    - 탐지 계층: {layer}
    - 해당 월 생산량: {production_qty} Ton
    
    위 정보를 바탕으로 아래 JSON 형식에 맞춰 보고서를 작성하라.
    {{
        "이상치_식별자": "{site}_{date}_{metric_name}",
        "위험_등급": "Critical/Major/Warning 중 택1",
        "진단_요약": "현장 담당자용 핵심 메시지",
        "판단_근거_및_해설": "비즈니스 언어로 풀어서 설명",
        "추론_가설": "데이터 오기입 또는 현장 이슈 추정",
        "현장_체크리스트": ["점검항목1", "점검항목2", "점검항목3"]
    }}
    """


def _parse_llm_response(raw: str) -> str:
    """LLM 응답에서 코드 블록 마커를 제거하고 JSON 문자열을 반환합니다."""
    return raw.replace("```json", "").replace("```", "").strip()


# ── 메인 함수 ─────────────────────────────────────────────────────────────────

def analyze_outlier_with_llm(outlier_id: int = None) -> dict:
    """
    이상치 데이터에 대해 GPT-4o AI 진단을 수행합니다 (4_outlier_llm.ipynb 기반).

    analysis_summary 가 NULL 인 outlier_results 를 대상으로 GPT-4o 진단 보고서를
    생성하고 outlier_results.analysis_summary 를 업데이트합니다.
    v_status 는 변경하지 않습니다.

    Parameters
    ----------
    outlier_id : int, optional
        특정 outlier_results.id 만 처리. None 이면 미처리 전건.

    Returns
    -------
    dict
        {
            "status"  : "success" | "error",
            "data"    : [처리된 진단 결과 목록],
            "message" : str,
            "count"   : int
        }
    """
    try:
        client = get_supabase_client()

        # ── STEP 1: 진단 대상 조회 ─────────────────────────────────────────
        # analysis_summary IS NULL 인 이상치만 대상 (노트북 동일)
        query = (
            client.table("outlier_results")
            .select("*")
            .is_("analysis_summary", "null")
        )
        if outlier_id is not None:
            query = query.eq("id", outlier_id)

        targets = query.execute().data

        if not targets:
            return {
                "status" : "success",
                "data"   : [],
                "message": "진단할 새로운 데이터가 없습니다.",
                "count"  : 0,
            }

        # outlier_results 의 std_id 리스트로 standardized_data 일괄 조회
        std_id_list = [item["std_id"] for item in targets if item.get("std_id")]
        std_rows = (
            client.table("standardized_data")
            .select("*")
            .in_("id", std_id_list)
            .execute()
            .data
        )
        std_map = {r["id"]: r for r in std_rows}  # id → record 인덱스

        logger.info(f"[outlier_llm] 진단 대상: {len(targets)}건")

        # ── STEP 2: LLM 초기화 ────────────────────────────────────────────
        try:
            llm = _get_llm()
        except EnvironmentError as e:
            logger.error(f"[outlier_llm] LLM 초기화 실패: {e}")
            return {"status": "error", "data": [], "message": str(e), "count": 0}

        # ── STEP 3: 건별 진단 루프 ────────────────────────────────────────
        results = []

        for item in targets:
            o_id     = item["id"]
            std_data = std_map.get(item.get("std_id"))
            if not std_data:
                logger.warning(f"[outlier_llm] outlier_id={o_id}: standardized_data 없음 → 스킵")
                continue

            site       = std_data["site_id"]
            date       = std_data["reporting_date"]
            m_name     = std_data["metric_name"]
            val        = float(std_data["value"])
            std_id     = int(std_data["id"])
            layer      = item["layer"]
            threshold  = float(item["threshold"]) if item.get("threshold") else 0.0

            # 해당 월 생산량 별도 조회 (노트북 동일)
            act_res = (
                client.table("activity_data")
                .select("production_qty")
                .eq("site_id", site)
                .eq("reporting_date", date)
                .execute()
            )
            prod = act_res.data[0]["production_qty"] if act_res.data else "기록 없음"

            # ── GPT-4o 호출 ──────────────────────────────────────────────
            user_prompt = _build_user_prompt(
                site, date, m_name, val, threshold, layer, prod
            )
            try:
                response = llm.invoke([
                    SystemMessage(content=_SYSTEM_INSTRUCTION),
                    HumanMessage(content=user_prompt),
                ])
                analysis_json_raw = _parse_llm_response(response.content)
            except Exception as e:
                logger.error(f"[outlier_llm] GPT-4o API 오류 outlier_id={o_id}: {e}")
                continue

            # ── analysis_summary UPDATE ───────────────────────────────────
            try:
                res = (
                    client.table("outlier_results")
                    .update({"analysis_summary": analysis_json_raw})
                    .eq("id", o_id)
                    .execute()
                )
                if not res.data:
                    logger.warning(f"[outlier_llm] analysis_summary UPDATE 응답 없음 outlier_id={o_id}")
            except Exception as e:
                logger.error(f"[outlier_llm] UPDATE 실패 outlier_id={o_id}: {e}")
                continue

            # ── audit_trail 기록 (Rule 2) ─────────────────────────────────
            try:
                # 요약 앞 100자만 reason 에 기록
                summary_preview = analysis_json_raw[:100].replace("\n", " ")
                log_action(
                    std_id=std_id,
                    action=AuditAction.AI_DIAG,
                    performed_by="system",
                    reason=f"GPT-4o analysis: {summary_preview}",
                )
            except Exception as e:
                logger.warning(f"[outlier_llm] audit_trail 기록 실패 std_id={std_id}: {e}")

            # 결과 수집 (JSON 파싱 가능하면 dict, 아니면 raw string)
            try:
                parsed = json.loads(analysis_json_raw)
            except json.JSONDecodeError:
                parsed = {"raw": analysis_json_raw}

            results.append({
                "outlier_id"      : o_id,
                "std_id"          : std_id,
                "site_id"         : site,
                "metric_name"     : m_name,
                "reporting_date"  : date,
                "analysis_summary": parsed,
            })
            logger.info(
                f"[outlier_llm] 완료: {site} {date} {m_name} (outlier_id={o_id})"
            )

        count = len(results)
        return {
            "status" : "success",
            "data"   : results,
            "message": f"{count}건 AI 진단 완료",
            "count"  : count,
        }

    except Exception as e:
        logger.error(f"[outlier_llm] 실행 오류: {e}")
        return {
            "status" : "error",
            "data"   : [],
            "message": str(e),
            "count"  : 0,
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    result = analyze_outlier_with_llm()
    print(json.dumps(result, ensure_ascii=False, indent=2))
