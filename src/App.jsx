import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import ESGSelect from "./pages/ESGSelect";
import Materiality from "./pages/Materiality";
import IssueSelect from "./pages/IssueSelect";
import Dashboard from "./pages/Dashboard";
import DataUpload from "./pages/DataUpload";
import Report from "./pages/Report";

import SignUp from "./pages/SignUp";
import Login from "./pages/Login";

import ProtectedRoute from "./components/ProtectedRoute";
import DataProcess from "./pages/DataProcess";
import AnalysisDashboard from "./pages/AnalysisDashboard";

import DataViewPage from "./pages/DataViewPage";
import AnomalyResult from "./pages/AnomalyResult";
import DataInputRequest from "./pages/DataInputRequest";
import DataInputUpload from "./pages/DataInputUpload";
import DataAggregation from "./pages/DataAggregation";

// SR 보고서
import ReportDraft from "./pages/ReportDraft";
import ReportDownload from "./pages/ReportDownload";
import MyPage from "./pages/MyPage";
import ReportGenerate from "./pages/ReportGenerate";
import StandardDataView from "./pages/StandardDataView";
import ConsistencyCheck from "./pages/ConsistencyCheck";
import UnverifiedResult from "./pages/UnverifiedResult";
import ConsistencyCheck from "./pages/ConsistencyCheck";

import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const savedLogin = localStorage.getItem("login");
    if (savedLogin === "true") {
      setIsLoggedIn(true);
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignUp />} />

        <Route
          path="/login"
          element={<Login onLogin={() => setIsLoggedIn(true)} />}
        />

        <Route
          path="/"
          element={
            <Home
              isLoggedIn={isLoggedIn}
              onLogout={() => setIsLoggedIn(false)}
            />
          }
        />

        <Route
          path="/esg-select"
          element={
            <ESGSelect
              isLoggedIn={isLoggedIn}
              onLogout={() => setIsLoggedIn(false)}
            />
          }
        />

        <Route path="/materiality" element={<Materiality />} />

        <Route
          path="/issue-select"
          element={
            <IssueSelect
              isLoggedIn={isLoggedIn}
              onLogout={() => setIsLoggedIn(false)}
            />
          }
        />

        <Route
          path="/dashboard"
          element={
            <Dashboard
              isLoggedIn={isLoggedIn}
              onLogout={() => setIsLoggedIn(false)}
            />
          }
        />

        <Route
          path="/data-upload"
          element={
            <DataUpload
              isLoggedIn={isLoggedIn}
              onLogout={() => setIsLoggedIn(false)}
            />
          }
        />

        <Route
          path="/report"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <Report />
            </ProtectedRoute>
          }
        />

        <Route path="/data-process" element={<DataProcess />} />

        <Route
          path="/analysis-dashboard"
          element={
            <AnalysisDashboard
              isLoggedIn={isLoggedIn}
              onLogout={() => setIsLoggedIn(false)}
            />
          }
        />

        {/* 데이터 수집 */}
        <Route path="/data-view" element={<DataViewPage isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/anomaly-result" element={<AnomalyResult isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/data-input-request" element={<DataInputRequest isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/data-input-upload" element={<DataInputUpload isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/data-aggregation" element={<DataAggregation isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/standard-data" element={<StandardDataView isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />

        {/* SR 보고서 */}
        <Route path="/report-draft" element={<ReportDraft isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/report-download" element={<ReportDownload isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/report-generate" element={<ReportGenerate isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/mypage" element={<MyPage isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/consistency-check" element={<ConsistencyCheck isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/unverified-result" element={<UnverifiedResult isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />
        <Route path="/consistency-check" element={<ConsistencyCheck isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;