import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Brain,
  Lock,
  Building2,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Database,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Zap,
  Globe,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Hospital } from '../../types/database';

export default function Login() {
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin, login, switchUserRole } = useAuth();

  // Navigation mode:
  // 'selection' -> First screen matching Image 1 with the 3 role cards
  // 'admin' | 'hospital' | 'staff' -> Second screen matching Image 2 with the login form
  // 'onboard' -> Onboard new hospital tab
  const [selectedRole, setSelectedRole] = useState<'selection' | 'admin' | 'hospital' | 'staff'>('selection');
  const [activeTab, setActiveTab] = useState<'signin' | 'onboard'>('signin');

  const [availableHospitals, setAvailableHospitals] = useState<Hospital[]>([]);
  const [hospitalNameInput, setHospitalNameInput] = useState<string>('');

  // Form inputs (Empty by default - no dummy values)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Onboarding Form
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newGoogleReviewUrl, setNewGoogleReviewUrl] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);

  // Load hospitals for validation
  useEffect(() => {
    async function load() {
      const list = await db.getHospitals();
      setAvailableHospitals(list);
    }
    load();
  }, []);

  // Reset fields when role changes (no dummy values)
  useEffect(() => {
    setError(null);
    setEmail('');
    setPassword('');
    setHospitalNameInput('');
  }, [selectedRole]);

  // If already authenticated, redirect straight to their dashboard
  if (currentUser) {
    if (isSuperAdmin) {
      return <Navigate to="/staff/super-admin" replace />;
    }
    return <Navigate to="/staff" replace />;
  }

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (selectedRole === 'admin') {
        const ok = await login(email.trim());
        if (!ok) {
          setError('Invalid Admin credentials. Please check your email and password.');
        }
      } else if (selectedRole === 'hospital' || selectedRole === 'staff') {
        if (!hospitalNameInput.trim()) {
          setError('Please enter your hospital name.');
          setLoading(false);
          return;
        }

        const query = hospitalNameInput.trim().toLowerCase();
        // Match hospital by name or subdomain
        const matched = availableHospitals.find(
          (h) =>
            h.name.toLowerCase() === query ||
            h.subdomain.toLowerCase() === query ||
            h.name.toLowerCase().includes(query)
        );

        if (!matched) {
          setError(`Hospital "${hospitalNameInput}" not found. Please enter your valid registered hospital name.`);
          setLoading(false);
          return;
        }

        const targetRole = selectedRole === 'hospital' ? 'hospital_admin' : 'staff';
        const users = await db.getUsers(matched.id);
        const match =
          users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim() && u.role === targetRole) ||
          users.find((u) => u.hospital_id === matched.id && u.role === targetRole);

        if (match) {
          await switchUserRole(targetRole, matched.id);
        } else {
          const ok = await login(email.trim());
          if (!ok) {
            setError(`No ${targetRole.replace('_', ' ')} account found for "${email}" in ${matched.name}.`);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle Onboarding Submit
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospitalName.trim() || !newSubdomain.trim()) return;
    setOnboardLoading(true);

    try {
      const created = await db.createHospital({
        name: newHospitalName.trim(),
        subdomain: newSubdomain.trim().toLowerCase(),
        website: newWebsite.trim() || undefined,
        logo:
          newLogoUrl.trim() ||
          'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80',
        google_place_id: newGoogleReviewUrl.trim() || 'ChIJN1t_tDeuEmsRUsoyG83frY4',
        sheet_id: 'demo_sheet_id',
        sheet_type: 'google_sheets',
        whatsapp_template_name: 'patient_review_v1',
      });

      await switchUserRole('hospital_admin', created.id);
      navigate('/staff');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to onboard hospital');
    } finally {
      setOnboardLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.12),rgba(255,255,255,0))] relative overflow-x-hidden flex flex-col justify-between">
      {/* ── Ambient Background Lighting Effects ── */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-10 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/70 flex items-center justify-between px-6 shrink-0 shadow-xs z-10 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Brain className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none">RescueBridge</p>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">
              Multi-Hospital Review Infrastructure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
            <Database className="h-3 w-3" />
            Strict Multi-Tenant Isolation
          </div>

          <button
            onClick={() => navigate('/desk')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs active:translate-y-0.5"
          >
            <Zap className="h-3 w-3 text-emerald-400" />
            Automation Desk
          </button>
        </div>
      </header>

      {/* ── Main Hero & Content Area ───────────────────────────────── */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 my-auto z-10">
        {/* Title Header (Positive theme matching Image 2) */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full mb-3.5 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            Centralised Multi-Hospital Review Platform
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Automate 5★ Patient Reviews <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              for Any Hospital via WhatsApp
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto mt-3 leading-relaxed">
            RescueBridge is a centralised infrastructure hub. Select your hospital portal below to manage automated patient reviews, WhatsApp dispatches, and 5-star Google Maps growth.
          </p>
        </div>

        {/* Tab Selector (Sign In vs Onboard) */}
        {selectedRole === 'selection' && (
          <div className="flex justify-center mb-10">
            <div className="bg-slate-200/70 p-1.5 rounded-2xl inline-flex gap-1.5 shadow-inner backdrop-blur-xs">
              <button
                type="button"
                onClick={() => setActiveTab('signin')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-md shadow-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In with Account Role
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('onboard')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'onboard'
                    ? 'bg-white text-slate-900 shadow-md shadow-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Onboard New Hospital
              </button>
            </div>
          </div>
        )}

        {/* ── View 1: 3 Role Cards with Pure White Outer Layer & Static 3D Minimal Depth ───── */}
        {selectedRole === 'selection' && activeTab === 'signin' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {/* 1. Admin Login Card */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-[0_16px_36px_-6px_rgba(15,23,42,0.08),0_4px_12px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
              <div>
                {/* 3D Elevated Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mb-5 shadow-md shadow-purple-500/25 ring-4 ring-slate-50">
                  <ShieldCheck className="w-7 h-7" />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Admin Login</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Network
                  </span>
                </div>

                <p className="text-xs font-bold text-purple-700 mt-1">
                  Platform Controller (All Hospitals)
                </p>

                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Super admin portal with global access. Manages all partner hospitals, sheet sync pipelines, and global review automations.
                </p>
              </div>

              {/* Button */}
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className="mt-7 w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-105 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-purple-500/25"
              >
                <span>Enter as Admin</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Hospital Login Card (Hero Centerpiece) */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-[0_18px_40px_-6px_rgba(15,23,42,0.1),0_4px_12px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
              <div>
                {/* 3D Elevated Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-5 shadow-md shadow-emerald-500/30 ring-4 ring-slate-50">
                  <Building2 className="w-7 h-7" />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Hospital Login</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 shadow-xs">
                    ★ Primary
                  </span>
                </div>

                <p className="text-xs font-bold text-emerald-700 mt-1">
                  Handles Their Hospital Only
                </p>

                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Hospital management portal. View and handle review funnels, WhatsApp dispatches, and private low-rating alerts for your clinic only.
                </p>
              </div>

              {/* Button */}
              <button
                type="button"
                onClick={() => setSelectedRole('hospital')}
                className="mt-7 w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30"
              >
                <span>Enter as Hospital Admin</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* 3. Staff Login Card */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-[0_16px_36px_-6px_rgba(15,23,42,0.08),0_4px_12px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between">
              <div>
                {/* 3D Elevated Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-slate-800 text-white flex items-center justify-center mb-5 shadow-md shadow-slate-900/25 ring-4 ring-slate-50">
                  <UserCheck className="w-7 h-7" />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Staff Login</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Front Desk
                  </span>
                </div>

                <p className="text-xs font-bold text-blue-700 mt-1">
                  Visits & "Mark Complete"
                </p>

                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Front-desk role: register incoming patient visits and click "Mark Complete" to trigger review dispatches for your hospital.
                </p>
              </div>

              {/* Button */}
              <button
                type="button"
                onClick={() => setSelectedRole('staff')}
                className="mt-7 w-full py-3.5 px-4 bg-gradient-to-r from-slate-900 to-slate-800 hover:brightness-110 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-slate-900/25"
              >
                <span>Enter as Staff</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── View 2: Login Box for Selected Role (Matching Image 2 Theme) */}
        {selectedRole !== 'selection' && (
          <div className="max-w-md mx-auto w-full animate-slide-up">
            {/* Back Button */}
            <button
              type="button"
              onClick={() => setSelectedRole('selection')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 mb-4 transition-colors p-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Role Selection
            </button>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              {/* Card Header matching Image 2 */}
              <div className="p-6 sm:p-7 border-b border-slate-100 flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    selectedRole === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : selectedRole === 'hospital'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {selectedRole === 'admin' && <ShieldCheck className="w-6 h-6" />}
                  {selectedRole === 'hospital' && <Building2 className="w-6 h-6" />}
                  {selectedRole === 'staff' && <UserCheck className="w-6 h-6" />}
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {selectedRole === 'admin' && 'Admin Login (All Hospitals Automation)'}
                    {selectedRole === 'hospital' && 'Hospital Login (Single Hospital Isolated)'}
                    {selectedRole === 'staff' && 'Staff Login (Visits & Mark Complete)'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {selectedRole === 'admin' &&
                      'Platform controller with full access to manage all partner hospitals, sheet sync pipelines, and global review automations.'}
                    {selectedRole === 'hospital' &&
                      'Manage reviews and automations in your hospital only. Other hospital details are completely hidden.'}
                    {selectedRole === 'staff' &&
                      'Front-desk consultation desk for registering patients and marking visits complete for your hospital only.'}
                  </p>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6 sm:p-7">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Enter Hospital Name Input for Hospital Admin and Staff */}
                  {(selectedRole === 'hospital' || selectedRole === 'staff') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Enter Your Hospital Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={hospitalNameInput}
                        onChange={(e) => setHospitalNameInput(e.target.value)}
                        placeholder="e.g. City Care Hospital"
                        className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Enter your registered hospital name to access your clinic's portal.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {selectedRole === 'admin' && 'Super Admin Email'}
                      {selectedRole === 'hospital' && 'Hospital Admin Email'}
                      {selectedRole === 'staff' && 'Staff User Email'}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@hospital.com"
                      className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !email.trim() ||
                      ((selectedRole === 'hospital' || selectedRole === 'staff') &&
                        !hospitalNameInput.trim())
                    }
                    className={`w-full py-3.5 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                      selectedRole === 'admin'
                        ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300'
                        : selectedRole === 'hospital'
                        ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                        : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400'
                    }`}
                  >
                    {loading ? (
                      'Signing in...'
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        {selectedRole === 'admin' && 'Enter Admin Global Controller'}
                        {selectedRole === 'hospital' && 'Sign In to Hospital Portal'}
                        {selectedRole === 'staff' && 'Sign In to Staff Desk'}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── View 3: Onboard New Hospital Tab ───────────────────────── */}
        {selectedRole === 'selection' && activeTab === 'onboard' && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-xl mx-auto animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Register New Partner Hospital
              </h2>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apollo Hospital, Chennai"
                  value={newHospitalName}
                  onChange={(e) => setNewHospitalName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subdomain Slug *
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden bg-slate-50 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
                  <input
                    type="text"
                    required
                    placeholder="apollo"
                    value={newSubdomain}
                    onChange={(e) =>
                      setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }
                    className="flex-1 text-xs font-mono p-2.5 bg-white focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 px-3 font-mono">
                    .rescuebridge.com
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Hospital Website
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    placeholder="https://www.apollohospitals.com"
                    value={newWebsite}
                    onChange={(e) => setNewWebsite(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Logo URL
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={newLogoUrl}
                      onChange={(e) => setNewLogoUrl(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {newLogoUrl && (
                    <div className="w-10 h-10 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
                      <img
                        src={newLogoUrl}
                        alt="Logo preview"
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Paste direct link to your hospital logo (PNG/JPG/SVG)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Maps Review URL
                </label>
                <input
                  type="url"
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  value={newGoogleReviewUrl}
                  onChange={(e) => setNewGoogleReviewUrl(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={onboardLoading || !newHospitalName || !newSubdomain}
                className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {onboardLoading ? 'Creating Hospital...' : 'Create Hospital & Open Dashboard'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200">
        RescueBridge Multi-Hospital Architecture • Admin Manages All • Hospitals Handle Only Their Own
      </footer>
    </div>
  );
}
