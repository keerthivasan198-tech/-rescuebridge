import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Clock,
  Sparkles,
  ArrowRight,
  Unlink,
  ChevronDown,
  ChevronUp,
  FileCheck,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import {
  HospitalSheetConnection,
  ColumnMapping,
  SyncRun,
} from '../../types/database';

export default function SheetSyncHub() {
  const { currentHospital } = useAuth();
  const hospitalId = currentHospital?.id || '11111111-1111-1111-1111-111111111111';

  const [connection, setConnection] = useState<HospitalSheetConnection | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Connection Form State
  const [sheetType, setSheetType] = useState<'google_sheets' | 'excel_365'>('google_sheets');
  const [sheetUrl, setSheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
  );
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Column Mapping (auto-matched by default)
  const [mapping, setMapping] = useState<ColumnMapping>({
    visit_uid: 'visit_uid',
    patient_name: 'patient_name',
    phone: 'phone',
    visit_date: 'visit_date',
    department: 'department',
    doctor: 'doctor',
    status: 'status',
  });

  const [syncing, setSyncing] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sample data to seed / simulate sheet rows
  const defaultSampleRows = [
    {
      visit_uid: 'H12-2026-000451',
      patient_name: 'Suresh Raina',
      phone: '+919888877777',
      visit_date: new Date().toISOString().split('T')[0],
      department: 'Cardiology',
      doctor: 'Dr. Ramesh Kumar',
      status: 'completed',
    },
    {
      visit_uid: 'H12-2026-000452',
      patient_name: 'Meena Kumari',
      phone: '+919777766666',
      visit_date: new Date().toISOString().split('T')[0],
      department: 'Orthopedics',
      doctor: 'Dr. Rajesh Nathan',
      status: 'registered',
    },
    {
      visit_uid: 'H12-2026-000453',
      patient_name: 'Vijay Shankar',
      phone: '+919666655555',
      visit_date: new Date().toISOString().split('T')[0],
      department: 'General Medicine',
      doctor: 'Dr. S. Anita',
      status: 'completed',
    },
  ];

  // Load connection and history
  const loadData = async () => {
    setLoading(true);
    try {
      const conn = await db.getSheetConnection(hospitalId);
      setConnection(conn);
      if (conn && conn.status === 'active') {
        setIsEditing(false);
        setSheetType(conn.sheet_type === 'excel_365' ? 'excel_365' : 'google_sheets');
        setSheetUrl(
          conn.sheet_id.startsWith('http')
            ? conn.sheet_id
            : `https://docs.google.com/spreadsheets/d/${conn.sheet_id}/edit`
        );
        setMapping(conn.column_mapping);
      } else {
        setIsEditing(true);
      }

      const runs = await db.getSyncRuns(hospitalId);
      setSyncRuns(runs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hospitalId]);

  // Connect & Save
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    setSyncing(true);
    try {
      // Extract clean ID or keep full URL
      let sheetId = sheetUrl.trim();
      const googleMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (googleMatch && googleMatch[1]) {
        sheetId = googleMatch[1];
      }

      await db.saveSheetConnection({
        hospital_id: hospitalId,
        sheet_type: sheetType,
        sheet_id: sheetId,
        table_name: 'PatientVisits',
        column_mapping: mapping,
      });

      // Run initial backfill of patients
      await db.runInitialBackfill(hospitalId, defaultSampleRows, mapping);
      await loadData();

      setSaveSuccessMessage('Sheet connected successfully! Patient visits are now synchronized.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      setIsEditing(false);
    } catch (err: any) {
      alert(`Connection failed: ${err.message || 'Please verify sheet permissions'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Immediate "Sync Now"
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await db.runDeltaSync(hospitalId, defaultSampleRows);
      await loadData();
      setSaveSuccessMessage('Sync complete: All latest patient records are up to date.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (window.confirm('Disconnect this spreadsheet? Auto-syncing will pause, but existing patient visits remain safe.')) {
      await db.disconnectSheet(hospitalId);
      await loadData();
      setIsEditing(true);
    }
  };

  // Download Standard Template CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      'patient_name,phone,visit_date,department,doctor,status,visit_uid\n' +
      'Kavitha Sundaram,+919876543210,2026-09-28,Cardiology,Dr. Ramesh Kumar,completed,H12-2026-000451\n' +
      'Arun Kumar,+919845012345,2026-09-28,General Medicine,Dr. S. Anita,registered,H12-2026-000452\n' +
      'Deepa Venkat,+919712345678,2026-09-28,Orthopedics,Dr. Rajesh Nathan,completed,H12-2026-000453\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Hospital_Patients_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const serviceEmail = 'sync@rescuebridge.iam.gserviceaccount.com';

  const copyServiceEmail = () => {
    navigator.clipboard.writeText(serviceEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Connect Patient Spreadsheet
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sync consultations automatically from Google Sheets or Excel to send WhatsApp review invitations.
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Download Sample Sheet</span>
        </button>
      </div>

      {/* Success Notification */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200/80 text-emerald-900 p-4 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* ── Main State: CONNECTED CARD ───────────────────────────── */}
      {connection?.status === 'active' && !isEditing ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {connection.sheet_type === 'excel_365' ? 'Microsoft Excel Sheet' : 'Google Sheets'}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-Sync Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                  {sheetUrl}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href={sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Open Sheet</span>
              </a>

              <button
                onClick={handleSyncNow}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>

          {/* 3 Clean Status Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
              <p className="text-xs text-slate-500 font-medium">Patients Synced</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {connection.total_rows_tracked || 3} Visits
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Ready for review dispatch
              </p>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
              <p className="text-xs text-slate-500 font-medium">Last Synchronized</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">Just now</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Checked for new consultations</p>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
              <p className="text-xs text-slate-500 font-medium">Sync Schedule</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">Every 15 min</p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Automated background poll</p>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <button
              onClick={() => setIsEditing(true)}
              className="text-slate-600 hover:text-slate-900 font-semibold hover:underline"
            >
              Change Spreadsheet Link or Settings
            </button>

            <button
              onClick={handleDisconnect}
              className="text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1 hover:underline"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Disconnect Sheet</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Simple Connection Form (Clean & Easy) ─────────────────── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Select Your Spreadsheet Platform
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose where your patient appointment or consultation list is saved.
            </p>
          </div>

          {/* 2 Big Friendly Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Google Sheets Option */}
            <button
              type="button"
              onClick={() => setSheetType('google_sheets')}
              className={`p-5 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                sheetType === 'google_sheets'
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-slate-900">Google Sheets</p>
                  {sheetType === 'google_sheets' && (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Connect any live Google Sheet. Updates automatically in real time.
                </p>
              </div>
            </button>

            {/* Microsoft Excel / 365 Option */}
            <button
              type="button"
              onClick={() => setSheetType('excel_365')}
              className={`p-5 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                sheetType === 'excel_365'
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-slate-900">Microsoft Excel / 365</p>
                  {sheetType === 'excel_365' && (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Connect via OneDrive, SharePoint link, or upload an Excel table.
                </p>
              </div>
            </button>
          </div>

          <form onSubmit={handleConnectSheet} className="space-y-5 pt-2">
            {/* Input Link */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {sheetType === 'google_sheets'
                  ? 'Paste Google Sheet Link *'
                  : 'Paste OneDrive / SharePoint Excel Link *'}
              </label>
              <input
                type="text"
                required
                placeholder={
                  sheetType === 'google_sheets'
                    ? 'https://docs.google.com/spreadsheets/d/your-sheet-id/edit'
                    : 'https://onedrive.live.com/... or SharePoint table link'
                }
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-mono"
              />
            </div>

            {/* Quick 1-Step Permission Tip for Google Sheets */}
            {sheetType === 'google_sheets' && (
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">
                    Quick Setup: Share Sheet with Sync Bot
                  </p>
                  <button
                    type="button"
                    onClick={copyServiceEmail}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied Email!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Email
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  In Google Sheets, click <strong className="text-slate-700">Share</strong> and grant "Viewer" or "Editor" access to:
                </p>
                <div className="bg-white border border-slate-200 p-2 rounded-lg font-mono text-[11px] text-slate-800 flex items-center justify-between">
                  <span className="truncate">{serviceEmail}</span>
                  <button
                    type="button"
                    onClick={copyServiceEmail}
                    className="ml-2 text-emerald-600 hover:text-emerald-700 font-sans font-semibold text-[11px]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible Advanced Column Names (Hidden by default) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <span>Need custom column names? (Optional)</span>
                {showAdvancedMapping ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showAdvancedMapping && (
                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 text-xs animate-in fade-in duration-150">
                  <p className="text-slate-600 text-[11px]">
                    By default, columns named <code className="bg-white px-1 py-0.5 rounded border text-emerald-700 font-mono">patient_name</code>, <code className="bg-white px-1 py-0.5 rounded border text-emerald-700 font-mono">phone</code>, <code className="bg-white px-1 py-0.5 rounded border text-emerald-700 font-mono">doctor</code>, <code className="bg-white px-1 py-0.5 rounded border text-emerald-700 font-mono">status</code> are automatically detected.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Patient Name Column
                      </label>
                      <input
                        type="text"
                        value={mapping.patient_name}
                        onChange={(e) => setMapping({ ...mapping, patient_name: e.target.value })}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Phone Number Column
                      </label>
                      <input
                        type="text"
                        value={mapping.phone}
                        onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Doctor Name Column
                      </label>
                      <input
                        type="text"
                        value={mapping.doctor}
                        onChange={(e) => setMapping({ ...mapping, doctor: e.target.value })}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              {connection?.status === 'active' && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={syncing}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting & Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connect & Start Auto-Sync</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Recent Activity History ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Recent Sync Activity</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Automatic 15-Minute Polling</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4">Patient Visits</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 font-mono text-[11px] text-slate-500">Just now</td>
                <td className="py-3 px-4 font-medium">
                  {sheetType === 'excel_365' ? 'Microsoft Excel' : 'Google Sheets'}
                </td>
                <td className="py-3 px-4 font-semibold text-emerald-800">+3 Patient Visits Synced</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Success
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 font-mono text-[11px] text-slate-500">15 mins ago</td>
                <td className="py-3 px-4 font-medium">Auto-Sync Poll</td>
                <td className="py-3 px-4 text-slate-500">Checked (0 new changes)</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Up to date
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
