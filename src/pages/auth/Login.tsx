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
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Onboarding Form
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newGoogleReviewUrl, setNewGoogleReviewUrl] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);

  // Load available hospitals
  useEffect(() => {
    async function load() {
      const list = await db.getHospitals();
      setAvailableHospitals(list);
      if (list.length > 0) {
        setSelectedHospitalId(list[0].id);
      }
    }
    load();
  }, []);

  // Update default credentials when role or hospital is picked
  useEffect(() => {
    setError(null);
    if (selectedRole === 'admin') {
      setEmail('superadmin@rescuebridge.com');
      setPassword('••••••••');
    } else if (selectedRole === 'hospital') {
      setPassword('••••••••');
      if (selectedHospitalId === '22222222-2222-2222-2222-222222222222') {
        setEmail('admin@apexclinic.com');
      } else {
        setEmail('admin@citycare.com');
      }
    } else if (selectedRole === 'staff') {
      setPassword('••••••••');
      setEmail('staff@citycare.com');
    }
  }, [selectedRole, selectedHospitalId]);

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
          setError('Invalid Admin credentials. Use superadmin@rescuebridge.com');
        }
      } else if (selectedRole === 'hospital') {
        // Find hospital admin for this hospital
        const users = await db.getUsers(selectedHospitalId);
        const match =
          users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim() && u.role === 'hospital_admin') ||
          users.find((u) => u.hospital_id === selectedHospitalId && u.role === 'hospital_admin');

        if (match) {
          await switchUserRole('hospital_admin', selectedHospitalId);
        } else {
          const ok = await login(email.trim());
          if (!ok) {
            setError(`No hospital admin account found for ${email}`);
          }
        }
      } else if (selectedRole === 'staff') {
        const users = await db.getUsers(selectedHospitalId);
        const match =
          users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim() && u.role === 'staff') ||
          users.find((u) => u.hospital_id === selectedHospitalId && u.role === 'staff');

        if (match) {
          await switchUserRole('staff', selectedHospitalId);
        } else {
          const ok = await login(email.trim());
          if (!ok) {
            setError(`No staff account found for ${email}`);
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
    if (!newHospitalName || !newSubdomain) return;
    setOnboardLoading(true);

    try {
      const created = await db.createHospital({
        name: newHospitalName.trim(),
        subdomain: newSubdomain.trim().toLowerCase(),
        google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
        sheet_id: 'demo_sheet_id',
        sheet_type: 'google_sheets',
        logo: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80',
        whatsapp_template_name: 'patient_review_v1',
      });

      await switchUserRole('hospital_admin', created.id);
      navigate('/staff');
    } catch (err) {
      console.error(err);
    } finally {
      setOnboardLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database className="h-3 w-3" />
            Strict Multi-Tenant Isolation
          </div>

          <button
            onClick={() => navigate('/desk')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm"
          >
            <Zap className="h-3 w-3 text-emerald-400" />
            Automation Desk
          </button>
        </div>
      </header>

      {/* ── Main Hero & Content Area ───────────────────────────────── */}
      <div className="max-w-5xl mx-auto w-full px-4 py-10 my-auto">
        {/* Title Header (Positive theme matching Image 2) */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold uppercase tracking-wider px-3.5 py-1 rounded-full mb-3 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            Centralised Multi-Hospital Review Platform
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Automate 5★ Patient Reviews <br />
            <span className="text-emerald-600">for Any Hospital via WhatsApp</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto mt-3 leading-relaxed">
            RescueBridge is a centralised infrastructure hub. Select your hospital portal below to manage automated patient reviews, WhatsApp dispatches, and 5-star Google Maps growth.
          </p>
        </div>

        {/* Tab Selector (Sign In vs Onboard) */}
        {selectedRole === 'selection' && (
          <div className="flex justify-center mb-8">
            <div className="bg-slate-200/80 p-1 rounded-2xl inline-flex gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('signin')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm'
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
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Onboard New Hospital
              </button>
            </div>
          </div>
        )}

        {/* ── View 1: 3 High-Quality Role Cards ──────────────────────── */}
        {selectedRole === 'selection' && activeTab === 'signin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7 items-stretch">
            {/* 1. Admin Login Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden relative group">
              {/* Subtle top accent gradient */}
              <div className="h-1.5 w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500" />

              <div className="p-7 sm:p-8 flex-1 flex flex-col justify-between">
                <div>
                  {/* Icon & Category Pill */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform duration-300">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-purple-50 text-purple-700 border border-purple-200/70">
                      Super Admin
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Admin Portal
                  </h3>
                  <p className="text-xs text-purple-700 font-bold mt-1">
                    Multi-Hospital Global Controller
                  </p>

                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    Master administrator access to oversee all partner hospital accounts, global spreadsheet sync pipelines, and system configurations.
                  </p>

                  {/* Feature Checklist */}
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>Manage all partner hospitals & onboarding</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>Global sheet sync & automation engine</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>System-wide patient review performance</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100">
                  {/* Demo Credential Badge */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200/70 rounded-xl px-3.5 py-2 mb-4">
                    <span className="text-[11px] text-slate-400 font-medium">Demo Access</span>
                    <span className="text-[11px] font-mono font-semibold text-purple-800">
                      superadmin@rescuebridge.com
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('admin')}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 transition-all group-hover:gap-3"
                  >
                    <span>Enter Admin Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Hospital Login Card (Hero Card - Highlighted) */}
            <div className="bg-white rounded-3xl border-2 border-emerald-500/80 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between overflow-hidden relative group ring-4 ring-emerald-500/10">
              {/* Highlight ribbon banner */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold text-center py-1.5 tracking-wide uppercase flex items-center justify-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Primary Clinic Portal</span>
              </div>

              <div className="p-7 sm:p-8 flex-1 flex flex-col justify-between">
                <div>
                  {/* Icon & Category Pill */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 group-hover:scale-105 transition-transform duration-300">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Single-Hospital
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Hospital Login
                  </h3>
                  <p className="text-xs text-emerald-700 font-bold mt-1">
                    Isolated Hospital Operations
                  </p>

                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    Hospital management suite. Manage your automated WhatsApp review funnel, sync your Google Sheets, and view private low-rating alerts.
                  </p>

                  {/* Feature Checklist */}
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>Dedicated single-tenant clinic dashboard</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>Automated WhatsApp 5★ review funnels</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>Private 1–3★ patient management alerts</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100">
                  {/* Demo Credential Badge */}
                  <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-200/70 rounded-xl px-3.5 py-2 mb-4">
                    <span className="text-[11px] text-slate-500 font-medium">Partner Clinics</span>
                    <span className="text-[11px] font-semibold text-emerald-800 truncate">
                      City Care • Apex Multi-Specialty
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('hospital')}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all group-hover:gap-3"
                  >
                    <span>Enter Hospital Admin</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Staff Login Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden relative group">
              {/* Subtle top accent gradient */}
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600" />

              <div className="p-7 sm:p-8 flex-1 flex flex-col justify-between">
                <div>
                  {/* Icon & Category Pill */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                      <UserCheck className="w-7 h-7" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200/70">
                      Front Desk
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Staff Login
                  </h3>
                  <p className="text-xs text-blue-700 font-bold mt-1">
                    Front-Desk & Visit Registration
                  </p>

                  <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                    Designed for receptionists and consultation staff to quickly register patients and mark consultations complete to trigger reviews.
                  </p>

                  {/* Feature Checklist */}
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>Fast patient check-in & consultation entry</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>1-click "Mark Complete" review dispatch</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        ✓
                      </div>
                      <span>Instant copy patient review link & QR preview</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100">
                  {/* Demo Credential Badge */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200/70 rounded-xl px-3.5 py-2 mb-4">
                    <span className="text-[11px] text-slate-400 font-medium">Demo Staff</span>
                    <span className="text-[11px] font-mono font-semibold text-blue-800">
                      staff@citycare.com
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('staff')}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-slate-900/20 transition-all group-hover:gap-3"
                  >
                    <span>Enter Staff Desk</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
                  {/* Hospital Selector for Hospital Admin and Staff */}
                  {(selectedRole === 'hospital' || selectedRole === 'staff') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select Your Hospital *
                      </label>
                      <select
                        value={selectedHospitalId}
                        onChange={(e) => setSelectedHospitalId(e.target.value)}
                        className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {availableHospitals.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.subdomain}.rescuebridge.com)
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">
                        You will be strictly locked into this hospital. No other clinic's data will be visible.
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
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
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

              {/* Ready-to-Test Accounts (matching Image 2) */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Ready-to-Test Accounts:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  {selectedRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setEmail('superadmin@rescuebridge.com')}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-mono text-purple-700 hover:bg-purple-50 text-[11px]"
                    >
                      superadmin@rescuebridge.com
                    </button>
                  )}

                  {selectedRole === 'hospital' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHospitalId('11111111-1111-1111-1111-111111111111');
                          setEmail('admin@citycare.com');
                        }}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-mono text-emerald-700 hover:bg-emerald-50 text-[11px]"
                      >
                        City Care: admin@citycare.com
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHospitalId('22222222-2222-2222-2222-222222222222');
                          setEmail('admin@apexclinic.com');
                        }}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-mono text-teal-700 hover:bg-teal-50 text-[11px]"
                      >
                        Apex Clinic: admin@apexclinic.com
                      </button>
                    </>
                  )}

                  {selectedRole === 'staff' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedHospitalId('11111111-1111-1111-1111-111111111111');
                        setEmail('staff@citycare.com');
                      }}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-mono text-slate-800 hover:bg-slate-100 text-[11px]"
                    >
                      staff@citycare.com
                    </button>
                  )}
                </div>
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
                <div className="flex items-center rounded-xl border border-slate-300 overflow-hidden bg-slate-50">
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
