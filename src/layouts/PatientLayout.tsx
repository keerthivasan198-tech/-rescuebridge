import React from 'react';
import { Outlet } from 'react-router-dom';
import { Activity } from 'lucide-react';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

export function PatientLayout() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start py-8 px-4"
      style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #fefce8 50%, #fff7ed 100%)' }}
    >
      {/* Clinic branding */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #16a34a, #ea580c)' }}
        >
          <Activity className="h-4 w-4 text-white" aria-hidden />
        </div>
        <span className="text-sm font-bold text-slate-700">{clinicName}</span>
      </div>

      {/* Mobile-width content */}
      <div className="w-full max-w-sm">
        <Outlet />
      </div>

      <p className="mt-8 text-xs text-slate-400 text-center">
        Your feedback is private and handled securely.
      </p>
    </div>
  );
}
