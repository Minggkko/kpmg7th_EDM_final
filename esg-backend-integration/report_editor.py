"""
report_editor.py
─────────────────────────────────────────────────────────────────────────────
목적:
    esg_report_builder.py가 생성한 보고서 초안의 편집·저장을 담당합니다.
    프론트엔드 연동을 염두에 두고 설계되었습니다.

편집 가능 필드:
    - context    : 각 목차 항목의 설명 텍스트
    - commentary : 각 목차 항목의 AI 생성 해설

읽기 전용 필드:
    - data_points.rows : Supabase standardized_data 원본값 (수정 불가)

프론트엔드 연동 설계:
    - 모든 편집 가능 필드는 고유 field_id를 가집니다.
      field_id 형식: "s{esg_id}_i{item_index}"  (예: "s1_i2")
    - 프론트에서 (field_id, field_type, new_value) 를 전달하면
      update_field() → save_draft_file() 순서로 저장합니다.
    - HTML 렌더링 시 data-field-id / data-field-type 속성으로
      프론트 바인딩 지점이 노출됩니다.

초안 파일 구조 (report_draft.json):
    {
      "draft_id"     : "uuid4",
      "generated_at" : "2026-03-19T12:00:00",
      "version"      : 1,
      "sections": [
        {
          "label"  : "환경(E)",
          "esg_id" : 1,
          "items": [
            {
              "field_id" : "s1_i0",
              "title"    : "에너지 사용량",
              "context": {
                "original"      : "원본 텍스트",
                "current"       : "현재 텍스트 (수정 반영)",
                "last_modified" : null  또는  "2026-03-19T12:05:00"
              },
              "commentary": {
                "original"      : "AI 생성 원본",
                "current"       : "현재 텍스트 (수정 반영)",
                "last_modified" : null  또는  "2026-03-19T12:05:00"
              },
              "data_points": [...]   # 읽기 전용 — 수정 대상 아님
            }
          ]
        }
      ]
    }
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


# ── 편집 가능 필드 타입 ────────────────────────────────────────────────────────

EDITABLE_FIELD_TYPES = {"context", "commentary"}


# ═══════════════════════════════════════════════════════════════════════════════
# 1. 초안 저장
# ═══════════════════════════════════════════════════════════════════════════════

def build_draft(sections: list[dict]) -> dict:
    """
    generate_report()가 완성한 sections 구조를 초안 JSON 형식으로 변환합니다.

    각 편집 가능 필드는 original / current / last_modified 구조로 감싸서
    수정 이력을 추적할 수 있도록 합니다.

    Args:
        sections: esg_report_builder.build_report_structure() 반환값.
                  각 item에는 field_id, context, commentary 가 포함되어야 합니다.

    Returns:
        저장 가능한 초안 dict.
    """
    draft_sections = []

    for section in sections:
        draft_items = []

        for item in section["items"]:
            draft_items.append({
                "field_id": item["field_id"],
                "title":    item["title"],
                "context": {
                    "original":      item["context"],
                    "current":       item["context"],
                    "last_modified": None,
                },
                "commentary": {
                    "original":      item.get("commentary", ""),
                    "current":       item.get("commentary", ""),
                    "last_modified": None,
                },
                # data_points는 읽기 전용으로 그대로 포함
                "data_points": item["data_points"],
            })

        draft_sections.append({
            "label":  section["label"],
            "esg_id": section["esg_id"],
            "items":  draft_items,
        })

    return {
        "draft_id":     str(uuid.uuid4()),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "version":      1,
        "sections":     draft_sections,
    }


def save_draft(sections: list[dict], draft_path: str) -> None:
    """
    보고서 섹션 구조를 초안 JSON 파일로 저장합니다.

    Args:
        sections  : esg_report_builder.generate_report()가 완성한 섹션 리스트.
        draft_path: 저장할 파일 경로 (예: "report_draft.json").
    """
    draft = build_draft(sections)

    with open(draft_path, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False, indent=2, default=str)

    print(f"  [Editor] 초안 저장: {draft_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. 초안 로드
# ═══════════════════════════════════════════════════════════════════════════════

def load_draft(draft_path: str) -> dict:
    """
    저장된 초안 JSON 파일을 불러옵니다.

    Args:
        draft_path: 초안 파일 경로.

    Returns:
        초안 dict.

    Raises:
        FileNotFoundError: 파일이 존재하지 않을 때.
        json.JSONDecodeError: 파일 형식이 올바르지 않을 때.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"초안 파일을 찾을 수 없습니다: {draft_path}")

    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. 필드 업데이트
# ═══════════════════════════════════════════════════════════════════════════════

def update_field(
    draft: dict,
    field_id: str,
    field_type: str,
    new_value: str,
) -> dict:
    """
    초안 내 특정 필드의 값을 업데이트합니다.

    프론트엔드에서 사용자가 KEY-IN으로 내용을 수정할 때 호출합니다.
    original은 보존되며, current와 last_modified만 갱신됩니다.

    Args:
        draft      : load_draft()로 불러온 초안 dict.
        field_id   : 수정 대상 항목의 field_id (예: "s1_i0").
        field_type : 수정 대상 필드 타입 ("context" 또는 "commentary").
        new_value  : 사용자가 입력한 새 텍스트.

    Returns:
        업데이트된 초안 dict.

    Raises:
        ValueError: field_type이 편집 불가 필드이거나 field_id를 찾지 못할 때.
    """
    if field_type not in EDITABLE_FIELD_TYPES:
        raise ValueError(
            f"편집 불가 필드입니다: '{field_type}'. "
            f"편집 가능 필드: {EDITABLE_FIELD_TYPES}"
        )

    modified_at = datetime.now().isoformat(timespec="seconds")

    for section in draft["sections"]:
        for item in section["items"]:
            if item["field_id"] == field_id:
                item[field_type]["current"]       = new_value
                item[field_type]["last_modified"] = modified_at
                draft["version"] += 1
                return draft

    raise ValueError(f"field_id를 찾을 수 없습니다: '{field_id}'")


def save_draft_file(draft: dict, draft_path: str) -> None:
    """
    수정된 초안 dict를 파일에 다시 저장합니다.

    update_field() 호출 후 반드시 이 함수를 호출해야 변경 내용이 유지됩니다.

    Args:
        draft      : update_field()로 수정된 초안 dict.
        draft_path : 저장할 파일 경로.
    """
    with open(draft_path, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False, indent=2, default=str)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. 편집 가능 필드 목록 조회
#    프론트엔드에서 "어떤 필드를 편집할 수 있나요?" 를 물을 때 사용합니다.
# ═══════════════════════════════════════════════════════════════════════════════

def get_editable_fields(draft: dict) -> list[dict]:
    """
    초안 내 모든 편집 가능 필드를 평탄한(flat) 리스트로 반환합니다.

    프론트엔드에서 편집 UI를 구성할 때 이 목록을 사용합니다.

    Returns:
        [
          {
            "field_id"      : "s1_i0",
            "section_label" : "환경(E)",
            "item_title"    : "에너지 사용량",
            "field_type"    : "context",       # 또는 "commentary"
            "current_value" : "현재 텍스트",
            "last_modified" : null 또는 "2026-03-19T12:05:00"
          },
          ...
        ]
    """
    result = []
    for section in draft["sections"]:
        for item in section["items"]:
            for ftype in EDITABLE_FIELD_TYPES:
                field_data = item.get(ftype, {})
                result.append({
                    "field_id":      item["field_id"],
                    "section_label": section["label"],
                    "item_title":    item["title"],
                    "field_type":    ftype,
                    "current_value": field_data.get("current", ""),
                    "last_modified": field_data.get("last_modified"),
                })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# 5. 수정 이력 조회
#    마지막으로 수정된 필드들을 확인할 때 사용합니다.
# ═══════════════════════════════════════════════════════════════════════════════

def get_modified_fields(draft: dict) -> list[dict]:
    """
    original과 current가 다른 필드만 필터링하여 반환합니다.
    수정 내역 요약이나 변경 감지에 사용합니다.
    """
    all_fields = get_editable_fields(draft)
    modified   = []

    for field in all_fields:
        field_id = field["field_id"]
        ftype    = field["field_type"]

        # 원본값 찾기
        for section in draft["sections"]:
            for item in section["items"]:
                if item["field_id"] == field_id:
                    original = item[ftype].get("original", "")
                    current  = item[ftype].get("current", "")
                    if original != current:
                        modified.append({
                            **field,
                            "original_value": original,
                        })

    return modified
