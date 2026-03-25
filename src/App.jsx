import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Materiality from "./pages/Materiality";
import Dashboard from "./pages/Dashboard";
import DataUpload from "./pages/DataUpload";
import Report from "./pages/Report";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import DataProcess from "./pages/DataProcess";
import AnalysisDashboard from "./pages/AnalysisDashboard";
import StandardDataView from "./pages/StandardDataView";
import AnomalyResult from "./pages/AnomalyResult";
import ConsistencyCheck from "./pages/ConsistencyCheck";
import UnverifiedResult from "./pages/UnverifiedResult";
import ReportDraft from "./pages/ReportDraft";
import ReportDownload from "./pages/ReportDownload";
import ReportGenerate from "./pages/ReportGenerate";
import MyPage from "./pages/MyPage";
import DataInputRequest from "./pages/DataInputRequest";
import DataInputUpload from "./pages/DataInputUpload";
import DataAggregation from "./pages/DataAggregation";
import OutlierVerification from "./pages/OutlierVerification";

import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const savedLogin = localStorage.getItem("login");
    if (savedLogin === "true") setIsLoggedIn(true);
  }, []);

  const props = { isLoggedIn, onLogout: () => setIsLoggedIn(false) };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
        <Route path="/" element={<Home {...props} />} />

        {/* 메인 흐름 */}
        <Route path="/materiality"        element={<Materiality {...props} />} />
        <Route path="/standard-data"      element={<StandardDataView {...props} />} />
        <Route path="/anomaly-result"     element={<AnomalyResult {...props} />} />
        <Route path="/consistency-check"  element={<ConsistencyCheck {...props} />} />
        <Route path="/unverified-result"  element={<UnverifiedResult {...props} />} />
        <Route path="/analysis-dashboard" element={<AnalysisDashboard {...props} />} />
        <Route path="/report-generate"    element={<ReportGenerate {...props} />} />
        <Route path="/report-draft"       element={<ReportDraft {...props} />} />
        <Route path="/report-download"    element={<ReportDownload {...props} />} />

        {/* 기타 */}
        <Route path="/dashboard"          element={<Dashboard {...props} />} />
        <Route path="/data-upload"        element={<DataUpload {...props} />} />
        <Route path="/data-process"       element={<DataProcess />} />
        <Route path="/data-input-request" element={<DataInputRequest {...props} />} />
        <Route path="/data-input-upload"  element={<DataInputUpload {...props} />} />
        <Route path="/data-aggregation"   element={<DataAggregation {...props} />} />
        <Route path="/mypage"             element={<MyPage {...props} />} />
        <Route path="/report"             element={<ProtectedRoute isLoggedIn={isLoggedIn}><Report /></ProtectedRoute>} />
        <Route path="/outlier-verification" element={<OutlierVerification {...props} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;