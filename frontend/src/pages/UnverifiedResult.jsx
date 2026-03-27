import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const DUMMY_ITEMS = [
  { id: 1, dpName: "Scope 3 기타 간접배출량", unit: "tCO₂e", value: 3012.1, reason: "공급망 배출량 산정 기준 문서가 업로드되지 않았습니다.", checked: false },
  { id: 2, dpName: "재생에너지 사용량", unit: "MWh", value: 1200.0, reason: "재생에너지 구매 계약서 또는 REC 인증서가 없습니다.", checked: false },
  { id: 3, dpName: "지정폐기물 반출량", unit: "톤", value: 87.5, reason: "지정폐기물 처리업체 계약서 및 처리 확인서가 첨부되지 않았습니다.", checked: false },
  { id: 4, dpName: "여성 임원 비율", unit: "%", value: 18.2, reason: "이사회 구성원 명단 및 성별 확인 문서가 없습니다.", checked: false },
];

export default function UnverifiedResult({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(DUMMY_ITEMS);
  const [popup, setPopup] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = checkedCount === items.length;

  const handleConfirmRequest = () => {
    setItems((prev) => prev.map((i) => (i.id === popup.id ? { ...i, checked: true } : i)));
    setPopup(null);
  };

  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="unverified" />
        <main style={s.main}>

          <div style={s.pageHeader}>
            <div>
              <p style={s.breadcrumb}>데이터 검증</p>
              <h1 style={s.pageTitle}>미증빙자료 검증</h1>
              <p style={s.pageDesc}>증빙자료가 없는 항목을 확인하고 소명해 주세요.</p>
            </div>
            <div style={s.headerRight}>
              <div style={s.progressCircle}>
                <span style={s.progressNum}>
                  <span style={{ color: "#5C6B2E" }}>{checkedCount}</span>/{items.length}
                </span>
              </div>
              <p style={s.progressLabel}>검토 완료</p>
            </div>
          </div>

          <div style={s.divider} />

          <div style={s.tabBar}>
            <div style={{ display: "flex" }}>
              {["이상치 탐지", "정합성 탐지", "미증빙 자료"].map((tab) => (
                <button key={tab} style={tab === "미증빙 자료" ? s.tabActive : s.tab}>{tab}</button>
              ))}
            </div>

            {/* 🔥 여기 버튼 */}
            <button
              style={allChecked ? s.btnPrimary : s.btnDisabled}
              disabled={!allChecked}
              onClick={() => setShowConfirm(true)}
            >
              확정
            </button>
          </div>

          <div style={s.listWrap}>
            <div style={s.colHeader}>
              <span style={{ width: 32 }} />
              <span style={{ flex: 3 }}>데이터 포인트</span>
              <span style={{ flex: 2 }}>미증빙 사유</span>
              <span style={{ flex: 1, textAlign: "center" }}>상태</span>
            </div>

            {items.map((item, idx) => (
              <div
                key={item.id}
                style={{ ...s.listRow, borderBottom: idx < items.length - 1 ? "1px solid #f0ede8" : "none" }}
                onClick={() => setPopup(item)}
              >
                <div style={{ width: 32, display: "flex", justifyContent: "center" }}>
                  <div style={{ ...s.checkbox, ...(item.checked ? s.checkboxChecked : {}) }}>
                    {item.checked && <span style={s.checkMark}>✓</span>}
                  </div>
                </div>

                <div style={{ flex: 3 }}>
                  <span style={s.dpName}>{item.dpName}</span>
                  <span style={s.dpUnit}>{item.unit}</span>
                </div>

                <div style={{ flex: 2 }}>
                  <span style={s.reasonText}>{item.reason}</span>
                </div>

                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  {item.checked
                    ? <span style={s.statusDone}>완료</span>
                    : <span style={s.statusNeed}>검토 필요 →</span>}
                </div>
              </div>
            ))}
          </div>

        </main>
      </div>

      {/* 팝업 */}
      {popup && (
        <div style={s.overlay} onClick={() => setPopup(null)}>
          <div style={s.popupBox} onClick={(e) => e.stopPropagation()}>
            <div style={s.popupHeader}>
              <div>
                <p style={s.popupBreadcrumb}>미증빙자료 소명</p>
                <h2 style={s.popupTitle}>{popup.dpName}</h2>
              </div>
              <button style={s.closeBtn} onClick={() => setPopup(null)}>✕</button>
            </div>

            <div style={s.popupDivider} />

            <div style={s.valueBox}>
              <p style={s.valueLabel}>현재 입력값</p>
              <p style={s.valueNum}>{popup.value.toLocaleString()} <span style={s.valueUnit}>{popup.unit}</span></p>
            </div>

            <div style={s.reasonBox}>
              <p style={s.reasonBoxLabel}>미증빙 사유</p>
              <p style={s.reasonBoxDesc}>{popup.reason}</p>
            </div>

            <div style={s.infoBox}>
              <span>ℹ️</span>
              <span style={s.infoText}>확인 요청 클릭 시 현재 입력값을 유지하고 검토 완료 처리됩니다.</span>
            </div>

            <div style={s.popupBtns}>
              <button style={s.cancelBtn} onClick={() => setPopup(null)}>취소</button>
              <button style={s.confirmRequestBtn} onClick={handleConfirmRequest}>확인 요청</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 여기 핵심 수정 */}
      {showConfirm && (
        <div style={s.overlay}>
          <div style={s.confirmModal}>
            <p style={s.confirmTitle}>최종 확정</p>
            <p style={s.confirmDesc}>미증빙자료 검증을 완료하고 다음 단계로 이동하시겠습니까?</p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button style={s.cancelBtn} onClick={() => setShowConfirm(false)}>취소</button>

              {/* ✅ 여기 수정됨 */}
              <button
                style={s.btnPrimary}
                onClick={() => {
                  setShowConfirm(false);
                  navigate("/outlier-verification"); // ⭐ 핵심
                }}
              >
                확정 및 이동
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}