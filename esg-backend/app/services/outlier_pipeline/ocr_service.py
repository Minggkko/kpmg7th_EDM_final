"""
ocr_service.py
--------------
Upstage Document OCR 기반 증빙 파일 처리 모듈.

처리 흐름
---------
1. 업로드된 파일(bytes) → Upstage Document OCR API 호출
2. OCR 원문(HTML/text) → GPT-4o로 구조화 (customer_number, year, month, usage, unit)
3. 구조화 결과 + 원문 → raw_ocr_data 테이블에 저장 (processing_status="Pending")
4. 저장 성공 → 파일명 반환 (이후 extract_pending_ocr_data()로 연계)

Upstage Document OCR
- API: POST https://api.upstage.ai/v1/document-digitization
- 인증: Bearer {UPSTAGE_API_KEY}
- 입력: multipart/form-data (document 필드, 파일 바이너리)
- 출력: {"elements": [...], "html": "...", "text": "..."}

지원 파일
---------
이미지: jpg, jpeg, png, bmp, tiff, tif, heic, webp
문서:   pdf
"""

import json
import logging
import re
from io import BytesIO

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.config import get_settings
from .database_utils import get_supabase_client

logger = logging.getLogger(__name__)

UPSTAGE_OCR_URL = "https://api.upstage.ai/v1/document-digitization"

ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "bmp", "tiff", "tif", "heic", "webp", "pdf"
}

# ── GPT-4o 구조화 프롬프트 ────────────────────────────────────────────────────

_SYSTEM_PROMPT = """
너는 에너지·유틸리티 청구서에서 데이터를 추출하는 ESG 데이터 처리 전문가야.
OCR로 읽어낸 청구서 원문에서 다음 필드를 반드시 추출해야 해.

[추출 대상]
- customer_number : 고객번호 / 계량기번호 / 고객ID (숫자만, 문자 제거)
- year            : 청구 연도 (4자리 정수)
- month           : 청구 월 (1~12 정수)
- usage           : 실제 사용량 수치 (소수점 포함 가능, 쉼표 제거한 순수 숫자)
- unit            : 사용량 단위 (MWh, kWh, Nm3, m3, kL, L, ton 등)

[주의사항]
- usage는 '사용량', '당월지침', '전기사용량', '가스사용량', '보정량' 등 실소비량을 우선.
  청구금액(원), 요금 수치가 아님에 주의.
- unit을 명시하지 않은 경우 문서 유형에 따라 추론 가능 (전기→kWh, 도시가스→Nm3 또는 m3).
- customer_number를 찾을 수 없으면 null로 표기.

[출력 형식] 반드시 아래 JSON만 반환. 설명 텍스트 금지.
{
    "customer_number": "문자열 또는 null",
    "year": 정수,
    "month": 정수,
    "usage": 숫자,
    "unit": "문자열"
}
"""


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _call_upstage_ocr(file_bytes: bytes, file_name: str) -> dict:
    """
    Upstage Document OCR API를 호출하고 응답을 반환합니다.

    Parameters
    ----------
    file_bytes : bytes
        업로드된 파일의 바이너리 데이터
    file_name : str
        파일명 (확장자 포함, Content-Type 판별에 사용)

    Returns
    -------
    dict
        Upstage API 응답 JSON
        {"html": str, "text": str, "elements": list, ...}

    Raises
    ------
    ValueError
        지원하지 않는 파일 형식일 때
    RuntimeError
        Upstage API 호출 실패 시
    """
    settings = get_settings()
    if not settings.upstage_api_key:
        raise RuntimeError("UPSTAGE_API_KEY가 설정되지 않았습니다. .env를 확인하세요.")

    ext = file_name.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"지원하지 않는 파일 형식: {ext}. 지원: {ALLOWED_EXTENSIONS}")

    # Content-Type 결정
    ct_map = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "bmp": "image/bmp",
        "tiff": "image/tiff", "tif": "image/tiff",
        "heic": "image/heic",
        "webp": "image/webp",
    }
    content_type = ct_map.get(ext, "application/octet-stream")

    headers = {"Authorization": f"Bearer {settings.upstage_api_key}"}
    files   = {"document": (file_name, BytesIO(file_bytes), content_type)}
    data    = {"model": "document-parse"}

    try:
        resp = httpx.post(
            UPSTAGE_OCR_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"Upstage OCR API 오류 (HTTP {e.response.status_code}): {e.response.text}"
        )
    except httpx.RequestError as e:
        raise RuntimeError(f"Upstage OCR API 연결 실패: {e}")


def _extract_text_from_ocr(ocr_response: dict) -> str:
    """
    Upstage OCR 응답에서 텍스트를 추출합니다.
    응답 구조: {"api":"2.0", "content": {"html": "...", "text": "..."}, ...}
    """
    # api 2.0: content.text 또는 content.html
    content = ocr_response.get("content", {})
    if isinstance(content, dict):
        text = content.get("text", "").strip()
        if text:
            return text
        html = content.get("html", "")
        return re.sub(r"<[^>]+>", " ", html).strip()

    # 구버전 호환: 최상위 text / html
    text = ocr_response.get("text", "").strip()
    if text:
        return text
    html = ocr_response.get("html", "")
    return re.sub(r"<[^>]+>", " ", html).strip()


def _structure_with_llm(ocr_text: str) -> dict:
    """
    GPT-4o로 OCR 원문을 구조화된 JSON으로 변환합니다.

    Parameters
    ----------
    ocr_text : str
        Upstage OCR 원문 텍스트

    Returns
    -------
    dict
        {"customer_number": str|None, "year": int, "month": int, "usage": float, "unit": str}

    Raises
    ------
    ValueError
        GPT-4o 응답이 유효한 JSON이 아닐 때
    """
    settings = get_settings()
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=settings.openai_api_key,
    )

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=f"[청구서 OCR 원문]\n{ocr_text[:4000]}"),  # 토큰 한계 방어
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    # GPT가 ```json ... ``` 블록으로 감쌀 경우 제거
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"GPT-4o 응답 JSON 파싱 실패: {e}\n원문: {raw}")

    # 필수 필드 검증
    required = {"year", "month", "usage", "unit"}
    missing = required - set(parsed.keys())
    if missing:
        raise ValueError(f"GPT-4o 응답에 필수 필드 누락: {missing}\n원문: {raw}")

    return parsed


def _save_to_raw_ocr_data(
    file_name: str,
    structured: dict,
    ocr_raw_text: str,
    uploaded_by: str,
) -> dict:
    """
    구조화 결과와 OCR 원문을 raw_ocr_data 테이블에 저장합니다.

    Returns
    -------
    dict
        삽입된 raw_ocr_data 레코드
    """
    client = get_supabase_client()

    # raw_ocr_data 실제 컬럼: id, file_name, raw_content(JSONB), ocr_provider, processing_status, extracted_at
    # ocr_raw_text, uploaded_by 컬럼 없음 → raw_content JSONB에 포함
    record = {
        "file_name":         file_name,
        "raw_content":       {
            **structured,
            "ocr_raw_text":  ocr_raw_text[:5000],
            "uploaded_by":   uploaded_by,
        },
        "ocr_provider":      "upstage",
        "processing_status": "Pending",
    }

    result = client.table("raw_ocr_data").insert(record).execute()
    return result.data[0] if result.data else {}


# ── 메인 공개 함수 ─────────────────────────────────────────────────────────────

def process_ocr_upload(
    file_bytes: bytes,
    file_name: str,
    uploaded_by: str,
) -> dict:
    """
    파일을 Upstage OCR로 분석하고 결과를 raw_ocr_data에 저장합니다.

    Parameters
    ----------
    file_bytes : bytes
        업로드된 파일의 바이너리
    file_name : str
        원본 파일명 (확장자 포함)
    uploaded_by : str
        업로드한 사용자 ID

    Returns
    -------
    dict
        {
            "status"      : "success" | "error",
            "file_name"   : str,
            "raw_ocr_id"  : int,            # raw_ocr_data.id
            "structured"  : dict,           # 추출된 구조화 데이터
            "ocr_preview" : str,            # OCR 원문 앞 500자
            "message"     : str,
        }
    """
    try:
        # Step 1: Upstage OCR
        logger.info(f"[ocr_service] Upstage OCR 시작: {file_name}")
        ocr_response = _call_upstage_ocr(file_bytes, file_name)
        ocr_text     = _extract_text_from_ocr(ocr_response)
        logger.info(f"[ocr_service] OCR 완료, 텍스트 길이: {len(ocr_text)}자")

        # Step 2: GPT-4o 구조화
        logger.info("[ocr_service] GPT-4o 구조화 시작")
        structured = _structure_with_llm(ocr_text)
        logger.info(f"[ocr_service] 구조화 완료: {structured}")

        # Step 3: DB 저장
        saved = _save_to_raw_ocr_data(
            file_name=file_name,
            structured=structured,
            ocr_raw_text=ocr_text,
            uploaded_by=uploaded_by,
        )
        raw_ocr_id = saved.get("id")
        logger.info(f"[ocr_service] raw_ocr_data 저장 완료: id={raw_ocr_id}")

        return {
            "status":      "success",
            "file_name":   file_name,
            "raw_ocr_id":  raw_ocr_id,
            "structured":  structured,
            "ocr_preview": ocr_text[:500],
            "message":     f"OCR 처리 완료 — {file_name}",
        }

    except (ValueError, RuntimeError) as e:
        logger.error(f"[ocr_service] 처리 오류 ({file_name}): {e}")
        return {
            "status":      "error",
            "file_name":   file_name,
            "raw_ocr_id":  None,
            "structured":  None,
            "ocr_preview": None,
            "message":     str(e),
        }
    except Exception as e:
        logger.error(f"[ocr_service] 예상치 못한 오류 ({file_name}): {e}")
        return {
            "status":      "error",
            "file_name":   file_name,
            "raw_ocr_id":  None,
            "structured":  None,
            "ocr_preview": None,
            "message":     f"처리 중 오류 발생: {e}",
        }
