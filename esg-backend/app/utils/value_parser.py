import re
import pandas as pd

# 한글 단위 → 표준 단위 변환 테이블
UNIT_MAP = {
    '톤': 'ton', '천톤': 'kton', '킬로리터': 'kL', '리터': 'L',
    '건': 'cases', '명': 'persons', '개': 'ea',
    '퍼센트': '%', '억원': '100M KRW', '원': 'KRW',
}

# ESG 자주 쓰는 복합 단위 우선 매칭 목록 (숫자 포함 단위)
COMPLEX_UNITS = [
    'tCO2e', 'tCO2', 'kgCO2e', 'kgCO2',
    'CO2e', 'CO2', 'CH4', 'N2O', 'SF6', 'NF3',
    'PM2.5', 'PM10', 'NO2', 'SO2',
    'Nm3', 'Nm³', 'm3', 'm³',
    'GJ/억원', 'kWh/m2', 'kWh/m²',
]


def parse_value_unit(raw_str: str) -> dict:
    """
    "125,000 MWh"  → {"value": 125000.0, "unit": "MWh",   "original": ..., "needs_llm": False}
    "약 1,850톤"   → {"value": 1850.0,   "unit": "ton",   "original": ..., "needs_llm": False}
    "68.5%"        → {"value": 68.5,     "unit": "%",     "original": ..., "needs_llm": False}
    "-"            → {"value": None,     "unit": None,    "original": ..., "needs_llm": False}
    "복잡한 문자열" → {"value": None,    "unit": None,    "original": ..., "needs_llm": True}
    """
    # 빈값/미입력 처리
    if raw_str is None or (isinstance(raw_str, float) and pd.isna(raw_str)):
        return {"value": None, "unit": None, "original": raw_str, "needs_llm": False}

    raw_str = str(raw_str).strip()

    if raw_str in ['-', 'N/A', '', 'nan', 'None']:
        return {"value": None, "unit": None, "original": raw_str, "needs_llm": False}

    # 정규식: (약 옵션) + (숫자/쉼표/소수점) + (공백 옵션) + (단위 옵션)
    pattern = r'^(?:약\s*)?([\d,]+\.?\d*)\s*([a-zA-Z가-힣²³%/·]+)?$'
    match = re.match(pattern, raw_str)

    if match:
        val_str  = match.group(1).replace(',', '')
        unit_str = match.group(2) if match.group(2) else None

        # 한글 단위 → 표준 단위 변환
        if unit_str and unit_str in UNIT_MAP:
            unit_str = UNIT_MAP[unit_str]

        try:
            return {
                "value": float(val_str),
                "unit": unit_str,
                "original": raw_str,
                "needs_llm": False
            }
        except ValueError:
            pass

    # 정규식 실패 → LLM 처리 플래그
    return {"value": None, "unit": None, "original": raw_str, "needs_llm": True}
