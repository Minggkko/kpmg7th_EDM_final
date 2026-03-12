import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./DataProcess.css";

function DataProcess() {

  const navigate = useNavigate();
  const location = useLocation();

  const fileName = location.state?.fileName || "uploaded_file.pdf";

  const [progress, setProgress] = useState(0);

  useEffect(() => {

    const timer = setInterval(() => {

      setProgress((p) => {

        if (p >= 100) {

          clearInterval(timer);

          navigate("/analysis-dashboard", {
            state:{fileName}
          });

          return 100;
        }

        return p + 20;

      });

    },900);

    return () => clearInterval(timer);

  },[]);

  const steps = [
    "데이터 조회",
    "이상치 탐지",
    "데이터 입력 검증",
    "데이터 취합",
    "ESG 점수 계산"
  ];

  return (

    <div>
      <Navbar/>

      <div className="process-layout">

        <Sidebar currentStep="process"/>

        <main className="process-container">

          <h1 className="process-title">데이터 분석 진행</h1>

          <p className="process-sub">
            업로드된 ESG 데이터를 분석하고 있습니다
          </p>

          <div className="file-box">
            📄 {fileName}
          </div>

          {/* progress */}
          <div className="progress-wrapper">

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{width:`${progress}%`}}
              />
            </div>

            <span className="progress-text">
              {progress}%
            </span>

          </div>


          <div className="process-list">

            {steps.map((step,i)=>{

              const stepProgress=(i+1)*20;

              let status="대기";

              if(progress>=stepProgress) status="완료";
              else if(progress>=stepProgress-20) status="진행중";

              return(

                <div className={`process-item ${status}`} key={i}>

                  <div className="process-left">

                    <div className="process-number">
                      {i+1}
                    </div>

                    <span className="process-label">
                      {step}
                    </span>

                  </div>

                  <span className={`status ${status}`}>
                    {status}
                  </span>

                </div>

              );

            })}

          </div>

        </main>

      </div>

    </div>

  );
}

export default DataProcess;