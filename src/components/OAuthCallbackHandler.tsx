// ==============================================================
// Google OAuth Callback Handler Component
// Automatically catches ?code=...&state=... when returning from
// Google accounts consent screen, securely exchanges tokens with the backend,
// and redirects to the Hospital Sheet Sync Hub.
// ==============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiUrl } from '../services/api';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function OAuthCallbackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code) return;

    setStatus('processing');
    setMessage('Securely authenticating with Google...');

    let hospitalId = '11111111-1111-1111-1111-111111111111';
    let returnTo = '/staff/sheet-sync';

    // Decode state
    if (state) {
      try {
        const decoded = atob(state);
        const parsed = JSON.parse(decoded);
        if (parsed.hospitalId) hospitalId = parsed.hospitalId;
        if (parsed.returnTo) returnTo = parsed.returnTo;
      } catch {
        try {
          const parsed = JSON.parse(state);
          if (parsed.hospitalId) hospitalId = parsed.hospitalId;
          if (parsed.returnTo) returnTo = parsed.returnTo;
        } catch {
          // Keep default
        }
      }
    }

    // Exchange authorization code with backend
    const exchange = async () => {
      try {
        const redirectUri = window.location.origin + '/';
        const res = await fetch(apiUrl('/api/auth/google/exchange'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            hospitalId,
            redirectUri,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus('success');
          setMessage(`Connected Google Account: ${data.email || 'Admin'}`);

          // Clean URL query parameters
          window.history.replaceState({}, document.title, window.location.pathname);

          // Delay slightly so the user sees confirmation, then navigate
          setTimeout(() => {
            navigate(returnTo + '?oauth_success=true', { replace: true });
            setStatus('idle');
          }, 1200);
        } else {
          throw new Error(data.error || 'Failed to authenticate Google account.');
        }
      } catch (err: any) {
        console.error('OAuth exchange error:', err);
        setStatus('error');
        setMessage(err.message || 'OAuth authentication failed.');
        // Clean URL query parameters after brief moment
        setTimeout(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setStatus('idle');
        }, 4000);
      }
    };

    exchange();
  }, [location.search, navigate]);

  if (status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        {status === 'processing' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Connecting Google Account</h3>
            <p className="text-xs text-slate-500 mt-1">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-700" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Google Account Connected!</h3>
            <p className="text-xs text-slate-600 mt-1">{message}</p>
            <p className="text-[11px] text-slate-400 mt-2">Redirecting to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7 text-rose-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Connection Failed</h3>
            <p className="text-xs text-rose-600 mt-1">{message}</p>
            <button
              onClick={() => {
                window.history.replaceState({}, document.title, window.location.pathname);
                setStatus('idle');
              }}
              className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
