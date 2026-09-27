import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth
import Login from './pages/auth/Login';

// Layouts
import { StaffLayout } from './layouts/StaffLayout';
import { PatientLayout } from './layouts/PatientLayout';

// Staff pages
import StaffDashboard from './pages/staff/StaffDashboard';
import FeedbackList from './pages/staff/FeedbackList';
import FeedbackDetail from './pages/staff/FeedbackDetail';
import Campaigns from './pages/staff/Campaigns';
import Settings from './pages/staff/Settings';

// Patient pages
import PatientFeedback from './pages/patient/PatientFeedback';
import ReviewLanding from './pages/patient/ReviewLanding';
import FeedbackCompleted from './pages/patient/FeedbackCompleted';

// Demo
import DemoLauncher from './pages/demo/DemoLauncher';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root → login */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* Staff routes */}
        <Route path="/staff" element={<StaffLayout />}>
          <Route index element={<StaffDashboard />} />
          <Route path="feedback" element={<FeedbackList />} />
          <Route path="feedback/:id" element={<FeedbackDetail />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Patient routes */}
        <Route path="/patient" element={<PatientLayout />}>
          <Route path="feedback" element={<PatientFeedback />} />
          <Route path="review/:id" element={<ReviewLanding />} />
          <Route path="completed/:id" element={<FeedbackCompleted />} />
        </Route>

        {/* Demo launcher */}
        <Route path="/demo" element={<DemoLauncher />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
