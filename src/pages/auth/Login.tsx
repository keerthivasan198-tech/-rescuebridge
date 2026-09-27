import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Activity,
  Star,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Dummy credentials — replace with real auth later
// ---------------------------------------------------------------------------
const DEMO_EMAIL = 'staff@abchealthcare.com';
const DEMO_PASSWORD = 'demo1234';

// ---------------------------------------------------------------------------
// Floating feature pill
// ---------------------------------------------------------------------------
function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm font-medium">
      {icon}
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card on the left panel
// ---------------------------------------------------------------------------
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-green-100 mt-0.5">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------
export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }

    setLoading(true);
    // Simulate auth delay
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      navigate('/demo');
    } else {
      setError('Invalid email or password. Try the demo credentials below.');
    }
  };

  const handleDemoLogin = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    navigate('/demo');
  };

  return (
    <div className="min-h-screen flex">

      {/* ------------------------------------------------------------------ */}
      {/* Left panel — branding                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(135deg, #15803d 0%, #16a34a 40%, #ca8a04 80%, #ea580c 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-8 w-48 h-48 rounded-full bg-yellow-400/10" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" aria-hidden />
            </div>
            <div>
              <p className="text-white text-xl font-bold tracking-tight">ReviewBridge</p>
              <p className="text-green-200 text-xs">Patient Feedback Platform</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Turn patient visits into<br />
            <span className="text-yellow-300">5-star reviews.</span>
          </h1>
          <p className="text-green-100 text-base leading-relaxed max-w-sm">
            Automate feedback collection via WhatsApp, clean responses with AI,
            and guide happy patients to Google Reviews — all from one dashboard.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            <FeaturePill icon={<MessageSquare className="h-4 w-4" />} label="WhatsApp Feedback" />
            <FeaturePill icon={<Star className="h-4 w-4" />} label="AI Review Cleanup" />
            <FeaturePill icon={<TrendingUp className="h-4 w-4" />} label="Google Reviews" />
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10">
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard value="1,248" label="Visits tracked" />
            <StatCard value="76%" label="Response rate" />
            <StatCard value="491" label="Reviews earned" />
          </div>
          <p className="text-green-200 text-xs text-center">
            Demo data — real numbers grow after connecting your clinic
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel — login form                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-stone-50">

        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #16a34a, #ea580c)' }}>
            <Activity className="h-5 w-5 text-white" aria-hidden />
          </div>
          <span className="text-lg font-bold text-slate-800">ReviewBridge</span>
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 text-sm mt-1">
              Sign in to your clinic dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="staff@clinic.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-green-600 hover:text-green-700 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                  onClick={() => {}}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" aria-hidden />
                    : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p id="login-error" role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #16a34a, #ca8a04)' }}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <>Sign In <ArrowRight className="h-4 w-4" aria-hidden /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Demo login */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 px-4 py-3 text-sm font-semibold text-orange-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60"
          >
            <Star className="h-4 w-4 text-yellow-500" aria-hidden />
            Continue with Demo Account
          </button>

          {/* Demo credentials hint */}
          <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-xs font-semibold text-green-800 mb-1.5 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" aria-hidden /> Demo credentials
            </p>
            <div className="space-y-0.5">
              <p className="text-xs text-green-700">
                Email: <span className="font-mono font-semibold">{DEMO_EMAIL}</span>
              </p>
              <p className="text-xs text-green-700">
                Password: <span className="font-mono font-semibold">demo1234</span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-400">
            ABC Healthcare · ReviewBridge v0.1 · Demo build
          </p>
        </div>
      </div>
    </div>
  );
}
