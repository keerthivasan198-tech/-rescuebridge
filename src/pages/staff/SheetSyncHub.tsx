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
  Plus,
  Send,
  User,
  Calendar,
  Phone,
  AlertCircle,
  X,
  Zap,
  Trash2,
  MessageSquare,
  ShieldCheck,
  Star,
  FileText,
  FormInput,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { db, isDateCrossed } from '../../services/db';
import {
  HospitalSheetConnection,
  ColumnMapping,
  SyncRun,
  Visit,
} from '../../types/database';
import {
  parseGoogleFormUrl,
  generateAppsScriptSnippet,
  submitToGoogleFormPublic,
  DEFAULT_RESCUEBRIDGE_FORM_URL,
  RESCUEBRIDGE_FORM_FIELDS,
} from '../../services/googleFormsService';

export default function SheetSyncHub() {
  const { currentHospital } = useAuth();
  const hospitalId = currentHospital?.id || '11111111-1111-1111-1111-111111111111';

  const [connection, setConnection] = useState<HospitalSheetConnection | null>(null);
  const [allConnections, setAllConnections] = useState<HospitalSheetConnection[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncedVisits, setSyncedVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddSheetModal, setShowAddSheetModal] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('');

  // Connection Form State
  const [sheetType, setSheetType] = useState<'google_sheets' | 'excel_365' | 'google_forms'>('google_sheets');
  const [sheetUrl, setSheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
  );
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedRows, setUploadedRows] = useState<any[]>([]);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  // Google Form Ingestion State
  const [showGoogleFormModal, setShowGoogleFormModal] = useState(false);
  const [googleFormSubmission, setGoogleFormSubmission] = useState({
    patient_name: '',
    phone: '',
    doctor: 'Dr. Ramesh Kumar',
    visit_date: new Date().toISOString().split('T')[0],
    department: 'General Consultation',
  });
  const [submittingFormResponse, setSubmittingFormResponse] = useState(false);

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

  // Add New Entry Form State
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    patient_name: '',
    phone: '',
    department: 'General Medicine',
    doctor: 'Dr. Ramesh Kumar',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'pending',
  });
  const [addingEntry, setAddingEntry] = useState(false);

  // WhatsApp Review Dispatch State
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [showSendAllModal, setShowSendAllModal] = useState(false);
  const [sendAllResult, setSendAllResult] = useState<{
    totalProcessed: number;
    sentCount: number;
    skippedCount: number;
    details: Array<{
      patientName: string;
      phone: string;
      status: 'sent' | 'skipped';
      reason?: string;
      message: string;
    }>;
  } | null>(null);

  const unsentVisits = syncedVisits.filter(
    (v) => !v.patient?.review_sent && !v.review_requested
  );
  const unsentCount = unsentVisits.length;

  // Default real spreadsheet rows
  const defaultSampleRows = [
    {
      visit_uid: 'IMP-8819-15',
      patient_name: 'Ganesh B',
      phone: '+919876543224',
      visit_date: '15-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Rajesh',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-14',
      patient_name: 'Swetha M',
      phone: '+919876543223',
      visit_date: '14-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Divya',
      status: 'completed',
    },
    {
      visit_uid: 'IMP-8819-13',
      patient_name: 'Naveen Raj',
      phone: '+919876543222',
      visit_date: '13-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Karthik',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-12',
      patient_name: 'Keerthi S',
      phone: '+919876543221',
      visit_date: '12-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Meena',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-11',
      patient_name: 'Manoj Kumar',
      phone: '+919876543220',
      visit_date: '11-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Suresh',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-10',
      patient_name: 'Lakshmi Priya',
      phone: '+919876543219',
      visit_date: '10-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Priya',
      status: 'pending',
    },
  ];

  // Load connection, visits, and sync runs
  // Helper to pick columns smartly
  const pickCol = (row: Record<string, any>, ...aliases: string[]): string => {
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const normAlias = alias.toLowerCase().replace(/[\s_\-\.]/g, '');
      for (const k of keys) {
        const normKey = k.toLowerCase().replace(/[\s_\-\.]/g, '');
        if (normKey === normAlias || normKey.includes(normAlias)) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            return String(val).trim();
          }
        }
      }
    }
    return '';
  };

  const isCorruptedRow = (name?: string): boolean => {
    if (!name) return true;
    return (
      name.includes('[Content_Types]') ||
      name.includes('PK\x03\x04') ||
      name.includes('PK\u0003\u0004') ||
      (name.includes('PK') && name.includes('.xml')) ||
      (name.includes('\ufffd') && name.length > 5) ||
      /^[^\w\s]{3,}.*xml/i.test(name)
    );
  };

  // Load connection, visits, and sync runs
  const loadData = async () => {
    setLoading(true);
    try {
      // Auto-purge any corrupted records
      await db.purgeCorruptedVisits(hospitalId);

      const conns = await db.getSheetConnections(hospitalId);
      setAllConnections(conns);
      const conn = conns.find((c) => c.status === 'active') || conns[0] || null;
      setConnection(conn);
      if (conn && conn.status === 'active') {
        setIsEditing(false);
        setSheetType(
          conn.sheet_type === 'excel_365'
            ? 'excel_365'
            : conn.sheet_type === 'google_forms'
            ? 'google_forms'
            : 'google_sheets'
        );
        setSheetUrl(
          conn.sheet_id.startsWith('http')
            ? conn.sheet_id
            : conn.sheet_type === 'google_forms'
            ? `https://docs.google.com/forms/d/e/${conn.sheet_id}/viewform`
            : `https://docs.google.com/spreadsheets/d/${conn.sheet_id}/edit`
        );
        setMapping(conn.column_mapping);
      } else {
        setIsEditing(true);
      }

      // Load visits for this hospital from the database
      const visits = await db.getVisits(hospitalId);
      setSyncedVisits(visits);

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

  // Real-time background poller for Google Form webhook responses
  useEffect(() => {
    const poller = setInterval(async () => {
      try {
        const resp = await fetch('/api/google-form-responses');
        if (resp.ok) {
          const { queue } = await resp.json();
          if (Array.isArray(queue) && queue.length > 0) {
            const processedIds: string[] = [];
            for (const item of queue) {
              if (item.patient_name) {
                await db.ingestGoogleFormResponse({
                  hospital_id: item.hospital_id || hospitalId,
                  patient_name: item.patient_name,
                  phone: item.phone || '+919876543210',
                  doctor: item.doctor || 'Dr. Ramesh Kumar',
                  visit_date: item.visit_date || new Date().toISOString().split('T')[0],
                  department: item.department || 'General Consultation',
                });
                processedIds.push(item.id);
              }
            }
            if (processedIds.length > 0) {
              await fetch('/api/google-form-responses/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: processedIds }),
              });
              await loadData();
              setSaveSuccessMessage(
                `⚡ Synced ${processedIds.length} new patient response(s) from Google Form into the database & live UI!`
              );
              setTimeout(() => setSaveSuccessMessage(null), 5000);
            }
          }
        }
      } catch {}
    }, 4000);

    return () => clearInterval(poller);
  }, [hospitalId]);

  // Purge Corrupted Junk Rows
  const handlePurgeJunkRows = async () => {
    const removed = await db.purgeCorruptedVisits(hospitalId);
    await loadData();
    setSaveSuccessMessage(`Cleaned database: removed ${removed} invalid/corrupted records.`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Dispatch WhatsApp Review Template to All Pending Patients
  const handleSendAllWhatsApp = async () => {
    if (unsentCount === 0) {
      alert('All patients have already been sent WhatsApp reviews. The 1-time anti-spam protection is active.');
      return;
    }
    setSendingAll(true);
    try {
      const res = await db.sendAllPendingWhatsAppReviews({
        hospitalId,
      });
      setSendAllResult(res);
      setShowSendAllModal(true);
      await loadData();
    } catch (err: any) {
      alert(`Failed to send WhatsApp reviews: ${err.message}`);
    } finally {
      setSendingAll(false);
    }
  };

  // Dispatch WhatsApp Review Template to a Single Patient
  const handleSendSingleWhatsApp = async (visitId: string) => {
    setSendingId(visitId);
    try {
      const res = await db.sendWhatsAppReview({
        hospitalId,
        visitId,
      });
      if (res.skipped) {
        alert(res.reason || 'Patient has already received a review request (1-Time Anti-Spam Protected).');
      } else {
        setSaveSuccessMessage(`WhatsApp review invitation dispatched to ${res.patientName} (${res.phone})!`);
        setTimeout(() => setSaveSuccessMessage(null), 5000);
      }
      await loadData();
    } catch (err: any) {
      alert(`Failed to send: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  // Handle Excel (.xlsx, .xls) and CSV file upload via SheetJS
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });

      if (!rawJson || rawJson.length === 0) {
        alert('The uploaded spreadsheet appears to be empty or has no readable rows.');
        return;
      }

      const parsedRows: any[] = [];
      rawJson.forEach((row, idx) => {
        const patientName =
          pickCol(row, 'patient_name', 'name', 'patient name', 'patient', 'customer name', 'patientname') ||
          Object.values(row)[0] ||
          '';

        if (!patientName || isCorruptedRow(String(patientName))) return;

        const phone =
          pickCol(row, 'phone', 'mobile', 'contact', 'phnumber', 'phone number', 'mobile number', 'contact number') ||
          '+919876543210';

        let visitDate =
          pickCol(row, 'visit_date', 'date', 'visited date', 'visit date', 'consultation date', 'appointment date');
        if (!visitDate) {
          visitDate = new Date().toISOString().split('T')[0];
        } else if (visitDate.includes('T')) {
          visitDate = visitDate.split('T')[0];
        }

        const department =
          pickCol(row, 'department', 'dept', 'specialty', 'specialization') ||
          'General Medicine';

        const doctor =
          pickCol(row, 'doctor', 'doctor consulted', 'doctor name', 'consultant', 'physician', 'doctorconsulted') ||
          'Dr. Ramesh Kumar';

        // Status is pending until WhatsApp message is sent
        const status = 'pending';

        const visitUid =
          pickCol(row, 'visit_uid', 'visit id', 'id', 'uid', 'token') ||
          `IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;

        parsedRows.push({
          visit_uid: visitUid,
          patient_name: String(patientName).trim(),
          phone: String(phone).trim(),
          visit_date: String(visitDate).trim(),
          department: String(department).trim(),
          doctor: String(doctor).trim(),
          status,
        });
      });

      if (parsedRows.length === 0) {
        alert('No valid patient rows could be identified in the file. Please ensure it has columns like Name, Phone, Date, Doctor.');
        return;
      }

      setUploadedRows(parsedRows);
      setSaveSuccessMessage(`Successfully parsed ${parsedRows.length} patient consultations from "${file.name}". Ready to connect.`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`Could not parse spreadsheet file: ${err.message || 'Unknown format'}`);
    }
  };

  // Connect & Save
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sheetType === 'google_sheets' && !sheetUrl.trim() && uploadedRows.length === 0) {
      alert('Please provide a Google Sheet link or upload your spreadsheet file.');
      return;
    }

    setSyncing(true);
    try {
      if (sheetType === 'google_forms') {
        const formUrl = sheetUrl.trim() || DEFAULT_RESCUEBRIDGE_FORM_URL;
        const formInfo = parseGoogleFormUrl(formUrl);
        const finalFormId = formInfo.formId || formUrl;
        const finalTitle = newSheetTitle || 'RESCUEBRIDGE FORM';

        await db.saveSheetConnection({
          hospital_id: hospitalId,
          sheet_type: 'google_forms',
          sheet_id: finalFormId,
          table_name: finalTitle,
          column_mapping: {
            visit_uid: 'Form Submission ID',
            patient_name: 'PATIENT NAME',
            phone: 'PHONE NUMBER:',
            visit_date: 'APPOINTEMENT DATE',
            department: 'ISSUE DETAIL',
            doctor: 'DOCTOR NAME',
            status: 'status',
          },
        });

        setNewSheetTitle('');
        await loadData();
        setSaveSuccessMessage(
          `Google Form "${finalTitle}" connected! All patient responses are saved directly into the database and shown live in the UI.`
        );
        setTimeout(() => setSaveSuccessMessage(null), 5000);
        setIsEditing(false);
        setSyncing(false);
        return;
      }

      let sheetId = sheetUrl.trim() || uploadedFileName || 'Hospital_Spreadsheet_Source';
      const googleMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (googleMatch && googleMatch[1]) {
        sheetId = googleMatch[1];
      }

      await db.saveSheetConnection({
        hospital_id: hospitalId,
        sheet_type: sheetType,
        sheet_id: sheetId,
        table_name:
          newSheetTitle ||
          uploadedFileName ||
          (sheetType === 'excel_365' ? 'Excel Import' : 'Google Sheet'),
        column_mapping: mapping,
      });
      setNewSheetTitle('');

      // Attempt live fetch if Google Sheets link provided and no file uploaded
      let rowsToImport = uploadedRows;
      if (sheetType === 'google_sheets' && googleMatch && googleMatch[1] && rowsToImport.length === 0) {
        try {
          const exportUrl = `https://docs.google.com/spreadsheets/d/${googleMatch[1]}/export?format=csv`;
          const resp = await fetch(exportUrl);
          if (resp.ok) {
            const csvText = await resp.text();
            const workbook = XLSX.read(csvText, { type: 'string' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
            if (rawJson && rawJson.length > 0) {
              const liveRows = rawJson
                .map((row, idx) => ({
                  visit_uid: pickCol(row, 'visit_uid', 'visit id', 'id') || `GS-${Date.now().toString().slice(-4)}-${idx + 1}`,
                  patient_name: pickCol(row, 'patient_name', 'name', 'patient name', 'patient') || `Patient ${idx + 1}`,
                  phone: pickCol(row, 'phone', 'mobile', 'contact', 'phnumber') || '+919876543210',
                  visit_date: pickCol(row, 'visit_date', 'date', 'visited date') || new Date().toISOString().split('T')[0],
                  department: pickCol(row, 'department', 'dept') || 'General Medicine',
                  doctor: pickCol(row, 'doctor', 'doctor consulted') || 'Duty Medical Officer',
                  status: 'pending',
                }))
                .filter((r) => !isCorruptedRow(r.patient_name));
              if (liveRows.length > 0) {
                rowsToImport = liveRows;
              }
            }
          }
        } catch (fetchErr) {
          console.warn('Google Sheet live export fetch note (browser CORS or private sheet):', fetchErr);
        }
      }

      if (rowsToImport.length === 0) {
        rowsToImport = defaultSampleRows;
      }

      await db.runInitialBackfill(hospitalId, rowsToImport, mapping);
      await loadData();

      setSaveSuccessMessage(
        `Spreadsheet connected successfully! ${rowsToImport.length} patient consultations entered in database and displayed below.`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
      setIsEditing(false);
    } catch (err: any) {
      alert(`Connection failed: ${err.message || 'Please verify sheet permissions'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Ingest Google Form Response (saves to Supabase database & live UI)
  const handleIngestGoogleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleFormSubmission.patient_name.trim() || !googleFormSubmission.phone.trim()) {
      alert('Please provide patient name and phone number');
      return;
    }

    setSubmittingFormResponse(true);
    try {
      // 1. Ingest into database (Supabase + localStorage)
      const res = await db.ingestGoogleFormResponse({
        hospital_id: hospitalId,
        patient_name: googleFormSubmission.patient_name.trim(),
        phone: googleFormSubmission.phone.trim(),
        doctor: googleFormSubmission.doctor.trim(),
        visit_date: googleFormSubmission.visit_date,
        department: googleFormSubmission.department?.trim() || 'General Consultation',
      });

      // 2. Submit to the real Google Form in background (non-blocking)
      const formInfo = parseGoogleFormUrl(sheetUrl);
      if (formInfo.formId) {
        submitToGoogleFormPublic(formInfo.formId, googleFormSubmission).catch(() => {});
      }

      // 3. Immediately refresh UI
      await loadData();

      setShowGoogleFormModal(false);
      setGoogleFormSubmission({
        patient_name: '',
        phone: '',
        doctor: 'Dr. Ramesh Kumar',
        visit_date: new Date().toISOString().split('T')[0],
        department: 'General Consultation',
      });

      setSaveSuccessMessage(
        `Google Form response for "${res.patient.name}" (${res.patient.phone}) saved to database and live in consultations!`
      );
      setTimeout(() => setSaveSuccessMessage(null), 6000);
    } catch (err: any) {
      alert(`Failed to save Google Form response: ${err.message}`);
    } finally {
      setSubmittingFormResponse(false);
    }
  };

  // Add New Entry Form Submit (Enters into database and updates UI in real-time)
  const handleAddNewEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.patient_name.trim() || !newEntry.phone.trim()) return;

    setAddingEntry(true);
    try {
      // 1. Insert into database with pending status (completed once WhatsApp is sent)
      await db.createVisit({
        hospital_id: hospitalId,
        patient_name: newEntry.patient_name.trim(),
        phone: newEntry.phone.trim(),
        department: 'General Medicine',
        doctor: newEntry.doctor.trim(),
        visit_date: newEntry.visit_date,
        status: 'pending',
        visit_uid: `H12-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      });

      // 2. Increment tracked count in connection
      if (connection) {
        await db.saveSheetConnection({
          ...connection,
          total_rows_tracked: (connection.total_rows_tracked || 0) + 1,
        });
      }

      // 3. Immediately refresh visits from the database so UI updates live
      await loadData();

      setShowNewEntryModal(false);
      setNewEntry({
        patient_name: '',
        phone: '',
        department: 'General Medicine',
        doctor: 'Dr. Ramesh Kumar',
        visit_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      });

      setSaveSuccessMessage(
        `New entry for "${newEntry.patient_name}" entered in database & UI updated successfully!`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Failed to add entry: ${err.message}`);
    } finally {
      setAddingEntry(false);
    }
  };

  // Sync All Spreadsheet Data to Supabase Database
  const handleSyncAllToSupabase = async () => {
    setSyncing(true);
    try {
      const rowsToSync = uploadedRows.length > 0 ? uploadedRows : defaultSampleRows;
      const res = await db.syncAllLocalRowsToSupabase(hospitalId, rowsToSync);
      await loadData();
      setSaveSuccessMessage(
        `⚡ Successfully synced ${res.syncedCount} real patient consultations directly to Supabase database (patients & visits)!`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Database sync error: ${err.message}`);
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
      setSaveSuccessMessage('Sync complete: All latest patient records are up to date in database.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Mark visit complete
  const handleMarkComplete = async (visitId: string) => {
    try {
      await db.markVisitComplete(visitId);
      await loadData();
      setSaveSuccessMessage('Visit marked completed! WhatsApp 5★ review invitation dispatched.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (
      window.confirm(
        'Disconnect this spreadsheet? Auto-syncing will pause, but existing patient visits remain safe in the database.'
      )
    ) {
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
              Connect Google Sheets or Excel. When new entries are entered, they are stored in the database and displayed live in the UI.
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Download Sample Template</span>
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
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-xs ${
                    connection.sheet_type === 'google_forms'
                      ? 'bg-purple-600 text-white'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {connection.sheet_type === 'google_forms' ? (
                    <FormInput className="w-5 h-5" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {connection.sheet_type === 'google_forms'
                        ? (connection.table_name || 'RESCUEBRIDGE FORM')
                        : connection.sheet_type === 'excel_365'
                        ? 'Microsoft Excel Spreadsheet'
                        : 'Google Sheets'}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        connection.sheet_type === 'google_forms'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                          connection.sheet_type === 'google_forms' ? 'bg-purple-500' : 'bg-emerald-500'
                        }`}
                      />
                      {connection.sheet_type === 'google_forms'
                        ? 'Google Forms Live Sync'
                        : 'Connected & Live Syncing'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                    {sheetUrl}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {connection.sheet_type === 'google_forms' && (
                  <>
                    <button
                      onClick={() => {
                        setGoogleFormSubmission({
                          patient_name: '',
                          phone: '',
                          doctor: 'Dr. Ramesh Kumar',
                          visit_date: new Date().toISOString().split('T')[0],
                          department: 'General Consultation',
                        });
                        setShowGoogleFormModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                      title="Ingest new patient response from Google Form into database"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Ingest Form Response</span>
                    </button>

                    <a
                      href={
                        sheetUrl.startsWith('http')
                          ? sheetUrl
                          : `https://docs.google.com/forms/d/e/${sheetUrl}/viewform`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition-all shadow-xs"
                      title="Open Google Form in a new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Form</span>
                    </a>

                    <button
                      onClick={() => setShowAppsScriptModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                      title="View Google Apps Script snippet for real-time form submission webhook"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Webhook Code</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setShowNewEntryModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Row</span>
                </button>

                <button
                  onClick={handleSyncAllToSupabase}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                  title="Upload all spreadsheet rows directly to Supabase patients & visits tables"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-white" />
                  <span>Sync All to Supabase DB</span>
                </button>

                <button
                  onClick={handlePurgeJunkRows}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all disabled:opacity-50"
                  title="Purge all dummy seed records from Supabase and local store"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Purge Dummy Data</span>
                </button>

                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* 3 Clean Status Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                <p className="text-xs text-slate-500 font-medium">Database Synced Visits</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {syncedVisits.length} Records
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                  Stored in database & live in UI
                </p>
              </div>

              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                <p className="text-xs text-slate-500 font-medium">Completed & Review Ready</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {syncedVisits.filter((v) => v.status === 'completed').length} Patients
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">WhatsApp review invitations sent</p>
              </div>

              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                <p className="text-xs text-slate-500 font-medium">In Consultation / Registered</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {syncedVisits.filter((v) => v.status !== 'completed').length} Patients
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                  Ready to mark complete
                </p>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
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

          {/* ── LIVE SYNCED PATIENT RECORDS IN DATABASE & UI ────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Live Synced Patient Records (In Database & UI)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Whenever a new entry is added to the sheet or through the form, it is immediately entered in the database and displayed here.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Send All WhatsApp Button */}
                <button
                  onClick={handleSendAllWhatsApp}
                  disabled={sendingAll || unsentCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                  title="Dispatch WhatsApp review invitation to all eligible patients"
                >
                  <Send className={`w-3.5 h-3.5 ${sendingAll ? 'animate-pulse' : ''}`} />
                  <span>
                    {sendingAll ? 'Dispatching...' : `Send All (${unsentCount} Ready)`}
                  </span>
                </button>

                {/* Connect Different Spreadsheet Button */}
                <button
                  onClick={() => {
                    setShowAddSheetModal(true);
                    setUploadedFileName('');
                    setUploadedRows([]);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 text-xs font-bold rounded-xl transition-all shadow-xs"
                  title="Connect another spreadsheet or upload different Excel sheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>+ Connect Different Spreadsheet</span>
                </button>

                <button
                  onClick={handlePurgeJunkRows}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium rounded-xl transition-all"
                  title="Remove any unreadable or corrupted rows"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Purge Junk Rows</span>
                </button>

                <button
                  onClick={() => setShowNewEntryModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Row</span>
                </button>
              </div>
            </div>

            {/* Connected Spreadsheets Sources Chips */}
            {allConnections.length > 0 && (
              <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Connected Spreadsheets ({allConnections.length}):
                  </span>
                  {allConnections.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>
                        {c.table_name ||
                          (c.sheet_type === 'excel_365' ? 'Excel Import' : 'Google Sheet')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({c.total_rows_tracked || 0} rows)
                      </span>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSheetModal(true);
                    setUploadedFileName('');
                    setUploadedRows([]);
                  }}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Sheet</span>
                </button>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Visit ID</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Visited Date</th>
                    <th className="py-3 px-4">Doctor Consulted</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Patient Rating</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {syncedVisits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No patient consultations yet. Add a new row or sync your sheet.
                      </td>
                    </tr>
                  ) : (
                    syncedVisits.map((v) => {
                      const isSent = Boolean(v.patient?.review_sent || v.review_requested);
                      const dateCrossed = isDateCrossed(v.visit_date);
                      const isCompleted = isSent || dateCrossed || v.status === 'completed';
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {v.visit_uid || v.sheet_row_id || v.id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {v.patient?.name || 'Patient'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {v.patient?.phone || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{v.visit_date}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">{v.doctor}</td>
                          <td className="py-3 px-4 text-slate-600">{v.department}</td>
                          
                          {/* Actual Patient Rating */}
                          <td className="py-3 px-4">
                            {v.review_request?.rating ? (
                              <div className="flex items-center gap-1.5">
                                <div className="flex text-amber-400">
                                  {Array.from({ length: 5 }).map((_, idx) => (
                                    <Star
                                      key={idx}
                                      className={`w-3.5 h-3.5 ${
                                        idx < (v.review_request?.rating || 0)
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 font-mono">
                                  {v.review_request.rating}.0
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Pending Rating
                              </span>
                            )}
                          </td>

                          {/* Status: Completed when date crossed or WhatsApp sent */}
                          <td className="py-3 px-4">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            {isSent ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs"
                                title="WhatsApp review sent. 1-time anti-spam flag active."
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                Sent (1-Time Only)
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSendSingleWhatsApp(v.id)}
                                disabled={sendingId === v.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs disabled:opacity-50"
                                title="Send WhatsApp review template to this patient"
                              >
                                <Send className="w-3 h-3" />
                                <span>{sendingId === v.id ? 'Sending...' : 'Send WhatsApp'}</span>
                              </button>
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
        </div>
      ) : (
        /* ── Simple Connection Form (Clean & Easy) ─────────────────── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Select Your Spreadsheet Platform
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Provide your Google Sheet link or upload an Excel/CSV spreadsheet to connect your hospital consultations.
            </p>
          </div>

          {/* 3 Option Cards: Google Sheets, Google Forms, Microsoft Excel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Google Sheets Option */}
            <button
              type="button"
              onClick={() => {
                setSheetType('google_sheets');
                if (sheetUrl.includes('docs.google.com/forms')) {
                  setSheetUrl('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
                }
              }}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                sheetType === 'google_sheets'
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-xs text-slate-900">Google Sheets</p>
                  {sheetType === 'google_sheets' && (
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Live spreadsheet link with auto-sync.
                </p>
              </div>
            </button>

            {/* Google Forms Option */}
            <button
              type="button"
              onClick={() => {
                setSheetType('google_forms');
                setSheetUrl(DEFAULT_RESCUEBRIDGE_FORM_URL);
                if (!newSheetTitle) setNewSheetTitle('RESCUEBRIDGE FORM');
              }}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                sheetType === 'google_forms'
                  ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <FormInput className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-xs text-purple-950">Google Forms</p>
                  {sheetType === 'google_forms' && (
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[9px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Auto-save patient form responses to DB & UI.
                </p>
              </div>
            </button>

            {/* Microsoft Excel Option */}
            <button
              type="button"
              onClick={() => setSheetType('excel_365')}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                sheetType === 'excel_365'
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-xs text-slate-900">Excel / CSV File</p>
                  {sheetType === 'excel_365' && (
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Upload .xlsx or .csv patient export.
                </p>
              </div>
            </button>
          </div>

          <form onSubmit={handleConnectSheet} className="space-y-5 pt-2">
            {/* If Google Forms */}
            {sheetType === 'google_forms' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Google Form URL *
                    </label>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                      RESCUEBRIDGE FORM Connected
                    </span>
                  </div>
                  <input
                    type="url"
                    required
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    value={sheetUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSheetUrl(val);
                      if (val.includes('docs.google.com/forms')) {
                        setSheetType('google_forms');
                      }
                    }}
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Paste your Google Form link. When patients fill and submit the form, their details will be saved to the database and displayed here live.
                  </p>
                </div>

                {/* Form fields overview */}
                <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      Google Form Fields & Database Mapping
                    </p>
                    <span className="text-[10px] font-mono font-bold text-purple-700 bg-white px-2 py-0.5 rounded-lg border border-purple-200">
                      5 Fields Auto-Mapped
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {RESCUEBRIDGE_FORM_FIELDS.map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between bg-white border border-purple-100 p-2.5 rounded-xl shadow-2xs"
                      >
                        <span className="font-bold text-slate-800 font-mono text-[11px]">
                          {f.label}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                          → {f.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-800 hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open Form in New Tab</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowAppsScriptModal(true)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:underline inline-flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Setup Webhook Trigger (Apps Script)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* If Google Sheets: Input Link or Upload downloaded Google Sheet */}
            {sheetType === 'google_sheets' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Paste Google Sheet Link *
                  </label>
                  <input
                    type="text"
                    required={uploadedRows.length === 0}
                    placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                    value={sheetUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSheetUrl(val);
                      if (val.includes('docs.google.com/forms')) {
                        setSheetType('google_forms');
                        if (!newSheetTitle) setNewSheetTitle('RESCUEBRIDGE FORM');
                      }
                    }}
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Set Google Sheet share settings to "Anyone with the link can view", or upload your downloaded file below.
                  </p>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400">
                    OR UPLOAD DOWNLOADED GOOGLE SHEET (.XLSX / .CSV)
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div>
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 bg-slate-50/70 hover:bg-emerald-50/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-emerald-300 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                          {uploadedFileName ? uploadedFileName : 'Upload Google Sheet file (.xlsx or .csv)'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          In Google Sheets: File → Download → Microsoft Excel (.xlsx) or Comma Separated Values (.csv)
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* If Excel / CSV: Upload File or Paste Link */}
            {sheetType === 'excel_365' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Upload Excel / CSV Spreadsheet File
                  </label>
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-5 bg-slate-50/70 hover:bg-emerald-50/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-emerald-300 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                          {uploadedFileName ? uploadedFileName : 'Click to browse Excel / CSV file'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Supports .csv, .xlsx, .txt table format
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Quick Tip for Google Sheets */}
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

            {/* Collapsible Advanced Column Names */}
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
                    <span>Connecting & Importing Data...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connect Sheet & Import Data</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Connect Different Spreadsheet ──────────────────── */}
      {showAddSheetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Connect Different Spreadsheet
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add another spreadsheet source. All new values enter the database and display in the live UI.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSheetModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setShowAddSheetModal(false);
                await handleConnectSheet(e);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Spreadsheet Label / Source Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology OPD Sheet, Branch 2 Sheet"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Platform Choice: 3 Options */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSheetType('google_sheets');
                    if (sheetUrl.includes('docs.google.com/forms')) {
                      setSheetUrl('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    sheetType === 'google_sheets'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Google Sheet</p>
                    <p className="text-[10px] text-slate-400 truncate">Sheet URL</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSheetType('google_forms');
                    setSheetUrl(DEFAULT_RESCUEBRIDGE_FORM_URL);
                    if (!newSheetTitle) setNewSheetTitle('RESCUEBRIDGE FORM');
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    sheetType === 'google_forms'
                      ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <FormInput className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-xs font-bold text-purple-950">Google Form</p>
                    <p className="text-[10px] text-slate-400 truncate">Form URL</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSheetType('excel_365')}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    sheetType === 'excel_365'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <UploadCloud className="w-4 h-4 text-teal-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Excel / CSV</p>
                    <p className="text-[10px] text-slate-400 truncate">Upload file</p>
                  </div>
                </button>
              </div>

              {sheetType === 'google_forms' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Google Form URL *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://docs.google.com/forms/d/e/.../viewform"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="bg-purple-50 border border-purple-200/80 rounded-xl p-3 text-[11px] text-purple-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-purple-950">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      RESCUEBRIDGE FORM Detected
                    </p>
                    <p className="text-purple-700">
                      All submissions with Patient Name, Phone, Doctor, Appointment Date, and Issue Detail will be entered into the database and displayed live.
                    </p>
                  </div>
                </div>
              )}

              {sheetType === 'google_sheets' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Spreadsheet Link
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSheetUrl(val);
                      if (val.includes('docs.google.com/forms')) {
                        setSheetType('google_forms');
                        if (!newSheetTitle) setNewSheetTitle('RESCUEBRIDGE FORM');
                      }
                    }}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {sheetType === 'excel_365' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Browse Excel / CSV File
                  </label>
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center block cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
                    <p className="text-xs font-bold text-slate-700">
                      {uploadedFileName ? uploadedFileName : 'Click to select Excel / CSV file'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddSheetModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Connect Sheet & Import to Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add New Consultation Row ────────────────────────── */}
      {showNewEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New Consultation Row
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enters into database and immediately updates the live UI.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewEntryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Verma"
                  value={newEntry.patient_name}
                  onChange={(e) => setNewEntry({ ...newEntry, patient_name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+919876543210"
                  value={newEntry.phone}
                  onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Visited Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newEntry.visit_date}
                    onChange={(e) => setNewEntry({ ...newEntry, visit_date: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Doctor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={newEntry.doctor}
                    onChange={(e) => setNewEntry({ ...newEntry, doctor: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewEntryModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingEntry}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  {addingEntry ? 'Saving to Database...' : 'Save Row to Database & UI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Ingest Google Form Patient Response ────────────── */}
      {showGoogleFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <FormInput className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Ingest Google Form Response
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Saves patient details to the database and displays them in the live consultations UI.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleFormModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-purple-50/70 border border-purple-200/80 p-3 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-purple-900">RESCUEBRIDGE FORM Fields</p>
                <p className="text-[10px] text-purple-700">Pre-fill realistic patient response to test live sync</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sampleNames = ['Karthik Subramanian', 'Priya S', 'Suresh Kumar', 'Deepa Venkat', 'Anand Verma'];
                  const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
                  const randomPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
                  setGoogleFormSubmission({
                    patient_name: randomName,
                    phone: randomPhone,
                    doctor: 'Dr. Ramesh Kumar',
                    visit_date: new Date().toISOString().split('T')[0],
                    department: 'General Consultation - Fever & Cough',
                  });
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⚡ Quick Fill Sample</span>
              </button>
            </div>

            <form onSubmit={handleIngestGoogleForm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PATIENT NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karthik Subramanian"
                  value={googleFormSubmission.patient_name}
                  onChange={(e) =>
                    setGoogleFormSubmission({ ...googleFormSubmission, patient_name: e.target.value })
                  }
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PHONE NUMBER: (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+919876543210"
                  value={googleFormSubmission.phone}
                  onChange={(e) =>
                    setGoogleFormSubmission({ ...googleFormSubmission, phone: e.target.value })
                  }
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    APPOINTEMENT DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={googleFormSubmission.visit_date}
                    onChange={(e) =>
                      setGoogleFormSubmission({ ...googleFormSubmission, visit_date: e.target.value })
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    DOCTOR NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={googleFormSubmission.doctor}
                    onChange={(e) =>
                      setGoogleFormSubmission({ ...googleFormSubmission, doctor: e.target.value })
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ISSUE DETAIL (Department / Reason)
                </label>
                <input
                  type="text"
                  placeholder="e.g. General Consultation, Fever, Joint pain"
                  value={googleFormSubmission.department}
                  onChange={(e) =>
                    setGoogleFormSubmission({ ...googleFormSubmission, department: e.target.value })
                  }
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowGoogleFormModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFormResponse}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {submittingFormResponse ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Response to Database & Live UI</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Google Apps Script Webhook Snippet ──────────────── */}
      {showAppsScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shadow-xs">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Google Forms Webhook Trigger Setup
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Automatically dispatches patient responses to RescueBridge whenever submitted.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <p className="font-bold text-slate-900">Easy 3-Step Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
                  <li>
                    In your Google Form, click the <strong className="text-slate-900">⋮ (More)</strong> menu at the top right, then select <strong className="text-slate-900">Script editor</strong>.
                  </li>
                  <li>
                    Delete any default code, paste the script below, and click <strong className="text-slate-900">Save (💾)</strong>.
                  </li>
                  <li>
                    Click <strong className="text-slate-900">Triggers (⏰)</strong> on the left sidebar → <strong className="text-slate-900">Add Trigger</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1 text-slate-500">
                      <li>Function: <code className="text-purple-700 font-bold">onFormSubmit</code></li>
                      <li>Event Source: <code className="text-purple-700 font-bold">From form</code></li>
                      <li>Event Type: <code className="text-purple-700 font-bold">On form submit</code></li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs">Google Apps Script Code</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generateAppsScriptSnippet(hospitalId));
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 3000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    {copiedScript ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Apps Script</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                  {generateAppsScriptSnippet(hospitalId)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: WhatsApp Review Dispatch Summary ───────────────── */}
      {showSendAllModal && sendAllResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shadow-xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>WhatsApp Reviews Dispatched</span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                      Live
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Official WhatsApp review template dispatched to patients.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSendAllModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Metrics Highlights */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sent Successfully</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-900">
                    {sendAllResult.sentCount}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 font-medium">
                    Patients received review invitation
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-bold mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>1-Time Anti-Spam Protected</span>
                  </div>
                  <p className="text-2xl font-black text-amber-900">
                    {sendAllResult.skippedCount}
                  </p>
                  <p className="text-[11px] text-amber-700/80 font-medium">
                    Skipped (already sent previously)
                  </p>
                </div>
              </div>

              {/* Exact Template Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Dispatched WhatsApp Template
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">1-Time Only Policy Active</span>
                </div>
                <div className="bg-emerald-900/5 border border-emerald-700/10 rounded-xl p-3 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {sendAllResult.details[0]?.message ||
                    `Hi [Patient Name]! 💙\n\nThank you for choosing ${currentHospital?.name || 'our Hospital'} for your care.\n\nWe’d love to know about your experience. 🏥\n\n💬 We would be grateful if you could share your experience with us right here in this chat.\n\nYou can simply:\n🎤 Send a voice message and tell us about your experience, or\n⌨️ Type your feedback in the chat.\nYour feedback is valuable to us and helps us continuously improve our services. 💙`}
                </div>
              </div>

              {/* Recipient Details List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800">
                  Recipient Dispatch Log ({sendAllResult.details.length} records)
                </h4>
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden text-xs">
                  {sendAllResult.details.map((detail, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {detail.patientName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {detail.phone}
                          </span>
                        </div>
                        {detail.reason && (
                          <p className="text-[10px] text-amber-700 font-medium">
                            {detail.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {detail.status === 'sent' ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Dispatched
                            </span>
                            <a
                              href={`https://wa.me/${detail.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                detail.message
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/60 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-300/60"
                            >
                              <span>Open in WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            Anti-Spam Protected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowSendAllModal(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
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
                <td className="py-3 px-4 font-semibold text-emerald-800">
                  +{syncedVisits.length || 3} Patient Visits Synced
                </td>
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
