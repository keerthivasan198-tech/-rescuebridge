import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Globe,
  Star,
  ArrowRight,
  Lock,
  Building2,
  Link2,
  CheckCircle2,
  Zap,
  Database,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Shared tiny components
// ---------------------------------------------------------------------------
function StatusPill({
  icon,
  label,
  color = 'green',
}: {
  icon: React.ReactNode;
  label: string;
  color?: 'green' | 'slate';
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
        color === 'green'
          ? 'bg-primary-50 text-primary-700 border-primary-200'
          : 'bg-surface-raised text-ink-muted border-surface-border'
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

function FieldLabel({
  icon,
  label,
  required,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft mb-1.5">
      <span className="text-primary-600">{icon}</span>
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main landing / onboarding page
// ---------------------------------------------------------------------------
export default function Login() {
  const navigate = useNavigate();

  const [hospitalName, setHospitalName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const allFilled =
    hospitalName.trim() !== '' &&
    websiteUrl.trim() !== '' &&
    googleReviewUrl.trim() !== '';

  const handleSample = () => {
    setHospitalName('Apollo Hospitals, Chennai');
    setWebsiteUrl('https://apollohospitals.com');
    setGoogleReviewUrl(
      'https://search.google.com/local/writereview?placeid=ChIJSAMPLE123'
    );
  };

  const handleProceed = async () => {
    setTouched(true);
    if (!allFilled) return;
    setLoading(true);
    // Store config in sessionStorage so the automation desk can read it
    sessionStorage.setItem(
      'rb_hospital',
      JSON.stringify({ hospitalName, websiteUrl, googleReviewUrl })
    );
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    navigate('/desk');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Top nav bar                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="h-14 border-b border-surface-border flex items-center justify-between px-6 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ink-DEFAULT flex items-center justify-center shrink-0">
            <Brain className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-bold text-ink-DEFAULT leading-none">ReviewBridge</p>
            <p className="text-[10px] text-ink-subtle leading-none mt-0.5">
              Centralised Hospital Review Hub
            </p>
          </div>
        </div>

        {/* Status pills */}
        <div className="hidden sm:flex items-center gap-2">
          <StatusPill
            icon={<Database className="h-3 w-3" aria-hidden />}
            label="Supabase DB Connected"
            color="green"
          />
          <button
            onClick={handleProceed}
            disabled={!allFilled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-surface-border text-ink-muted hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="h-3 w-3" aria-hidden />
            Next Page: Patient Review Automation
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero section                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col items-center text-center px-6 pt-14 pb-10">
        {/* Tag */}
        <div className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary-200 text-primary-700 text-[11px] font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-8">
          <Zap className="h-3 w-3" aria-hidden />
          Centralised Multi-Hospital Review Platform
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-black text-ink-DEFAULT leading-tight max-w-2xl mb-4">
          Automate 5★ Patient Reviews
          <br />
          <span className="text-primary-600">
            for Any Hospital via WhatsApp
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base text-ink-muted max-w-xl leading-relaxed">
          ReviewBridge is a centralised infrastructure hub. Enter your hospital name, official
          website, and Google Maps review link below. Once entered, you can proceed directly to
          the automation desk to dispatch review requests.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 card                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex justify-center px-4 pb-16">
        <div className="w-full max-w-3xl bg-white border border-surface-border rounded-2xl shadow-card-md overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-600" aria-hidden />
              <div>
                <p className="text-base font-bold text-ink-DEFAULT">
                  Step 1: Enter Hospital Information
                </p>
                <p className="text-xs text-ink-subtle mt-0.5">
                  All 3 fields are required to unlock the Patient Review Automation Page.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-ink-subtle">Quick Demo:</span>
              <button
                onClick={handleSample}
                className="px-3 py-1.5 text-xs font-semibold bg-surface-raised hover:bg-surface-border text-ink-soft rounded-lg border border-surface-border transition-colors"
              >
                Sample Hospital
              </button>
            </div>
          </div>

          {/* Fields */}
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hospital Name */}
            <div>
              <FieldLabel
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Hospital Name"
                required
              />
              <input
                type="text"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="e.g. Apollo Hospital, Metro Healthcare."
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink-DEFAULT placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  touched && !hospitalName.trim()
                    ? 'border-red-400 bg-red-50'
                    : 'border-surface-border bg-white hover:border-slate-300'
                }`}
              />
              <p className="text-[11px] text-ink-subtle mt-1">Branded in the WhatsApp message</p>
            </div>

            {/* Website URL */}
            <div>
              <FieldLabel
                icon={<Globe className="h-3.5 w-3.5" />}
                label="Hospital Website URL"
                required
              />
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourhospital.com"
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink-DEFAULT placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  touched && !websiteUrl.trim()
                    ? 'border-red-400 bg-red-50'
                    : 'border-surface-border bg-white hover:border-slate-300'
                }`}
              />
              <p className="text-[11px] text-ink-subtle mt-1">Your hospital's official website</p>
            </div>

            {/* Google Review URL */}
            <div>
              <FieldLabel
                icon={<Star className="h-3.5 w-3.5 text-yellow-500" />}
                label="Google Review URL"
                required
              />
              <input
                type="url"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                placeholder="https://search.google.com/local/writen..."
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-ink-DEFAULT placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  touched && !googleReviewUrl.trim()
                    ? 'border-red-400 bg-red-50'
                    : 'border-surface-border bg-white hover:border-slate-300'
                }`}
              />
              <p className="text-[11px] text-ink-subtle mt-1">Google Maps place review link</p>
            </div>
          </div>

          {/* Card footer */}
          <div className="px-6 py-4 bg-surface-subtle border-t border-surface-border flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {allFilled
                ? 'All fields complete — ready to proceed.'
                : 'Enter all 3 fields above to enable the automation page.'}
            </div>
            <button
              onClick={handleProceed}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                allFilled
                  ? 'bg-ink-DEFAULT text-white hover:bg-ink-soft shadow-card'
                  : 'bg-surface-border text-ink-subtle cursor-not-allowed'
              }`}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <>
                  Proceed to Patient Review Automation Desk
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Feature strip                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-t border-surface-border bg-surface-subtle py-6 px-6 mt-auto">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { icon: <Zap className="h-4 w-4 mx-auto mb-1 text-primary-600" />, label: 'WhatsApp Automation' },
            { icon: <Brain className="h-4 w-4 mx-auto mb-1 text-primary-600" />, label: 'AI Review Cleanup' },
            { icon: <Star className="h-4 w-4 mx-auto mb-1 text-yellow-500" />, label: 'Google Review Push' },
            { icon: <Link2 className="h-4 w-4 mx-auto mb-1 text-primary-600" />, label: 'Multi-Hospital Hub' },
          ].map(({ icon, label }) => (
            <div key={label}>
              {icon}
              <p className="text-xs font-medium text-ink-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
