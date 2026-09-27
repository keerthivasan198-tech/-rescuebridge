import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth / landing
import Login from './pages/auth/Login';

// Automation desk
import AutomationDesk from './pages/desk/AutomationDesk';

// Staff ERP
import { StaffLayout } from './layouts/StaffLayout';
import StaffDashboard from './pages/staff/StaffDashboard';
import FeedbackList from './pages/staff/FeedbackList';
import FeedbackDetail from './pages/staff/FeedbackDetail';
import Campaigns from './pages/staff/Campaigns';
import Settings from './pages/staff/Settings';

// Patient flow
import { PatientLayout } from './layouts/PatientLayout';
import PatientFeedback from './pages/patient/PatientFeedback';
import ReviewLanding from './pages/patient/ReviewLanding';
import FeedbackCompleted from './pages/patient/FeedbackCompleted';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Landing / hospital setup ─────────────────────────────── */}
        <Route path="/"      element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* ── Automation desk ──────────────────────────────────────── */}
        <Route path="/desk"  element={<AutomationDesk />} />

        {/* ── Staff ERP ────────────────────────────────────────────── */}
        <Route path="/staff" element={<StaffLayout />}>
          <Route index                element={<StaffDashboard />} />
          <Route path="feedback"      element={<FeedbackList />} />
          <Route path="feedback/:id"  element={<FeedbackDetail />} />
          <Route path="campaigns"     element={<Campaigns />} />
          <Route path="settings"      element={<Settings />} />
        </Route>

        {/* ── Patient feedback flow ────────────────────────────────── */}
        <Route path="/patient" element={<PatientLayout />}>
          <Route path="feedback"          element={<PatientFeedback />} />
          <Route path="review/:id"        element={<ReviewLanding />} />
          <Route path="completed/:id"     element={<FeedbackCompleted />} />
        </Route>

        {/* ── Catch-all ────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
