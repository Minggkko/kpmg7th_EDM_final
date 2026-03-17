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

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.config import get_settings
from .audit_trail import AuditAction, log_action
from .database_utils import get_supabase_client

logger = logging.getLogger(__name__)

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
    settings = get_settings()
    return ChatOpenAI(model="gpt-4o", temperature=0.1, api_key=settings.openai_api_key)


def _build_user_prompt(
    site: str,
    date: str,
    metric_name: str,
    value: float,
    threshold: float,
    layer: str,
    production_qty,
    v_status: int,
    ocr_value: float | None,
    gap_percent: float,
    unit_mismatch: bool,
) -> str:
    """GPT-4o 에 전달할 사용자 프롬프트를 구성합니다.

    v_status (2/3/4) 에 따라 검증 상황 설명을 다르게 구성합니다.
    """
    # ── v_status별 검증 상황 설명 ──────────────────────────────────────────────
    if v_status == 2:
        case_context = f"""
[검증 상황]
이상치 탐지는 통과(정상 범위)했으나, 증빙자료(OCR)와 값이 다릅니다.
DB 값: {value} / OCR 값: {ocr_value} / 오차: {gap_percent:.1f}%
원인 추정: 수동 입력 오류 또는 OCR 인식 오류.
담당자가 어느 값이 맞는지 판단해야 합니다.
"""
    elif v_status == 3:
        case_context = f"""
[검증 상황]
이상치가 탐지되었으나, 증빙자료(OCR)와는 값이 일치합니다.
DB 값: {value} (= OCR 값과 동일)
즉, 이 값이 실제 측정값일 가능성이 높습니다.
원인 추정: 설비 교체, 공정 변경, 특수 운영 상황(야간작업 증가 등).
데이터 수정은 금지되며, 이상치 원인 소명이 필요합니다.
"""
    elif v_status == 4:
        case_context = f"""
[검증 상황]
이상치가 탐지되었고, 증빙자료(OCR)와도 값이 다릅니다.
DB 값: {value} / OCR 값: {ocr_value} / 오차: {gap_percent:.1f}%
OCR 값으로 자동 수정이 진행됩니다.
원인 추정: 실제 이상 현상 + 입력 오류 복합 가능성.
수정 후 이상치 원인 소명이 필요합니다.
"""
    else:
        case_context = ""

    # ── 단위 오류 경고 (v_status 무관) ────────────────────────────────────────
    unit_warning = ""
    if unit_mismatch:
        unit_warning = """
[단위 오류 경고]
DB 값과 증빙자료의 차이가 약 1000배입니다.
kWh ↔ MWh, Nm3 ↔ kNm3 등 단위 오기입 가능성을 반드시 확인하세요.
"""

    return f"""
    [진단 대상 데이터]
    - 사업장: {site} ({date})
    - 지표: {metric_name}
    - 측정값: {value}
    - 시스템 임계치: {threshold}
    - 탐지 계층: {layer}
    - 해당 월 생산량: {production_qty} Ton
    {case_context}{unit_warning}
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

            # v_status 조회 — 5(정상 확정)는 LLM 분석 불필요
            v_status = int(std_data.get("v_status", 0))
            if v_status == 5:
                logger.info(
                    f"[outlier_llm] outlier_id={o_id}: v_status=5 (자동 확정) → 스킵"
                )
                continue

            # verification_logs 에서 증빙 비교 결과 조회
            vlog = (
                client.table("verification_logs")
                .select("ocr_value, gap_percent, unit_mismatch")
                .eq("std_id", std_id)
                .order("verified_at", desc=True)
                .limit(1)
                .execute()
                .data
            )
            ocr_value     = float(vlog[0]["ocr_value"])    if vlog and vlog[0].get("ocr_value")    is not None else None
            gap_percent   = float(vlog[0]["gap_percent"])  if vlog and vlog[0].get("gap_percent")  is not None else 0.0
            unit_mismatch = bool(vlog[0]["unit_mismatch"]) if vlog                                              else False

            # 해당 월 생산량 별도 조회
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
                site, date, m_name, val, threshold, layer, prod,
                v_status=v_status,
                ocr_value=ocr_value,
                gap_percent=gap_percent,
                unit_mismatch=unit_mismatch,
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
