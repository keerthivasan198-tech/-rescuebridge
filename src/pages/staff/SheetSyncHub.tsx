import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Link2,
  Unlink,
  Check,
  Play,
  ArrowRight,
  Database,
  ShieldCheck,
  Send,
  Eye,
  FileDown,
  Clock,
  Layers,
  Sparkles,
  Info,
  History,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import {
  HospitalSheetConnection,
  ColumnMapping,
  SyncRun,
  SyncError,
} from '../../types/database';

export default function SheetSyncHub() {
  const { currentHospital, isSuperAdmin } = useAuth();
  const hospitalId = currentHospital?.id || '11111111-1111-1111-1111-111111111111';

  // Navigation steps: 'connect' | 'mapping' | 'preview' | 'sync_active'
  const [activeStep, setActiveStep] = useState<'connect' | 'mapping' | 'preview' | 'sync_active'>('sync_active');

  const [connection, setConnection] = useState<HospitalSheetConnection | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const [loading, setLoading] = useState(true);

  // Connect Form State (Step 2)
  const [sheetType, setSheetType] = useState<'google_sheets' | 'excel_365' | 'onedrive'>('google_sheets');
  const [sheetUrlOrId, setSheetUrlOrId] = useState('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  const [tableName, setTableName] = useState('PatientVisits_2026');

  // Sample Raw Data for Initial Import / Delta Sync (Step 1 & 4)
  const [sampleDataText, setSampleDataText] = useState(`[
  {
    "visit_uid": "H12-2026-000451",
    "patient_name": "Suresh Raina",
    "phone": "+919888877777",
    "visit_date": "2026-09-28",
    "department": "Cardiology",
    "doctor": "Dr. Ramesh Kumar",
    "status": "completed"
  },
  {
    "visit_uid": "H12-2026-000452",
    "patient_name": "Meena Kumari",
    "phone": "+919777766666",
    "visit_date": "2026-09-28",
    "department": "Orthopedics",
    "doctor": "Dr. Rajesh Nathan",
    "status": "registered"
  },
  {
    "visit_uid": "H12-2026-000453",
    "patient_name": "Vijay Shankar",
    "phone": "+919666655555",
    "visit_date": "2026-09-28",
    "department": "General Medicine",
    "doctor": "Dr. S. Anita",
    "status": "completed"
  }
]`);

  // Column Mapping State (Step 3)
  const [mapping, setMapping] = useState<ColumnMapping>({
    visit_uid: 'visit_uid',
    patient_name: 'patient_name',
    phone: 'phone',
    visit_date: 'visit_date',
    department: 'department',
    doctor: 'doctor',
    status: 'status',
  });

  // Preview State (Step 4)
  const [previewResult, setPreviewResult] = useState<{
    previewRows: any[];
    totalRows: number;
    validCount: number;
    errorCount: number;
  } | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deltaSyncing, setDeltaSyncing] = useState(false);
  const [lastDeltaReport, setLastDeltaReport] = useState<{
    added: number;
    updated: number;
    unchanged: number;
    deleted: number;
    reviewDispatchedCount: number;
  } | null>(null);

  // Load connection and runs
  const loadData = async () => {
    setLoading(true);
    try {
      const conn = await db.getSheetConnection(hospitalId);
      setConnection(conn);
      if (conn && conn.status === 'active') {
        setActiveStep('sync_active');
        setMapping(conn.column_mapping);
      } else {
        setActiveStep('connect');
      }

      const runs = await db.getSyncRuns(hospitalId);
      setSyncRuns(runs);

      const errs = await db.getSyncErrors(hospitalId);
      setSyncErrors(errs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hospitalId]);

  // Step 1: Download Standard Sheet Template
  const handleDownloadTemplate = () => {
    const csvContent =
      'visit_uid,patient_name,phone,visit_date,department,doctor,status\n' +
      'H12-2026-000451,Kavitha Sundaram,+919876543210,2026-09-28,Cardiology,Dr. Ramesh Kumar,completed\n' +
      'H12-2026-000452,Arun Kumar,+919845012345,2026-09-28,General Medicine,Dr. S. Anita,registered\n' +
      'H12-2026-000453,Deepa Venkat,+919712345678,2026-09-28,Orthopedics,Dr. Rajesh Nathan,completed\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RescueBridge_Standard_Template_${currentHospital?.subdomain || 'hospital'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 4: Run Dry Run Preview
  const handleRunPreview = async () => {
    setPreviewLoading(true);
    try {
      const parsed = JSON.parse(sampleDataText);
      const res = await db.previewSheetImport(hospitalId, parsed, mapping);
      setPreviewResult(res);
      setActiveStep('preview');
    } catch (err: any) {
      alert(`Invalid JSON: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Step 5 & 6: Execute Initial Backfill (Mark Historical)
  const handleExecuteBackfill = async () => {
    setImporting(true);
    try {
      const parsed = JSON.parse(sampleDataText);
      await db.runInitialBackfill(hospitalId, parsed, mapping);
      await loadData();
      setActiveStep('sync_active');
    } catch (err: any) {
      alert(`Backfill error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Part B: Step 8 & 11: Execute Delta Sync (Live Delta Run)
  const handleRunDeltaSync = async () => {
    setDeltaSyncing(true);
    try {
      const parsed = JSON.parse(sampleDataText);
      const res = await db.runDeltaSync(hospitalId, parsed);
      setLastDeltaReport({
        added: res.added,
        updated: res.updated,
        unchanged: res.unchanged,
        deleted: res.deleted,
        reviewDispatchedCount: res.reviewDispatchedCount,
      });
      await loadData();
    } catch (err: any) {
      alert(`Delta sync error: ${err.message}`);
    } finally {
      setDeltaSyncing(false);
    }
  };

  // Step 11: Disconnect Sheet
  const handleDisconnect = async () => {
    if (!window.confirm('Disconnecting the sheet will halt automatic syncing. Existing visit data will be safely kept. Continue?')) {
      return;
    }
    await db.disconnectSheet(hospitalId);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ───────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Sheet Connection & Ongoing Delta Sync Pipeline
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Hospital: <span className="font-bold text-slate-800">{currentHospital?.name}</span> • One-time backfill followed by recurring delta sync.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download Sheet Template (.csv)
          </button>

          {connection?.status === 'active' && (
            <button
              type="button"
              onClick={handleRunDeltaSync}
              disabled={deltaSyncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${deltaSyncing ? 'animate-spin' : ''}`} />
              {deltaSyncing ? 'Syncing Deltas...' : 'Sync Now (Delta Run)'}
            </button>
          )}
        </div>
      </div>

      {/* ── Progress Wizard Indicator ───────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs overflow-x-auto">
        <div
          onClick={() => setActiveStep('connect')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
            activeStep === 'connect' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">1</span>
          <span>1. Connect Sheet</span>
        </div>

        <div className="text-slate-300">→</div>

        <div
          onClick={() => setActiveStep('mapping')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
            activeStep === 'mapping' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">2</span>
          <span>2. Column Mapping</span>
        </div>

        <div className="text-slate-300">→</div>

        <div
          onClick={handleRunPreview}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
            activeStep === 'preview' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">3</span>
          <span>3. Dry Run Preview</span>
        </div>

        <div className="text-slate-300">→</div>

        <div
          onClick={() => setActiveStep('sync_active')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
            activeStep === 'sync_active' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold">4</span>
          <span>4. Live Delta Pipeline</span>
        </div>
      </div>

      {/* ── STEP 1 & 2: Connect Sheet View ──────────────────────────── */}
      {activeStep === 'connect' && (
        <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6 animate-slide-up">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-emerald-600" />
              Step 2: Connect Your Hospital Sheet
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select your source platform and provide your sheet details. We support Google Sheets, Excel 365, and OneDrive tables.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSheetType('google_sheets')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                sheetType === 'google_sheets'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="font-bold text-xs text-slate-900">Google Sheets</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Share with Service Account</p>
            </button>

            <button
              type="button"
              onClick={() => setSheetType('excel_365')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                sheetType === 'excel_365'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="font-bold text-xs text-slate-900">Excel 365</p>
              <p className="text-[11px] text-slate-400 mt-0.5">OneDrive / SharePoint Table</p>
            </button>

            <button
              type="button"
              onClick={() => setSheetType('onedrive')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                sheetType === 'onedrive'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="font-bold text-xs text-slate-900">OneDrive Business</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Excel Table Format</p>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sheet URL or Spreadsheet ID *
              </label>
              <input
                type="text"
                required
                value={sheetUrlOrId}
                onChange={(e) => setSheetUrlOrId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs... or Sheet ID"
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Table or Worksheet Tab Name
              </label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Sheet1 or PatientVisits"
                className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Important Requirement (Step 1):</span> Your sheet must contain a unique business ID column (<code className="font-mono bg-white px-1 rounded">visit_uid</code>, e.g. <span className="font-mono">H12-2026-000451</span>). Do not use row numbers, as sorting or inserting rows changes line numbers.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveStep('mapping')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
              >
                Proceed to Column Mapping
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Column Mapping View ─────────────────────────────── */}
      {activeStep === 'mapping' && (
        <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6 animate-slide-up">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              Step 3: Column Mapping
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Match the column headers from your hospital's spreadsheet to our required fields. Auto-matching has pre-aligned standard names.
            </p>
          </div>

          <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-200">
              <span>Required System Field</span>
              <span>Your Spreadsheet Column</span>
            </div>

            {/* visit_uid */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Unique Visit ID *</p>
                <p className="text-[10px] text-slate-400">e.g. H12-2026-000451</p>
              </div>
              <input
                type="text"
                value={mapping.visit_uid}
                onChange={(e) => setMapping({ ...mapping, visit_uid: e.target.value })}
                className="text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            {/* patient_name */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Patient Full Name *</p>
                <p className="text-[10px] text-slate-400">patient_name / Name</p>
              </div>
              <input
                type="text"
                value={mapping.patient_name}
                onChange={(e) => setMapping({ ...mapping, patient_name: e.target.value })}
                className="text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            {/* phone */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Mobile Phone *</p>
                <p className="text-[10px] text-slate-400">phone / Mobile No (with country code)</p>
              </div>
              <input
                type="text"
                value={mapping.phone}
                onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                className="text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            {/* visit_date */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Visit Date *</p>
                <p className="text-[10px] text-slate-400">visit_date / Date</p>
              </div>
              <input
                type="text"
                value={mapping.visit_date}
                onChange={(e) => setMapping({ ...mapping, visit_date: e.target.value })}
                className="text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            {/* department */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Medical Department</p>
                <p className="text-[10px] text-slate-400">department / Specialty</p>
              </div>
              <input
                type="text"
                value={mapping.department}
                onChange={(e) => setMapping({ ...mapping, department: e.target.value })}
                className="text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            {/* doctor */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Consulting Doctor</p>
                <p className="text-[10px] text-slate-400">doctor / Physician</p>
              </div>
              <input
                type="text"
                value={mapping.doctor}
                onChange={(e) => setMapping({ ...mapping, doctor: e.target.value })}
                className="text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>

            {/* status */}
            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <p className="text-xs font-bold text-slate-900">Consultation Status *</p>
                <p className="text-[10px] text-slate-400">status (completed / registered)</p>
              </div>
              <input
                type="text"
                value={mapping.status}
                onChange={(e) => setMapping({ ...mapping, status: e.target.value })}
                className="text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          {/* JSON Simulator Editor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Live Sheet Data Rows (JSON / Stream from Watch Rows)
            </label>
            <textarea
              rows={6}
              value={sampleDataText}
              onChange={(e) => setSampleDataText(e.target.value)}
              className="w-full text-xs font-mono rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveStep('connect')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleRunPreview}
              disabled={previewLoading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {previewLoading ? 'Analyzing Rows...' : 'Run Dry Run & Preview'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 & 5: Dry Run Preview & Backfill ───────────────────── */}
      {activeStep === 'preview' && previewResult && (
        <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Step 4: Dry Run & Preview ({previewResult.totalRows} Rows Evaluated)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Problems are flagged before anything is saved. No data has been inserted into the database yet.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ {previewResult.validCount} Valid
              </span>
              {previewResult.errorCount > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                  ⚠ {previewResult.errorCount} Issues
                </span>
              )}
            </div>
          </div>

          {/* Critical Explanation of Step 5 */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-purple-900">
                Part A Step 5 Protection: Historical Backfill (<code className="font-mono">historical = true</code>)
              </p>
              <p className="text-xs text-purple-800 mt-1 leading-relaxed">
                When you click "Run Initial Import", all rows will be recorded as historical baselines. <span className="font-bold underline">No WhatsApp review requests will be sent to past patients</span>. Only new visits added during ongoing sync will trigger reviews.
              </p>
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Visit UID</th>
                  <th className="px-4 py-3">Patient Name</th>
                  <th className="px-4 py-3">Mobile Phone</th>
                  <th className="px-4 py-3">Department & Doctor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewResult.previewRows.map((row) => (
                  <tr key={row.rowNumber} className={row.isValid ? 'hover:bg-slate-50/70' : 'bg-red-50/40'}>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{row.rowNumber}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{row.visit_uid}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.patient_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{row.phone}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.doctor} <span className="text-slate-400">({row.department})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize font-semibold text-slate-800">{row.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Valid
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200"
                          title={row.errorReason}
                        >
                          <AlertTriangle className="w-3 h-3" /> {row.errorReason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveStep('mapping')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ← Edit Mapping & Sheet
            </button>

            <button
              type="button"
              onClick={handleExecuteBackfill}
              disabled={importing}
              className="px-7 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              {importing ? 'Importing Historical Baseline...' : 'Execute Initial Import (Mark Historical)'}
            </button>
          </div>
        </div>
      )}

      {/* ── PART B: Live Delta Pipeline Dashboard (Step 6, 8, 10, 11) ── */}
      {activeStep === 'sync_active' && (
        <div className="space-y-6 animate-slide-up">
          {/* Active Connection Status Bar */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Recurring Delta Sync: Active & Monitoring
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ● Connected to {connection?.sheet_type === 'google_sheets' ? 'Google Sheets' : 'Excel 365'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Table: {connection?.table_name || 'PatientVisits'} • Tracking {connection?.total_rows_tracked || 0} visits with cryptographic SHA row hashes
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveStep('mapping')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all"
              >
                Re-Map Columns
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-all flex items-center gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect Sheet
              </button>
            </div>
          </div>

          {/* Last Delta Run Report Banner (Step 8 & 9) */}
          {lastDeltaReport && (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-5 rounded-3xl shadow-sm space-y-2 animate-slide-up">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                  Last Delta Sync Completed
                </p>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
                  SHA-256 Hash Matching
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-center">
                <div className="bg-white/10 p-2.5 rounded-2xl">
                  <p className="text-xl font-bold">{lastDeltaReport.added}</p>
                  <p className="text-[10px] text-emerald-100 uppercase">New Visits Added</p>
                </div>
                <div className="bg-white/10 p-2.5 rounded-2xl">
                  <p className="text-xl font-bold">{lastDeltaReport.updated}</p>
                  <p className="text-[10px] text-emerald-100 uppercase">Hash Modified</p>
                </div>
                <div className="bg-white/10 p-2.5 rounded-2xl">
                  <p className="text-xl font-bold">{lastDeltaReport.unchanged}</p>
                  <p className="text-[10px] text-emerald-100 uppercase">Unchanged (Skipped)</p>
                </div>
                <div className="bg-white/10 p-2.5 rounded-2xl">
                  <p className="text-xl font-bold">{lastDeltaReport.deleted}</p>
                  <p className="text-[10px] text-emerald-100 uppercase">Soft Deleted</p>
                </div>
                <div className="bg-amber-400 text-slate-900 p-2.5 rounded-2xl font-bold">
                  <p className="text-xl">{lastDeltaReport.reviewDispatchedCount}</p>
                  <p className="text-[10px] uppercase font-bold">WhatsApp Reviews Triggered</p>
                </div>
              </div>
            </div>
          )}

          {/* Sync History & Error Logs (Step 10) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sync Runs Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-600" />
                  Recent Sync Executions ({syncRuns.length})
                </h4>
                <span className="text-[11px] text-slate-400">Every 5–15 mins</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <tr>
                      <th className="py-2">Type</th>
                      <th className="py-2">Added</th>
                      <th className="py-2">Updated</th>
                      <th className="py-2">Time</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syncRuns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No sync runs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      syncRuns.slice(0, 6).map((run) => (
                        <tr key={run.id}>
                          <td className="py-3 font-semibold text-slate-800 capitalize">
                            {run.sync_type.replace('_', ' ')}
                          </td>
                          <td className="py-3 text-emerald-600 font-bold">+{run.rows_added}</td>
                          <td className="py-3 text-slate-600">{run.rows_updated}</td>
                          <td className="py-3 text-slate-400 font-mono text-[11px]">
                            {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              ✓ {run.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sync Errors Log Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Sync Error Logs ({syncErrors.length})
                </h4>
                <span className="text-[11px] text-slate-400">Rejected rows logged</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <tr>
                      <th className="py-2">Visit UID / Row</th>
                      <th className="py-2">Reason</th>
                      <th className="py-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {syncErrors.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400">
                          Zero sync errors. All rows clean and valid.
                        </td>
                      </tr>
                    ) : (
                      syncErrors.slice(0, 6).map((err) => (
                        <tr key={err.id}>
                          <td className="py-3 font-mono font-bold text-slate-800">{err.row_reference}</td>
                          <td className="py-3 text-red-600 font-medium">{err.reason}</td>
                          <td className="py-3 text-right text-slate-400 font-mono text-[11px]">
                            {new Date(err.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
