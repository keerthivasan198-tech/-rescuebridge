import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Send,
  MessageSquare,
  Star,
  AlertTriangle,
  Plus,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  ExternalLink,
  Copy,
  Check,
  Building2,
  RefreshCw,
  Phone,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db, isDateCrossed } from '../../services/db';
import { Visit, Hospital, SheetType } from '../../types/database';

export default function HospitalDashboard() {
  const navigate = useNavigate();
  const {
    currentUser,
    currentHospital,
    selectedHospitalId,
    hospitals,
    switchHospital,
    isSuperAdmin,
    isHospitalAdmin,
    isStaff,
  } = useAuth();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Manual Visit Form State
  const [visitForm, setVisitForm] = useState({
    patient_name: '',
    phone: '',
    department: 'General Medicine',
    doctor: 'Dr. Ramesh Kumar',
    whatsapp_consent: true,
  });
  const [savingVisit, setSavingVisit] = useState(false);

  // Sheet Sync Form State
  const [syncJson, setSyncJson] = useState(`[
  {
    "sheet_row_id": "IMP-8819-15",
    "patient_name": "Ganesh B",
    "phone": "+919876543224",
    "department": "General Medicine",
    "doctor": "Dr. Rajesh",
    "visit_date": "15-09-2026",
    "status": "registered"
  },
  {
    "sheet_row_id": "IMP-8819-14",
    "patient_name": "Swetha M",
    "phone": "+919876543223",
    "department": "General Medicine",
    "doctor": "Dr. Divya",
    "visit_date": "14-09-2026",
    "status": "completed"
  }
]`);
  const [syncApiKey, setSyncApiKey] = useState(() => localStorage.getItem('rb_sync_api_key') || '');
  const [syncResult, setSyncResult] = useState<{
    accepted: number;
    rejected: number;
    errors: string[];
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Fetch Visits
  const loadVisits = async () => {
    setRefreshing(true);
    try {
      const activeHospitalId =
        !isSuperAdmin && currentUser?.hospital_id
          ? currentUser.hospital_id
          : selectedHospitalId !== 'all'
          ? selectedHospitalId
          : null;

      const data = await db.getVisits(activeHospitalId, {
        department: selectedDept,
        status: selectedStatus,
        date: dateFilter,
      });
      setVisits(data);
    } catch (err) {
      console.error('Error fetching visits:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, [selectedHospitalId, selectedDept, selectedStatus, dateFilter]);

  // Handle Mark Complete
  const handleMarkComplete = async (visitId: string) => {
    try {
      await db.markVisitComplete(visitId);
      await loadVisits();
    } catch (err) {
      console.error('Failed to mark complete:', err);
    }
  };

  // Handle Manual Visit Submit
  const handleAddVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitForm.patient_name || !visitForm.phone) return;

    const targetHospitalId =
      currentHospital?.id ||
      (currentUser?.hospital_id ? currentUser.hospital_id : hospitals[0]?.id);

    if (!targetHospitalId) return;

    setSavingVisit(true);
    try {
      await db.createVisit({
        hospital_id: targetHospitalId,
        patient_name: visitForm.patient_name,
        phone: visitForm.phone.startsWith('+') ? visitForm.phone : `+91${visitForm.phone}`,
        department: visitForm.department,
        doctor: visitForm.doctor,
        whatsapp_consent: visitForm.whatsapp_consent,
      });

      setShowAddModal(false);
      setVisitForm({
        patient_name: '',
        phone: '',
        department: 'General Medicine',
        doctor: 'Dr. Ramesh Kumar',
        whatsapp_consent: true,
      });
      await loadVisits();
    } catch (err) {
      console.error('Failed to add visit:', err);
    } finally {
      setSavingVisit(false);
    }
  };

  // Handle Sheet Sync Run
  const handleRunSheetSync = async () => {
    const targetHospitalId =
      currentHospital?.id || (currentUser?.hospital_id ? currentUser.hospital_id : hospitals[0]?.id);
    if (!targetHospitalId) return;

    setSyncing(true);
    try {
      const parsed = JSON.parse(syncJson);
      const res = await db.syncSheetRows(targetHospitalId, parsed, syncApiKey);
      setSyncResult(res);
      await loadVisits();
    } catch (err: any) {
      setSyncResult({
        accepted: 0,
        rejected: 0,
        errors: [err.message || 'Invalid JSON format or sync error'],
      });
    } finally {
      setSyncing(false);
    }
  };

  // Download Standard Template CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      'patient_name,phone,visit_date,department,doctor,status\n' +
      'Kavitha Sundaram,+919876543210,2026-09-28,Cardiology,Dr. Ramesh Kumar,registered\n' +
      'Arun Kumar,+919845012345,2026-09-28,General Medicine,Dr. S. Anita,completed\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RescueBridge_Sheet_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to reliably identify the origin of any visit record
  const getVisitSource = (v: Visit): 'google_forms' | 'google_sheets' | 'excel_365' | 'manual' => {
    if (v.source) return v.source;
    const uid = (v.visit_uid || v.sheet_row_id || '').toUpperCase();
    if (uid.startsWith('GF-') || uid.includes('FORM')) return 'google_forms';
    if (uid.startsWith('GS-') || uid.includes('SHEET') || uid.includes('GOOGLE')) return 'google_sheets';
    if (uid.startsWith('IMP-') || uid.includes('EXCEL') || uid.includes('XLS') || uid.includes('CSV')) return 'excel_365';
    return 'manual';
  };

  // Filtered list
  const filteredVisits = visits.filter((v) => {
    const query = searchQuery.toLowerCase();
    const patientName = v.patient?.name?.toLowerCase() || '';
    const phone = v.patient?.phone || '';
    const doc = v.doctor.toLowerCase();
    const matchesQuery = patientName.includes(query) || phone.includes(query) || doc.includes(query);
    if (!matchesQuery) return false;
    if (selectedDept !== 'all' && v.department !== selectedDept) return false;
    if (selectedStatus !== 'all' && v.status !== selectedStatus) return false;
    if (dateFilter && v.visit_date !== dateFilter) return false;
    if (selectedSource !== 'all' && getVisitSource(v) !== selectedSource) return false;
    return true;
  });

  // Funnel Metrics
  const completedCount = visits.filter((v) => v.status === 'completed').length;
  const messagesSentCount = visits.filter(
    (v) => v.review_request && ['sent', 'delivered', 'read'].includes(v.review_request.whatsapp_status)
  ).length;
  const deliveredCount = visits.filter(
    (v) => v.review_request && ['delivered', 'read'].includes(v.review_request.whatsapp_status)
  ).length;
  const reviewsReceived = visits.filter((v) => v.review_request?.rating).length;

  const ratingsList = visits
    .map((v) => v.review_request?.rating)
    .filter((r): r is number => typeof r === 'number');

  const avgRating =
    ratingsList.length > 0
      ? (ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length).toFixed(1)
      : '5.0';

  // Low-Rating Alerts (1-3 stars)
  const lowRatingAlerts = visits.filter(
    (v) => v.review_request?.rating && v.review_request.rating <= 3
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Executive Hospital Header ─────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="flex items-center gap-4">
          {currentHospital?.logo && !currentHospital.logo.includes('photo-1586773860418-d37222d8fce3') ? (
            <img
              src={currentHospital.logo}
              alt={currentHospital.name}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-extrabold text-xl shadow-xs shrink-0 tracking-wider">
              {currentHospital?.name ? currentHospital.name.charAt(0).toUpperCase() : <Building2 className="w-7 h-7" />}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {isSuperAdmin && selectedHospitalId === 'all'
                  ? 'All Partner Hospitals Network'
                  : currentHospital?.name || 'Clinic Management Portal'}
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                {currentUser?.role === 'super_admin'
                  ? 'Super Administrator'
                  : currentUser?.role === 'hospital_admin'
                  ? 'Clinic Administrator'
                  : 'Front Desk Operations'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              {currentHospital && (
                <>
                  <span className="font-medium text-slate-700">
                    {currentHospital.subdomain}.rescuebridge.com
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Google Maps Business Profile Connected
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isSuperAdmin && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">View Clinic:</span>
              <select
                value={selectedHospitalId}
                onChange={(e) => switchHospital(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              >
                <option value="all">All Clinics Combined</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.subdomain})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadVisits}
            disabled={refreshing}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all"
            title="Refresh Patient Records"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl transition-all"
            title="Download Clean Sheet Template"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Sheet Template</span>
          </button>

          <button
            onClick={() => navigate('/staff/sheet-sync')}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Connect & Sync Sheets</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register Visit</span>
          </button>
        </div>
      </div>

      {/* ── Review Funnel Overview (Clean, Modern, Visual Stepper) ────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Patient Review & WhatsApp Automation Funnel</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Live Pipeline
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live progression from completed consultation to verified Google Maps 5★ reviews.
            </p>
          </div>

          <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200/80 px-4 py-2 rounded-xl">
            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-slate-900">{avgRating}</span>
                <span className="text-xs text-slate-500 font-medium">/ 5.0</span>
              </div>
              <p className="text-[10px] text-amber-800 font-semibold leading-none">
                {reviewsReceived} Google Reviews Verified
              </p>
            </div>
          </div>
        </div>

        {/* Funnel 4 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stage 1: Completed Consultations */}
          <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-2xl relative transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                1. Consultations Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-200/70 flex items-center justify-center text-slate-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{completedCount}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Finished visits ready for review
            </p>
          </div>

          {/* Stage 2: WhatsApp Dispatched */}
          <div className="bg-emerald-50/40 border border-emerald-200/80 p-5 rounded-2xl relative transition-all hover:border-emerald-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                2. WhatsApp Dispatched
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-emerald-800 tracking-tight">{messagesSentCount}</p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                {completedCount > 0 ? Math.round((messagesSentCount / completedCount) * 100) : 0}% sent
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              Delivered via Meta Cloud API
            </p>
          </div>

          {/* Stage 3: Delivered & Read */}
          <div className="bg-teal-50/40 border border-teal-200/80 p-5 rounded-2xl relative transition-all hover:border-teal-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                3. Delivered & Read
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-teal-800 tracking-tight">{deliveredCount}</p>
              <span className="text-xs font-bold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full">
                {messagesSentCount > 0 ? Math.round((deliveredCount / messagesSentCount) * 100) : 0}% read
              </span>
            </div>
            <p className="text-[11px] text-teal-700 font-medium mt-1">
              Patients opened review invitation
            </p>
          </div>

          {/* Stage 4: 5-Star Reviews Received */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
                4. Google 5★ Reviews
              </span>
              <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-white tracking-tight">{reviewsReceived}</p>
              <span className="text-xs font-bold text-emerald-900 bg-white/90 px-2 py-0.5 rounded-full">
                {completedCount > 0 ? Math.round((reviewsReceived / completedCount) * 100) : 0}% converted
              </span>
            </div>
            <p className="text-[11px] text-emerald-100 font-medium mt-1">
              Published directly to Google Maps
            </p>
          </div>
        </div>
      </div>

      {/* ── Low-Rating Alerts (1-3 Stars) Private Escalation ─────────────── */}
      {lowRatingAlerts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  Private Management Alerts ({lowRatingAlerts.length})
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Protected from Google Maps — Patients who rated 1–3 stars gave private feedback to clinic directors for resolution.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {lowRatingAlerts.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                        {item.patient?.name ? item.patient.name.charAt(0) : 'P'}
                      </div>
                      <p className="font-bold text-xs text-slate-900">{item.patient?.name}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {item.review_request?.rating} ★ Private
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2.5">
                    Dr. {item.doctor} • {item.department} • {item.visit_date}
                  </p>
                  <p className="text-xs text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{item.review_request?.feedback_text || 'No additional remarks provided'}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-slate-100 text-xs">
                  <a
                    href={`https://wa.me/${(item.patient?.phone || '').replace(/\D/g, '')}?text=Dear%20${encodeURIComponent(item.patient?.name || '')},%20we%20sincerely%20apologize%20for%20your%20recent%20experience%20at%20${encodeURIComponent(item.hospital?.name || 'our clinic')}.%20Our%20medical%20director%20would%20like%20to%20connect%20with%20you.`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:text-emerald-800 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Connect with Patient on WhatsApp</span>
                  </a>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {item.patient?.phone}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Patient Consultations & Records Table ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filters & Search Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-slate-900">Patient Consultations & Visits</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-semibold">
              {filteredVisits.length} Records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient, doctor, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52"
              />
            </div>

            {/* Source */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="all">All Sources</option>
              <option value="google_sheets">Google Sheets</option>
              <option value="google_forms">Google Forms</option>
              <option value="excel_365">Excel Sheet</option>
              <option value="manual">Manual Entry</option>
            </select>

            {/* Department */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="all">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="General Medicine">General Medicine</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Gynecology">Gynecology</option>
              <option value="Dentistry">Dentistry</option>
            </select>

            {/* Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="all">All Consultation Statuses</option>
              <option value="registered">Registered</option>
              <option value="completed">Completed</option>
            </select>

            {/* Date */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 py-1.5 px-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-3.5">Patient Information</th>
                <th className="px-5 py-3.5">Specialty & Doctor</th>
                <th className="px-4 py-3.5">Visit Date</th>
                <th className="px-4 py-3.5">Consultation Status</th>
                <th className="px-4 py-3.5">WhatsApp Automation</th>
                <th className="px-4 py-3.5">Google Rating</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No consultations found matching your current filters.
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v) => {
                  const reviewUrl = `${window.location.origin}/review?token=${v.token}`;
                  const sourceKind = getVisitSource(v);
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Patient */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-100">
                            {v.patient?.name ? v.patient.name.charAt(0).toUpperCase() : 'P'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 text-xs">{v.patient?.name}</p>
                              {sourceKind === 'google_forms' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                  Google Form
                                </span>
                              )}
                              {sourceKind === 'google_sheets' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Google Sheet
                                </span>
                              )}
                              {sourceKind === 'excel_365' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  Excel Sheet
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{v.patient?.phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Doctor & Dept */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{v.doctor}</p>
                        <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {v.department}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 text-slate-600 font-mono text-[11px]">
                        {v.visit_date}
                      </td>

                      {/* Visit Status */}
                      <td className="px-4 py-4">
                        {(() => {
                          const isDone = v.status === 'completed' || isDateCrossed(v.visit_date);
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                isDone
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isDone ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              />
                              {isDone ? 'Completed' : 'In Consultation'}
                            </span>
                          );
                        })()}
                      </td>

                      {/* WhatsApp Status */}
                      <td className="px-4 py-4">
                        {v.review_request ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                              v.review_request.whatsapp_status === 'read'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : v.review_request.whatsapp_status === 'delivered'
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            {v.review_request.whatsapp_status}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            {v.status === 'completed' || isDateCrossed(v.visit_date)
                              ? 'Ready to Dispatch'
                              : 'Pending completion'}
                          </span>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-4">
                        {v.review_request?.rating ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="font-extrabold text-slate-900">
                              {v.review_request.rating}.0
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right space-x-1.5">
                        {!v.review_request ? (
                          <button
                            onClick={() => handleMarkComplete(v.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                            title="Complete consultation and trigger automated WhatsApp review"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {v.status === 'completed' || isDateCrossed(v.visit_date)
                              ? 'Send WhatsApp Review'
                              : 'Mark Complete'}
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(reviewUrl);
                                setCopiedToken(v.id);
                                setTimeout(() => setCopiedToken(null), 2000);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                              title="Copy patient review link"
                            >
                              {copiedToken === v.id ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <a
                              href={`/review?token=${v.token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-all"
                              title="Open public review page"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Register New Patient Consultation ─────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Register New Patient Visit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct entry for walk-in or offline consultations.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVisitSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananya Sen"
                  value={visitForm.patient_name}
                  onChange={(e) => setVisitForm({ ...visitForm, patient_name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Patient WhatsApp Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={visitForm.phone}
                  onChange={(e) => setVisitForm({ ...visitForm, phone: e.target.value })}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Medical Specialty
                  </label>
                  <select
                    value={visitForm.department}
                    onChange={(e) => setVisitForm({ ...visitForm, department: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                  >
                    <option value="Cardiology">Cardiology</option>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Gynecology">Gynecology</option>
                    <option value="Dentistry">Dentistry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Consulting Doctor
                  </label>
                  <input
                    type="text"
                    required
                    value={visitForm.doctor}
                    onChange={(e) => setVisitForm({ ...visitForm, doctor: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="consent"
                  checked={visitForm.whatsapp_consent}
                  onChange={(e) =>
                    setVisitForm({ ...visitForm, whatsapp_consent: e.target.checked })
                  }
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="consent" className="text-xs text-slate-600 leading-snug cursor-pointer">
                  Patient gave consent to receive WhatsApp review invitations upon consultation completion.
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  {savingVisit ? 'Registering...' : 'Save & Register Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Sheet Sync & Webhook Pipeline ──────────────────────── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Spreadsheet Sync & Automation Webhook
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accepts live patient rows from Google Sheets, Microsoft 365, or Make.com webhooks.
                </p>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Clinic API Authorization Key
                </label>
                <input
                  type="text"
                  value={syncApiKey}
                  onChange={(e) => setSyncApiKey(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 bg-slate-50 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Incoming Rows JSON (Automated Payload)
                </label>
                <textarea
                  rows={7}
                  value={syncJson}
                  onChange={(e) => setSyncJson(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {syncResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    syncResult.rejected > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <p className="font-bold">
                    Sync Execution: {syncResult.accepted} Added/Updated, {syncResult.rejected} Skipped
                  </p>
                  {syncResult.errors.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 pt-1 text-[11px]">
                      {syncResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV Template</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSyncModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleRunSheetSync}
                    disabled={syncing}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    {syncing ? 'Syncing...' : 'Execute Live Sync Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
