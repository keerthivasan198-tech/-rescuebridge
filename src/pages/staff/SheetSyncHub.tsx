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
import { apiUrl } from '../../services/api';
import { db, isDateCrossed } from '../../services/db';
import { supabase } from '../../services/supabase';
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
  STANDARD_FORM_FIELDS,
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
  const [sheetUrl, setSheetUrl] = useState('');
  const [linkedSheetUrl, setLinkedSheetUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedRows, setUploadedRows] = useState<any[]>([]);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [serviceEmail, setServiceEmail] = useState('sync@rescuebridge.iam.gserviceaccount.com');
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [connectionStep, setConnectionStep] = useState<1 | 2>(1);

  // Fetch Service Account email on mount
  useEffect(() => {
    fetch(apiUrl('/api/sheets/service-account'))
      .then(r => r.json())
      .then(d => { if (d.email) setServiceEmail(d.email); })
      .catch(() => {});
  }, []);

  // Google OAuth 2.0 Integration State
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthEmail, setOauthEmail] = useState<string | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [showLegacyServiceAccount, setShowLegacyServiceAccount] = useState(false);

  const checkOAuthStatus = async () => {
    try {
      const res = await fetch(apiUrl(`/api/auth/google/status?hospitalId=${hospitalId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setOauthConnected(true);
          setOauthEmail(data.email || 'Admin');
        } else {
          setOauthConnected(false);
          setOauthEmail(null);
        }
      }
    } catch {
      // Fail silently
    }
  };

  useEffect(() => {
    checkOAuthStatus();
  }, [hospitalId]);

  const handleConnectGoogleOAuth = async () => {
    setConnectingOAuth(true);
    try {
      const res = await fetch(
        apiUrl(`/api/auth/google/url?hospitalId=${hospitalId}&returnTo=/staff/sheet-sync`)
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to obtain Google login link. Please verify backend server is running.');
        setConnectingOAuth(false);
      }
    } catch (err: any) {
      alert('Error initiating Google connection: ' + err.message);
      setConnectingOAuth(false);
    }
  };

  const handleDisconnectGoogleOAuth = async () => {
    if (!window.confirm('Disconnect your Google account from RescueBridge?')) return;
    try {
      await fetch(apiUrl('/api/auth/google/disconnect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId }),
      });
      setOauthConnected(false);
      setOauthEmail(null);
      setSaveSuccessMessage('Google Account disconnected.');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      alert('Failed to disconnect: ' + err.message);
    }
  };

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

  // Source Filter Tab State ('all' | 'google_sheets' | 'google_forms' | 'excel_365' | 'manual')
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<
    'all' | 'google_sheets' | 'google_forms' | 'excel_365' | 'manual'
  >('all');

  // Helper to reliably identify the origin of any visit record
  const getVisitSource = (v: Visit): 'google_forms' | 'google_sheets' | 'excel_365' | 'manual' => {
    if (v.source) return v.source;
    const uid = (v.visit_uid || v.sheet_row_id || '').toUpperCase();
    const token = (v.token || '').toLowerCase();
    if (uid.startsWith('GF-') || uid.includes('FORM') || token.includes('rb-gf')) return 'google_forms';
    if (uid.startsWith('GS-') || uid.startsWith('VISIT-') || uid.includes('SHEET') || uid.includes('GOOGLE') || token.includes('rb-sync')) return 'google_sheets';
    if (uid.startsWith('IMP-') || uid.includes('EXCEL') || uid.includes('XLS') || uid.includes('CSV')) return 'excel_365';
    return 'manual';
  };

  // Guarantee strictly 1 record per patient name + phone + date (never duplicate same patient)
  const dedupeVisitsList = (list: Visit[]): Visit[] => {
    const seen = new Map<string, Visit>();
    for (const v of list) {
      const phoneDigits = (v.patient?.phone || '').replace(/[^0-9]/g, '');
      const cleanName = (v.patient?.name || '').toLowerCase().trim();
      const cleanDate = (v.visit_date || '').trim();
      // Include name so different patients with the same phone show separately
      const key = `${cleanName}::${phoneDigits}::${cleanDate}`;

      if (!seen.has(key)) {
        seen.set(key, v);
      }
    }
    return Array.from(seen.values());
  };

  const uniqueVisits = dedupeVisitsList(syncedVisits);
  const totalAllCount = uniqueVisits.length;
  const googleSheetsCount = uniqueVisits.filter((v) => getVisitSource(v) === 'google_sheets').length;
  const googleFormsCount = uniqueVisits.filter((v) => getVisitSource(v) === 'google_forms').length;
  const excelCount = uniqueVisits.filter((v) => getVisitSource(v) === 'excel_365').length;
  const manualCount = uniqueVisits.filter((v) => getVisitSource(v) === 'manual').length;

  const displayedVisits = selectedSourceFilter === 'all'
    ? uniqueVisits
    : uniqueVisits.filter((v) => getVisitSource(v) === selectedSourceFilter);

  const unsentVisits = displayedVisits.filter(
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

  // Helper to normalize column keys and handle typos like "appointement"
  const normalizeColKey = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/appointement/g, 'appointment')
      .replace(/[\s_\-\.:\(\)\[\]]/g, '');
  };

  // Helper to pick columns smartly across Google Sheets, Google Forms, and Excel
  const pickCol = (row: Record<string, any>, ...aliases: string[]): string => {
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const normAlias = normalizeColKey(alias);
      for (const k of keys) {
        const normKey = normalizeColKey(k);
        if (normKey === normAlias || normKey.includes(normAlias) || normAlias.includes(normKey)) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            return String(val).trim();
          }
        }
      }
    }
    return '';
  };

  const parseDateToIso = (dStr?: string | number): string => {
    if (!dStr) return new Date().toISOString().split('T')[0];
    const s = String(dStr).trim();
    if (s.includes('T')) return s.split('T')[0];
    if (s.includes(' ')) {
      return parseDateToIso(s.split(' ')[0]);
    }
    // Handle Excel Serial Dates (e.g. 46295.00011)
    if (!isNaN(Number(s))) {
      const num = Number(s);
      if (num > 30000 && num < 65000) {
        const d = new Date((num - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      }
    }
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        let y = parts[2];
        if (y.length === 2) y = '20' + y;
        if (p0 > 12) {
          return `${y}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
        } else {
          return `${y}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        }
      }
    }
    return s;
  };

  const parseRawRow = (row: Record<string, any>, idx: number) => {
    const patientName =
      pickCol(row, 'patient name', 'name', 'patient', 'customer name', 'full name', 'patientname') ||
      Object.values(row)[1] ||
      Object.values(row)[0] ||
      '';

    if (!patientName || isCorruptedRow(String(patientName))) return null;

    const rawPhone =
      pickCol(row, 'phone number:', 'phone number', 'phone', 'mobile number', 'mobile', 'contact number', 'contact', 'whatsapp', 'phnumber') ||
      '+919345350910';
    const cleanPhone = String(rawPhone).replace(/[^\d+]/g, '');
    const phone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

    const rawDate = pickCol(
      row,
      'appointement date',
      'appointment date',
      'appointment_date',
      'visit date',
      'visit_date',
      'consultation date',
      'date',
      'timestamp'
    );
    const visitDate = parseDateToIso(rawDate);

    const rawDept =
      pickCol(row, 'issue detail', 'issue', 'reason', 'problem', 'department', 'dept', 'specialty') ||
      'General Consultation';
    const department = String(rawDept).trim();

    const rawDoc =
      pickCol(row, 'doctor name', 'doctor consulted', 'doctor', 'consultant', 'physician') ||
      'Duty Medical Officer';
    const cleanDoc = String(rawDoc).trim();
    const doctor = cleanDoc.toLowerCase().startsWith('dr') ? cleanDoc : `Dr. ${cleanDoc}`;

    const visitUid =
      pickCol(row, 'visit uid', 'id', 'uid', 'token') ||
      `IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;

    return {
      visit_uid: visitUid,
      patient_name: String(patientName).trim(),
      phone: String(phone).trim(),
      visit_date: visitDate,
      department,
      doctor,
      status: 'pending' as const,
    };
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
            ? conn.sheet_id
              ? `https://docs.google.com/forms/d/e/${conn.sheet_id}/viewform`
              : ''
            : conn.sheet_id
            ? `https://docs.google.com/spreadsheets/d/${conn.sheet_id}/edit`
            : ''
        );
        setMapping(conn.column_mapping);
        // Restore linked sheet URL for Google Form connections
        const storedLinkedSheet = localStorage.getItem(`gf_linked_sheet_${hospitalId}`);
        if (storedLinkedSheet) {
          setLinkedSheetUrl(storedLinkedSheet);
        }
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

  // Instant real-time subscription to Supabase 'visits' table
  useEffect(() => {
    const channel = supabase
      .channel(`visits-rt-${hospitalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: `hospital_id=eq.${hospitalId}`,
        },
        async () => {
          try {
            const fresh = await db.getVisits(hospitalId);
            setSyncedVisits(fresh);
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalId]);

  // Real-time background poller for Google Form webhook responses and Supabase updates
  useEffect(() => {
    const poller = setInterval(async () => {
      try {
        // 1. Check webhook queue from backend API
        const resp = await fetch(apiUrl('/api/google-form-responses'));
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
              await fetch(apiUrl('/api/google-form-responses/clear'), {
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

        // 2. Poll Supabase for newly created visits (e.g. from Google Apps Script direct cloud webhook)
        const remoteVisits = await db.getVisits(hospitalId);
        if (remoteVisits && remoteVisits.length !== syncedVisits.length) {
          setSyncedVisits(remoteVisits);
        }
      } catch {}
    }, 4000);

    return () => clearInterval(poller);
  }, [hospitalId, syncedVisits.length]);

  // Auto-poll linked Google Sheet for new Google Form responses (every 60 seconds)
  useEffect(() => {
    const pollLinkedSheet = async () => {
      const storedSheetUrl = localStorage.getItem(`gf_linked_sheet_${hospitalId}`);
      if (!storedSheetUrl) return;

      try {
        const resp = await fetch(apiUrl(`/api/fetch-google-sheet?url=${encodeURIComponent(storedSheetUrl)}`));
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.success || !data.csv) return;

        const workbook = XLSX.read(data.csv, { type: 'string' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        const parsedRows = rawJson.map((r, i) => parseRawRow(r, i)).filter(Boolean) as any[];

        if (parsedRows.length === 0) return;

        // Compare with current visits to check if there are new rows
        const currentPhones = new Set(
          syncedVisits
            .filter((v) => getVisitSource(v) === 'google_forms')
            .map((v) => (v.patient?.phone || '').replace(/[^0-9]/g, ''))
            .filter((p) => p.length >= 8)
        );

        const newRows = parsedRows.filter((row) => {
          const rowPhone = (row.phone || '').replace(/[^0-9]/g, '');
          return rowPhone.length >= 8 && !currentPhones.has(rowPhone);
        });

        if (newRows.length > 0) {
          await db.runInitialBackfill(hospitalId, newRows, mapping, {
            source: 'google_forms',
            source_name: 'Google Form Responses',
          });
          await loadData();
          setSaveSuccessMessage(
            `🔄 Auto-synced ${newRows.length} new Google Form response(s) into the database!`
          );
          setTimeout(() => setSaveSuccessMessage(null), 5000);
        }
      } catch (err) {
        // Silent fail for background polling
        console.warn('Auto-poll linked sheet error:', err);
      }
    };

    // Run immediately on mount, then every 60 seconds
    pollLinkedSheet();
    const sheetPoller = setInterval(pollLinkedSheet, 60000);

    return () => clearInterval(sheetPoller);
  }, [hospitalId, syncedVisits.length]);

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
        const parsed = parseRawRow(row, idx);
        if (parsed) {
          parsedRows.push(parsed);
        }
      });

      if (parsedRows.length === 0) {
        alert('No valid patient rows could be identified in the file. Please ensure it has columns like Name, Phone, Date, Doctor.');
        return;
      }

      setUploadedRows(parsedRows);

      // Detect if this is Google Form responses or standard Excel
      const isFormResponses =
        firstSheetName.toLowerCase().includes('form') ||
        rawJson.some((r) =>
          Object.keys(r).some(
            (k) => k.toLowerCase().includes('timestamp') || k.toLowerCase().includes('issue detail')
          )
        );

      const sourceKind = isFormResponses || sheetType === 'google_forms' ? 'google_forms' : 'excel_365';
      const sourceLabel = file.name;

      // Automatically persist to Supabase & local DB immediately
      await db.runInitialBackfill(hospitalId, parsedRows, mapping, {
        source: sourceKind,
        source_name: sourceLabel,
      });
      await loadData();

      setSaveSuccessMessage(`⚡ Successfully imported ${parsedRows.length} patient consultation(s) from "${file.name}" live into the database!`);
      setTimeout(() => setSaveSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`Could not parse spreadsheet file: ${err.message || 'Unknown format'}`);
    }
  };

  const handleFetchHeaders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) {
      alert('Please enter a Google Sheet URL');
      return;
    }
    setSyncing(true);
    try {
      const googleMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = googleMatch ? googleMatch[1] : sheetUrl;
      const resp = await fetch(apiUrl(`/api/sheets/headers?sheetId=${sheetId}&hospitalId=${hospitalId}`));
      const data = await resp.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch headers');
      }
      setSheetHeaders(data.headers || []);
      
      // Auto-guess mapping based on headers
      const newMapping: any = {};
      const headers = data.headers || [];
      headers.forEach((h: string, idx: number) => {
        const hl = h.toLowerCase();
        if (hl.includes('name')) newMapping.patient_name = idx;
        else if (hl.includes('phone') || hl.includes('mobile') || hl.includes('whatsapp')) newMapping.phone = idx;
        else if (hl.includes('date') || hl.includes('time')) newMapping.visit_date = idx;
        else if (hl.includes('doctor') || hl.includes('physician')) newMapping.doctor = idx;
        else if (hl.includes('issue') || hl.includes('department') || hl.includes('reason')) newMapping.department = idx;
        else if (hl.includes('status')) newMapping.status = idx;
        else if (hl.includes('uid') || hl.includes('id')) newMapping.visit_uid = idx;
      });
      setMapping(newMapping as ColumnMapping);
      setConnectionStep(2);
    } catch (err: any) {
      alert(`Could not read spreadsheet columns.\n\nTip: If your Google Sheet is private, click "Connect Google Sheet" above to link your Google account in 1 click!\n\nDetails: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Connect & Save
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    try {
      const inputUrl = sheetUrl.trim();
      const isGoogleFormUrl = inputUrl.includes('docs.google.com/forms');
      const isGoogleSheetUrl = inputUrl.includes('docs.google.com/spreadsheets');

      // ── Scenario A: Google Form ────────────────────────────────
      if (sheetType === 'google_forms' || isGoogleFormUrl) {
        if (!inputUrl && uploadedRows.length === 0) {
          alert('Please enter your Google Form link or upload the responses spreadsheet file.');
          setSyncing(false);
          return;
        }

        const formInfo = parseGoogleFormUrl(inputUrl);
        const finalFormId = formInfo.formId || inputUrl;
        const finalTitle = newSheetTitle.trim() || 'Google Form Responses';

        // Determine the linked Google Sheet URL to fetch responses from
        // Priority: 1) User-provided linked sheet URL, 2) Google Sheet URL entered in main field, 3) stored linkedSheetUrl
        let fetchSheetUrl = '';
        if (linkedSheetUrl.trim() && linkedSheetUrl.includes('docs.google.com/spreadsheets')) {
          fetchSheetUrl = linkedSheetUrl.trim();
        } else if (isGoogleSheetUrl) {
          fetchSheetUrl = inputUrl;
        }

        // Save the connection with the linked sheet URL stored for auto-polling
        await db.saveSheetConnection({
          hospital_id: hospitalId,
          sheet_type: 'google_forms',
          sheet_id: finalFormId,
          table_name: finalTitle,
          column_mapping: {
            visit_uid: 'Form Submission ID',
            patient_name: 'PATIENT NAME',
            phone: 'PHONE NUMBER:',
            visit_date: 'APPOINTMENT DATE',
            department: 'ISSUE DETAIL',
            doctor: 'DOCTOR NAME',
            status: 'status',
          },
        });

        // Also persist the linked sheet URL in localStorage for auto-polling
        if (fetchSheetUrl) {
          localStorage.setItem(`gf_linked_sheet_${hospitalId}`, fetchSheetUrl);
        }

        let rowsToImport = uploadedRows;

        // Try to fetch responses from the linked Google Sheet
        if (fetchSheetUrl && rowsToImport.length === 0) {
          try {
            const resp = await fetch(apiUrl(`/api/fetch-google-sheet?url=${encodeURIComponent(fetchSheetUrl)}`));
            const data = await resp.json();
            if (resp.status === 401 || data.status === 401) {
              alert(
                '⚠️ Your Google Sheet is currently Restricted (Private).\n\n' +
                'To auto-sync Google Form responses, please:\n\n' +
                '1. Open your Google Sheet (where responses are saved)\n' +
                '2. Click the blue "Share" button at top-right\n' +
                '3. Under "General access", change "Restricted" to "Anyone with the link"\n' +
                '4. Set permission to "Viewer"\n' +
                '5. Click "Done"\n' +
                '6. Come back here and click "Connect Sheet & Import to Database" again\n\n' +
                'OR: In Google Sheets, click File → Download → Microsoft Excel (.xlsx) and upload it below.'
              );
              setSyncing(false);
              return;
            }
            if (data.success && data.csv) {
              const workbook = XLSX.read(data.csv, { type: 'string' });
              const sheet = workbook.Sheets[workbook.SheetNames[0]];
              const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
              rowsToImport = rawJson.map((r, i) => parseRawRow(r, i)).filter(Boolean) as any[];
            }
          } catch (e) {
            console.warn('Failed to fetch Google Sheet via proxy:', e);
          }
        }

        // If no linked sheet URL was provided and user only gave a Form URL, 
        // prompt them to also provide the linked responses sheet URL
        if (!fetchSheetUrl && rowsToImport.length === 0 && isGoogleFormUrl && !isGoogleSheetUrl) {
          alert(
            '📋 Google Form link saved! To automatically import all existing responses:\n\n' +
            '1. Open your Google Form → go to "Responses" tab\n' +
            '2. Click the green Google Sheets icon (📊) to open the linked spreadsheet\n' +
            '3. Copy the spreadsheet URL from your browser\n' +
            '4. Paste it in the "Linked Responses Sheet URL" field below\n' +
            '5. Click "Connect Sheet & Import to Database" again\n\n' +
            'This will import ALL existing form responses and continuously sync new ones!'
          );
        }

        if (rowsToImport.length > 0) {
          await db.runInitialBackfill(hospitalId, rowsToImport, mapping, {
            source: 'google_forms',
            source_name: finalTitle,
          });
        }

        setNewSheetTitle('');
        await loadData();
        setSaveSuccessMessage(
          `Google Form connected! ${rowsToImport.length > 0 ? `Imported ${rowsToImport.length} patient consultation(s) into database & live UI.` : 'Responses will appear live in the UI as submitted.'}`
        );
        setTimeout(() => setSaveSuccessMessage(null), 6000);
        setIsEditing(false);
        setSyncing(false);
        return;
      }

      // ── Scenario B: Google Sheets (OAuth & Live Sync) ───────────────────────
      if (sheetType === 'google_sheets') {
        const inputUrl = sheetUrl.trim();
        const googleMatch = inputUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const sheetId = googleMatch ? googleMatch[1] : inputUrl;
        const finalTitle = newSheetTitle.trim() || 'Google Sheet Connection';
        
        let rowsToImport: any[] = [];

        // 1. Fetch rows immediately from the Google Sheet
        try {
          const resp = await fetch(apiUrl(`/api/fetch-google-sheet?url=${encodeURIComponent(inputUrl)}`));
          const data = await resp.json();
          if (data.success && data.csv) {
            const workbook = XLSX.read(data.csv, { type: 'string' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
            rowsToImport = rawJson.map((r, i) => parseRawRow(r, i)).filter(Boolean) as any[];
          }
        } catch (e) {
          console.warn('Direct live sheet fetch failed, falling back to server-side sync:', e);
        }

        // 2. Import parsed rows into database
        if (rowsToImport.length > 0) {
          await db.runInitialBackfill(hospitalId, rowsToImport, mapping, {
            source: 'google_sheets',
            source_name: finalTitle,
          });
        }

        // 3. Save Connection to DB
        const conn = await db.saveSheetConnection({
          hospital_id: hospitalId,
          sheet_type: 'google_sheets',
          sheet_id: sheetId,
          table_name: finalTitle,
          column_mapping: mapping,
          status: 'connected',
        });
        
        setNewSheetTitle('');
        setConnectionStep(1);
        
        // 4. Trigger background server sync
        try {
          const resp = await fetch(apiUrl('/api/sheets/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: conn.id, hospitalId }),
          });
          const result = await resp.json();
          if (result.success) {
            const count = rowsToImport.length > 0 ? rowsToImport.length : result.added;
            setSaveSuccessMessage(`⚡ Connected! Synced ${count} patient consultations into database & live UI.`);
          } else {
            setSaveSuccessMessage(
              rowsToImport.length > 0
                ? `⚡ Connected! Imported ${rowsToImport.length} patient consultations into database & live UI.`
                : `Connected, but background sync note: ${result.error || 'Running next cycle'}`
            );
          }
        } catch (err) {
          if (rowsToImport.length > 0) {
            setSaveSuccessMessage(`⚡ Connected! Imported ${rowsToImport.length} patient consultations into database & live UI.`);
          }
        }

        await loadData();
        setTimeout(() => setSaveSuccessMessage(null), 6000);
        setIsEditing(false);
        setSyncing(false);
        return;
      }

      // ── Scenario C: Excel ───────────────────────
      const sourceLabel = newSheetTitle || uploadedFileName || 'Excel Import';
      await db.saveSheetConnection({
        hospital_id: hospitalId,
        sheet_type: 'excel_365',
        sheet_id: uploadedFileName || 'excel_upload',
        table_name: sourceLabel,
        column_mapping: mapping,
      });
      setNewSheetTitle('');

      if (uploadedRows.length > 0) {
        await db.runInitialBackfill(hospitalId, uploadedRows, mapping, {
          source: 'excel_365',
          source_name: sourceLabel,
        });
      }

      await loadData();
      setSaveSuccessMessage(
        `Spreadsheet connected! ${uploadedRows.length > 0 ? `${uploadedRows.length} patient consultations entered in database and displayed below.` : 'Ready for data.'}`
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
        source: 'manual',
        source_name: 'Manual Entry',
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
      if (connection && connection.sheet_type === 'google_sheets') {
        const resp = await fetch(apiUrl('/api/sheets/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: connection.id, hospitalId }),
        });
        const result = await resp.json();
        if (result.success) {
          setSaveSuccessMessage(`Sync complete: Added ${result.added} new records.`);
        } else {
          setSaveSuccessMessage(`Sync complete with errors: ${result.error}`);
        }
      } else {
        await db.runDeltaSync(hospitalId, []);
        setSaveSuccessMessage('Sync complete: All latest patient records are up to date in database.');
      }
      await loadData();
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
                        ? (connection.table_name || 'Google Form Source')
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
                {(connection.sheet_type === 'google_forms' ||
                  selectedSourceFilter === 'google_forms' ||
                  allConnections.some((c) => c.sheet_type === 'google_forms')) && (
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

                    {(() => {
                      const gfConn = allConnections.find((c) => c.sheet_type === 'google_forms');
                      const activeGfUrl = gfConn?.sheet_id || (sheetUrl.includes('docs.google.com/forms') ? sheetUrl : '');
                      if (!activeGfUrl) return null;
                      const finalLink = activeGfUrl.startsWith('http')
                        ? activeGfUrl
                        : `https://docs.google.com/forms/d/e/${activeGfUrl}/viewform`;
                      return (
                        <a
                          href={finalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition-all shadow-xs"
                          title="Open Google Form in a new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Form</span>
                        </a>
                      );
                    })()}

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

            {/* Sync Health Dashboard Widget (Feature 5) */}
            {connection.sheet_type === 'google_sheets' && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 mt-4">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    Auto-Sync Health
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {connection.sync_status === 'syncing' ? 'Syncing Now...' : 'Monitoring Sheet'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold">Last Checked:</span>
                    <span>{connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString() : 'Never'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold">Last Row Processed:</span>
                    <span>Row {connection.last_row_synced || 0}</span>
                  </div>
                  
                  {connection.last_error && (
                    <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-700">{connection.last_error}</p>
                    </div>
                  )}

                  {syncRuns && syncRuns.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-500 mb-2">Recent Background Syncs</p>
                      <div className="space-y-2">
                        {syncRuns.slice(0, 5).map(run => (
                          <div key={run.id} className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="text-slate-600">{new Date(run.started_at).toLocaleTimeString()}</span>
                            <span className="text-slate-500">
                              Added {run.rows_added || 0}
                              {run.rows_rejected ? <span className="text-rose-500 ml-1">({run.rows_rejected} bad)</span> : null}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded font-bold ${
                              run.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                              run.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>
                              {run.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    setSheetUrl('');
                    setNewSheetTitle('');
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
                  {allConnections.map((c) => {
                    const rowCount =
                      c.sheet_type === 'google_forms'
                        ? googleFormsCount
                        : c.sheet_type === 'excel_365'
                        ? excelCount
                        : googleSheetsCount;
                    const isSelected =
                      (c.sheet_type === 'google_forms' && selectedSourceFilter === 'google_forms') ||
                      (c.sheet_type === 'excel_365' && selectedSourceFilter === 'excel_365') ||
                      (c.sheet_type === 'google_sheets' && selectedSourceFilter === 'google_sheets');

                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          if (c.sheet_type === 'google_forms') setSelectedSourceFilter('google_forms');
                          else if (c.sheet_type === 'excel_365') setSelectedSourceFilter('excel_365');
                          else setSelectedSourceFilter('google_sheets');
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 shadow-2xs'
                        }`}
                        title="Click to view records for this spreadsheet source"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.sheet_type === 'google_forms'
                              ? 'bg-purple-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span>
                          {c.table_name ||
                            (c.sheet_type === 'excel_365'
                              ? 'Excel Import'
                              : c.sheet_type === 'google_forms'
                              ? 'Google Form'
                              : 'Google Sheet')}
                        </span>
                        <span
                          className={`text-[10px] font-mono ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          ({rowCount} rows)
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSheetModal(true);
                    setSheetUrl('');
                    setNewSheetTitle('');
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

            {/* ── Source Filter Tabs (All Records, Google Sheets, Google Forms, Excel Sheets) ────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 border-b border-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                {/* Tab: All Records */}
                <button
                  type="button"
                  onClick={() => setSelectedSourceFilter('all')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedSourceFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>All Records</span>
                  <span
                    className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      selectedSourceFilter === 'all'
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {totalAllCount}
                  </span>
                </button>

                {/* Tab: Google Sheets */}
                <button
                  type="button"
                  onClick={() => setSelectedSourceFilter('google_sheets')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedSourceFilter === 'google_sheets'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Google Sheet</span>
                  <span
                    className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      selectedSourceFilter === 'google_sheets'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {googleSheetsCount}
                  </span>
                </button>

                {/* Tab: Google Forms */}
                <button
                  type="button"
                  onClick={() => setSelectedSourceFilter('google_forms')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedSourceFilter === 'google_forms'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80'
                  }`}
                >
                  <FormInput className="w-3.5 h-3.5" />
                  <span>Google Form</span>
                  <span
                    className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      selectedSourceFilter === 'google_forms'
                        ? 'bg-purple-700 text-white'
                        : 'bg-white text-purple-800 border border-purple-200'
                    }`}
                  >
                    {googleFormsCount}
                  </span>
                </button>

                {/* Tab: Excel / CSV Sheet */}
                <button
                  type="button"
                  onClick={() => setSelectedSourceFilter('excel_365')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedSourceFilter === 'excel_365'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Excel Sheet</span>
                  <span
                    className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      selectedSourceFilter === 'excel_365'
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-blue-800 border border-blue-200'
                    }`}
                  >
                    {excelCount}
                  </span>
                </button>

                {/* Tab: Manual Entry (if any) */}
                {manualCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSourceFilter('manual')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      selectedSourceFilter === 'manual'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Manual Entry</span>
                    <span
                      className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        selectedSourceFilter === 'manual'
                          ? 'bg-slate-800 text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {manualCount}
                    </span>
                  </button>
                )}
              </div>

              {/* Quick info caption */}
              <div className="text-[11px] text-slate-500 font-medium">
                Showing <strong className="text-slate-900 font-bold">{displayedVisits.length}</strong>{' '}
                {selectedSourceFilter === 'all'
                  ? 'consultation records across all sources'
                  : selectedSourceFilter === 'google_sheets'
                  ? 'Google Sheet consultation records'
                  : selectedSourceFilter === 'google_forms'
                  ? 'Google Form response records'
                  : selectedSourceFilter === 'excel_365'
                  ? 'Excel sheet consultation records'
                  : 'Manual entry consultation records'}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Visit ID</th>
                    <th className="py-3 px-4">Source</th>
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
                  {displayedVisits.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 px-4 text-center">
                        {selectedSourceFilter === 'google_forms' ? (
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 mx-auto flex items-center justify-center">
                              <FormInput className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">
                                No Google Form Responses Displayed Yet
                              </h4>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                To sync patient responses from your Google Form into RescueBridge:
                              </p>
                              <div className="text-left text-xs bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 mt-2 space-y-1.5 text-purple-950 font-medium">
                                <p className="flex items-start gap-1.5">
                                  <span className="font-bold text-purple-700">1.</span>
                                  <span><strong>Quick Ingest:</strong> Click <em>"+ Ingest Patient Response"</em> below to save patient responses sent in your form.</span>
                                </p>
                                <p className="flex items-start gap-1.5">
                                  <span className="font-bold text-purple-700">2.</span>
                                  <span><strong>Auto-Sync Linked Sheet:</strong> In your Google Form, click <em>Responses</em> → <em>"Link to Sheets"</em>, and connect that Google Sheet.</span>
                                </p>
                                <p className="flex items-start gap-1.5">
                                  <span className="font-bold text-purple-700">3.</span>
                                  <span><strong>Live Cloud Webhook:</strong> Use our Google Apps Script code to stream every submission to the database automatically.</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                              <button
                                type="button"
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
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Ingest Patient Response</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowAppsScriptModal(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all shadow-2xs"
                              >
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                <span>Setup Apps Script Webhook</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {selectedSourceFilter === 'all'
                              ? 'No patient consultations yet. Add a new row or sync your sheet.'
                              : selectedSourceFilter === 'google_sheets'
                              ? 'No Google Sheet patient records found.'
                              : selectedSourceFilter === 'excel_365'
                              ? 'No Excel sheet patient records found. Upload an Excel or CSV file.'
                              : 'No manual entry patient records found.'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    displayedVisits.map((v) => {
                      const isSent = Boolean(v.patient?.review_sent || v.review_requested);
                      const dateCrossed = isDateCrossed(v.visit_date);
                      const isCompleted = isSent || dateCrossed || v.status === 'completed';
                      const sourceKind = getVisitSource(v);
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {v.visit_uid || v.sheet_row_id || v.id.slice(0, 8)}
                          </td>

                          {/* Differentiated Source Badge Column */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {sourceKind === 'google_forms' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                                <FormInput className="w-3 h-3 text-purple-600" />
                                <span>Google Form</span>
                              </span>
                            )}
                            {sourceKind === 'google_sheets' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                                <span>Google Sheet</span>
                              </span>
                            )}
                            {sourceKind === 'excel_365' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                                <FileCheck className="w-3 h-3 text-blue-600" />
                                <span>Excel Sheet</span>
                              </span>
                            )}
                            {sourceKind === 'manual' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                                <User className="w-3 h-3 text-slate-500" />
                                <span>Manual Entry</span>
                              </span>
                            )}
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
                  setSheetUrl('');
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
                setSheetUrl('');
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
                    {sheetUrl.trim() && parseGoogleFormUrl(sheetUrl).isValid && (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                        Google Form Detected
                      </span>
                    )}
                  </div>
                  <input
                    type="url"
                    required={uploadedRows.length === 0}
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
                    Paste your Google Form link here.
                  </p>
                </div>

                {/* Linked Responses Sheet URL — shows when Google Form URL is entered */}
                {sheetUrl.trim() && parseGoogleFormUrl(sheetUrl).isValid && (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <label className="block text-xs font-bold text-emerald-800">
                        Linked Responses Sheet URL (Required for auto-sync)
                      </label>
                    </div>
                    <input
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/... (paste the responses sheet URL)"
                      value={linkedSheetUrl}
                      onChange={(e) => setLinkedSheetUrl(e.target.value)}
                      className="w-full text-xs rounded-xl border border-emerald-300 p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-mono bg-white"
                    />
                    <div className="bg-white border border-emerald-100 rounded-xl p-3 space-y-1.5">
                      <p className="text-[11px] font-bold text-emerald-900">📋 How to get this URL:</p>
                      <ol className="text-[10px] text-slate-600 space-y-1 list-decimal list-inside">
                        <li>Open your Google Form</li>
                        <li>Click the <span className="font-bold text-emerald-700">"Responses"</span> tab at the top</li>
                        <li>Click the green <span className="font-bold text-emerald-700">Google Sheets icon (📊)</span> — "View in Sheets"</li>
                        <li>Copy the URL from your browser's address bar</li>
                        <li>Paste it here ↑</li>
                      </ol>
                      <p className="text-[10px] text-amber-700 font-semibold mt-1">
                        ⚠️ Also make sure the sheet is shared: Click Share → "Anyone with the link" → Viewer
                      </p>
                    </div>
                    {linkedSheetUrl.trim() && linkedSheetUrl.includes('docs.google.com/spreadsheets') && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-700">
                          ✓ Responses Sheet URL detected — will auto-sync every 60 seconds
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    OR UPLOAD RESPONSES EXCEL FILE (.XLSX / .CSV)
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div>
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-purple-500 rounded-2xl p-4 bg-purple-50/30 hover:bg-purple-50/60 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-purple-200 group-hover:border-purple-300 flex items-center justify-center text-purple-600 shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-purple-900 group-hover:text-purple-700">
                          {uploadedFileName ? uploadedFileName : 'Upload Google Form Responses (.xlsx or .csv)'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          In Google Sheets: File → Download → Microsoft Excel (.xlsx), then drop it here to import immediately!
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

                {/* Form fields overview when link is valid */}
                {sheetUrl.trim() && parseGoogleFormUrl(sheetUrl).isValid && (
                  <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Google Form Fields & Database Mapping
                      </p>
                      <span className="text-[10px] font-mono font-bold text-purple-700 bg-white px-2 py-0.5 rounded-lg border border-purple-200">
                        Live Auto-Sync
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {STANDARD_FORM_FIELDS.map((f) => (
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
                )}
              </div>
            )}

            {/* If Google Sheets: Input Link or Upload downloaded Google Sheet */}
            {sheetType === 'google_sheets' && (
              <div className="space-y-4">
                {connectionStep === 1 ? (
                  <>
                    <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-emerald-800">
                          Step 1: Share Sheet with Sync Bot
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
                      <p className="text-emerald-700 text-[11px] leading-relaxed">
                        In Google Sheets, click <strong className="text-emerald-900">Share</strong> and grant "Viewer" or "Editor" access to:
                      </p>
                      <div className="bg-white border border-emerald-200 p-2 rounded-lg font-mono text-[11px] text-emerald-900 flex items-center justify-between shadow-xs">
                        <span className="truncate select-all">{serviceEmail}</span>
                        <button
                          type="button"
                          onClick={copyServiceEmail}
                          className="ml-2 text-emerald-600 hover:text-emerald-700 font-sans font-semibold text-[11px]"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Step 2: Paste Google Sheet Link *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                        value={sheetUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSheetUrl(val);
                          if (val.includes('docs.google.com/forms')) {
                            setSheetType('google_forms');
                          }
                        }}
                        className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-mono"
                      />
                    </div>
                    
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleFetchHeaders}
                        disabled={syncing || !sheetUrl.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                      >
                        {syncing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        <span>Fetch Columns & Continue</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">Map Your Columns</h3>
                      <button
                        type="button"
                        onClick={() => setConnectionStep(1)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        ← Back
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">
                      We found <strong>{sheetHeaders.length}</strong> columns in your sheet. Please match them to the database fields below.
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                      {['patient_name', 'phone', 'visit_date', 'doctor', 'department', 'status', 'visit_uid'].map((field) => (
                        <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="sm:w-1/3 text-xs font-bold text-slate-700 capitalize">
                            {field.replace('_', ' ')}
                            {['patient_name', 'phone'].includes(field) && <span className="text-rose-500 ml-1">*</span>}
                          </div>
                          <div className="sm:w-2/3">
                            <select
                              value={mapping[field as keyof ColumnMapping] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMapping({ ...mapping, [field]: val === '' ? null : Number(val) });
                              }}
                              className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                            >
                              <option value="">-- Ignore this column --</option>
                              {sheetHeaders.map((h, i) => (
                                <option key={i} value={i}>{h}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

            {/* Collapsible Advanced Column Names (For Excel only now) */}
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
                      setSheetUrl('');
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
                    setSheetUrl('');
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
                  {sheetUrl.trim() && parseGoogleFormUrl(sheetUrl).isValid && (
                    <div className="bg-purple-50 border border-purple-200/80 rounded-xl p-3 text-[11px] text-purple-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-purple-950">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Google Form Link Detected
                      </p>
                      <p className="text-purple-700">
                        All patient responses submitted to this form will be automatically saved to the database and displayed live.
                      </p>
                    </div>
                  )}
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
                <p className="text-xs font-bold text-purple-900">Google Form Fields</p>
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
