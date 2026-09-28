import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Auth / landing
import Login from './pages/auth/Login';

// Super Admin
import SuperAdminPanel from './pages/admin/SuperAdminPanel';

// Hospital & Staff Dashboard
import HospitalDashboard from './pages/staff/HospitalDashboard';
import AutomationDesk from './pages/desk/AutomationDesk';

// Staff ERP
import { StaffLayout } from './layouts/StaffLayout';
import FeedbackList from './pages/staff/FeedbackList';
import FeedbackDetail from './pages/staff/FeedbackDetail';
import Campaigns from './pages/staff/Campaigns';
import Settings from './pages/staff/Settings';

// Public Patient Review Flow (Step 13)
import PublicReviewPage from './pages/review/PublicReviewPage';
import { PatientLayout } from './layouts/PatientLayout';
import PatientFeedback from './pages/patient/PatientFeedback';
import FeedbackCompleted from './pages/patient/FeedbackCompleted';

// Sheet Sync Hub (Part A & B)
import SheetSyncHub from './pages/staff/SheetSyncHub';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Landing & Role Authentication (Step 3) ───────────────── */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* ── Public Patient Review Page (Step 13) ─────────────────── */}
          <Route path="/review" element={<PublicReviewPage />} />
          <Route path="/r/:token" element={<PublicReviewPage />} />

          {/* ── Automation Desk ──────────────────────────────────────── */}
          <Route path="/desk" element={<AutomationDesk />} />

          {/* ── Multi-Hospital Staff & Admin ERP ─────────────────────── */}
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<HospitalDashboard />} />
            <Route path="sheet-sync" element={<SheetSyncHub />} />
            <Route path="super-admin" element={<SuperAdminPanel />} />
            <Route path="feedback" element={<FeedbackList />} />
            <Route path="feedback/:id" element={<FeedbackDetail />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* ── Legacy Patient feedback flow ──────────────────────────── */}
          <Route path="/patient" element={<PatientLayout />}>
            <Route path="feedback" element={<PatientFeedback />} />
            <Route path="review/:id" element={<PublicReviewPage />} />
            <Route path="completed/:id" element={<FeedbackCompleted />} />
          </Route>

          {/* ── Catch-all ────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
