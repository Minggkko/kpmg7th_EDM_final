"""
email_service.py
----------------
ESG 시스템 이메일 발송 유틸리티.
SMTP 설정이 없으면 경고 로그만 기록하고 False 반환 (소프트 페일).

지원 기능
---------
- send_confirmation_request() : 이상치 확인 요청 메일 발송
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_confirmation_request(
    to_email: str,
    dp_name: str,
    site: str,
    reporting_date: str,
    value: float,
    unit: str,
    v_status: int,
    due_date: str,
    message: str,
    ai_diagnosis: str | None = None,
    ocr_value: float | None = None,
) -> bool:
    """
    이상치 확인 요청 이메일을 발송합니다.

    Parameters
    ----------
    to_email : str        수신자 이메일 주소
    dp_name  : str        데이터포인트명
    site     : str        사업장명
    reporting_date : str  보고월 (YYYY-MM)
    value    : float      현재 DB 값
    unit     : str        단위
    v_status : int        이상치 상태 코드 (2/3/4)
    due_date : str        처리 기한 (YYYY-MM-DD)
    message  : str        요청 메시지
    ai_diagnosis : str    AI 진단 요약 (선택)
    ocr_value : float     OCR 증빙값 (v_status=2,4일 때 표시)

    Returns
    -------
    bool  전송 성공 여부
    """
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_user:
        logger.warning(
            "[email_service] SMTP 설정이 없어 이메일 전송을 건너뜁니다. "
            "(.env에 SMTP_HOST, SMTP_USER 설정 필요)"
        )
        return False

    # ── v_status별 상태 레이블 ────────────────────────────────────────────────
    status_labels = {
        2: ("검토 필요 ⚠", "#d97706"),
        3: ("소명 필요 ⚠", "#9333ea"),
        4: ("긴급 조치 🚨", "#dc2626"),
    }
    status_text, status_color = status_labels.get(v_status, ("확인 필요", "#555"))

    # ── OCR 값 행 (v_status=2,4일 때만 표시) ─────────────────────────────────
    ocr_row = (
        f"<tr><td style='padding:8px;background:#fff8f1;'><b>OCR 증빙값</b></td>"
        f"<td style='padding:8px;background:#fff8f1;color:#d97706;font-weight:700;'>"
        f"{float(ocr_value):,.2f} {unit}</td></tr>"
        if ocr_value is not None else ""
    )

    # ── AI 진단 블록 ─────────────────────────────────────────────────────────
    ai_block = ""
    if ai_diagnosis:
        try:
            import json
            d = json.loads(ai_diagnosis)
            ai_block = f"""
            <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-top:12px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#5C6B2E;">AI 진단 요약</p>
              {f'<p style="margin:0 0 4px;font-weight:700;color:#dc2626;">{d.get("위험_등급","")}</p>' if d.get("위험_등급") else ""}
              <p style="margin:0 0 4px;">{d.get("진단_요약","")}</p>
              <p style="margin:0;color:#555;font-size:13px;">{d.get("판단_근거_및_해설","")}</p>
            </div>"""
        except Exception:
            ai_block = f"""
            <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-top:12px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#5C6B2E;">AI 진단</p>
              <p style="margin:0;">{ai_diagnosis}</p>
            </div>"""

    html_body = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:'Apple SD Gothic Neo',Arial,sans-serif;margin:0;padding:20px;background:#f4f4f5;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1);">

        <!-- 헤더 -->
        <div style="background:#3D6B2C;padding:20px 28px;">
          <p style="margin:0;color:#fff;font-size:11px;letter-spacing:.1em;opacity:.8;">ESG REPORT SYSTEM</p>
          <h2 style="margin:6px 0 0;color:#fff;font-size:20px;">이상치 데이터 확인 요청</h2>
        </div>

        <!-- 상태 배지 -->
        <div style="padding:16px 28px 0;">
          <span style="display:inline-block;background:{status_color}18;color:{status_color};
                       font-size:12px;font-weight:700;padding:4px 14px;border-radius:20px;
                       border:1px solid {status_color}44;">
            {status_text}
          </span>
        </div>

        <!-- 데이터 정보 -->
        <div style="padding:16px 28px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:8px;background:#f5f7ee;width:120px;font-weight:700;color:#5C6B2E;">데이터포인트</td>
              <td style="padding:8px;background:#f5f7ee;">{dp_name}</td>
            </tr>
            <tr>
              <td style="padding:8px;">사업장</td>
              <td style="padding:8px;">{site}</td>
            </tr>
            <tr>
              <td style="padding:8px;background:#f5f7ee;">보고월</td>
              <td style="padding:8px;background:#f5f7ee;">{reporting_date}</td>
            </tr>
            <tr>
              <td style="padding:8px;">현재 DB 값</td>
              <td style="padding:8px;font-weight:700;">{float(value):,.2f} {unit}</td>
            </tr>
            {ocr_row}
            <tr>
              <td style="padding:8px;background:#fff1f1;"><b>처리 기한</b></td>
              <td style="padding:8px;background:#fff1f1;color:#dc2626;font-weight:700;">{due_date}</td>
            </tr>
          </table>
        </div>

        <!-- 요청 메시지 -->
        <div style="padding:0 28px 16px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;">요청 내용</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;font-size:14px;line-height:1.7;white-space:pre-wrap;">{message}</div>
        </div>

        {ai_block}

        <!-- 푸터 -->
        <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;margin-top:8px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            본 메일은 ESG Report System에서 자동 발송되었습니다.<br>
            처리 기한({due_date})까지 시스템에서 확인·처리해 주세요.
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[ESG 확인요청] {dp_name} — {site} {reporting_date} (기한: {due_date})"
        msg["From"]    = f"{settings.smtp_from_name} <{settings.smtp_user}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_tls:
                server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info(f"[email_service] 확인요청 메일 발송 완료 → {to_email}")
        return True

    except Exception as e:
        logger.error(f"[email_service] 메일 발송 실패 ({to_email}): {e}")
        return False
