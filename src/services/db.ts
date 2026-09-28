import { supabase } from './supabase';
import {
  Hospital,
  User,
  Patient,
  Visit,
  ReviewRequest,
  UserRole,
  HospitalSheetConnection,
  ColumnMapping,
  SyncRun,
  SyncError,
  VisitStatus,
} from '../types/database';

export const WHATSAPP_REVIEW_TEMPLATE = `Hi [Patient Name]! 💙

Thank you for choosing [Hospital Name] for your care.

We’d love to know about your experience. 🏥

💬 We would be grateful if you could share your experience with us right here in this chat.

You can simply:
🎤 Send a voice message and tell us about your experience, or
⌨️ Type your feedback in the chat.
Your feedback is valuable to us and helps us continuously improve our services. 💙`;

const SEED_HOSPITALS: Hospital[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'City Care Hospital',
    subdomain: 'citycare',
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    sheet_id: '',
    sheet_type: 'google_sheets',
    logo: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80',
    whatsapp_template_name: 'patient_review_v1',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    sync_status: 'disconnected',
    last_synced: 'Never',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Apex Multi-Specialty Clinic',
    subdomain: 'apex',
    google_place_id: 'ChIJ3S4IddeuEmsRil83y53frY2',
    sheet_id: '',
    sheet_type: 'excel_365',
    logo: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=128&q=80',
    whatsapp_template_name: 'patient_review_v1',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    sync_status: 'disconnected',
    last_synced: 'Never',
  },
];

const SEED_USERS: User[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    hospital_id: null,
    name: 'Super Administrator',
    email: 'superadmin@rescuebridge.com',
    role: 'super_admin',
    password_hash: 'admin123',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Dr. Ramesh Kumar (Admin)',
    email: 'admin@citycare.com',
    role: 'hospital_admin',
    password_hash: 'admin123',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Pooja (Reception Desk)',
    email: 'staff@citycare.com',
    role: 'staff',
    password_hash: 'staff123',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    name: 'Dr. Priya V (Apex Admin)',
    email: 'admin@apexclinic.com',
    role: 'hospital_admin',
    password_hash: 'admin123',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

const SEED_PATIENTS: Patient[] = [];
const SEED_VISITS: Visit[] = [];
const SEED_REVIEW_REQUESTS: ReviewRequest[] = [];

// ---------------------------------------------------------------------------
// ISO Date and Deterministic UUID Helpers for Database Integrity
// ---------------------------------------------------------------------------
export function toIsoDate(dStr?: string | null): string {
  if (!dStr) return new Date().toISOString().split('T')[0];
  const str = String(dStr).trim();
  if (!str) return new Date().toISOString().split('T')[0];
  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Match YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// ID Generators: Name + Unique Random Number (e.g. resuede-7201, ganesh-b-881915)
// Guarantees no two hospital IDs or patient IDs are ever the same!
// ---------------------------------------------------------------------------
export function generateHospitalId(name: string, existingIds?: Set<string>): string {
  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'hospital';

  let randomNum = Math.floor(1000 + Math.random() * 9000);
  let id = `${cleanName}-${randomNum}`;
  while (existingIds && existingIds.has(id)) {
    randomNum = Math.floor(1000 + Math.random() * 9000);
    id = `${cleanName}-${randomNum}`;
  }
  return id;
}

export function generatePatientId(
  patientName: string,
  suffixOrRowId?: string | number,
  existingIds?: Set<string>
): string {
  const cleanName = patientName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'patient';

  let suffix = '';
  if (suffixOrRowId) {
    const digits = String(suffixOrRowId).replace(/\D+/g, '');
    if (digits) suffix = `-${digits}`;
  }
  if (!suffix) {
    suffix = `-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  let id = `${cleanName}${suffix}`;
  while (existingIds && existingIds.has(id)) {
    const extra = Math.floor(100 + Math.random() * 900);
    id = `${cleanName}${suffix}-${extra}`;
  }
  return id;
}

export function toPatientUuid(visitUidOrPhone: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitUidOrPhone)) {
    return visitUidOrPhone;
  }
  let hash = 0;
  for (let i = 0; i < visitUidOrPhone.length; i++) {
    hash = (hash << 5) - hash + visitUidOrPhone.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);
  const mid = (Math.abs(hash * 31) % 0xffff).toString(16).padStart(4, '0');
  return `00000000-${mid}-4000-8000-${hex}`;
}

export function toVisitUuid(visitUidOrPhone: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitUidOrPhone)) {
    return visitUidOrPhone;
  }
  let hash = 0;
  for (let i = 0; i < visitUidOrPhone.length; i++) {
    hash = (hash << 5) - hash + visitUidOrPhone.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);
  const mid = (Math.abs(hash * 37) % 0xffff).toString(16).padStart(4, '0');
  return `11111111-${mid}-4000-8000-${hex}`;
}

// ---------------------------------------------------------------------------
// LocalStorage Persistence Helpers (Syncs in real-time)
// ---------------------------------------------------------------------------
function getStore<T>(key: string, initial: T[]): T[] {
  try {
    const raw = localStorage.getItem(`rb_${key}`);
    if (!raw) {
      localStorage.setItem(`rb_${key}`, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return initial;
  }
}

function setStore<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(`rb_${key}`, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to write to localStorage for key rb_${key}:`, err);
  }
}

function isCorruptedText(text?: string | null): boolean {
  if (!text) return false;
  return (
    text.includes('[Content_Types]') ||
    text.includes('PK\x03\x04') ||
    text.includes('PK\u0003\u0004') ||
    (text.includes('PK') && text.includes('.xml')) ||
    (text.includes('\ufffd') && text.length > 5) ||
    /^[^\w\s]{3,}.*xml/i.test(text)
  );
}

const DUMMY_NAMES = new Set([
  'rajesh sharma',
  'anita desai',
  'suresh kumar',
  'kavitha sundaram',
  'arun kumar',
  'deepa venkat',
  'mohammed farooq',
  'suresh raina',
  'meena kumari',
  'vijay shankar',
  'pooja nair',
  'sunita sharma',
  'venkatesh rao',
  'karthik subramanian',
  'ganesh moorthy'
]);

function isDummyOrCorrupted(name?: string | null, id?: string | null): boolean {
  if (!name && !id) return true;
  if (isCorruptedText(name)) return true;
  if (name && DUMMY_NAMES.has(name.trim().toLowerCase())) return true;
  if (id && (id.startsWith('33333333-') || id.startsWith('44444444-') || id.startsWith('55555555-'))) return true;
  return false;
}

function cleanCorruptedData(): void {
  try {
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const visits = getStore<Visit>('visits', SEED_VISITS);

    const validPatients = patients.filter((p) => !isDummyOrCorrupted(p.name, p.id));
    const validPatientIdSet = new Set(validPatients.map((p) => p.id));
    const validVisits = visits.filter(
      (v) =>
        validPatientIdSet.has(v.patient_id) &&
        !isDummyOrCorrupted(v.doctor, v.id) &&
        !isCorruptedText(v.visit_uid) &&
        !isCorruptedText(v.sheet_row_id)
    );

    if (validPatients.length !== patients.length || validVisits.length !== visits.length) {
      setStore('patients', validPatients);
      setStore('visits', validVisits);
    }
  } catch (err) {
    console.error('Failed to clean corrupted records:', err);
  }
}

// ---------------------------------------------------------------------------
// Date crossed check: Returns true when visit date is strictly earlier than today
// e.g. visit was 24-06-2026, today is 25-06-2026 => returns true (Completed)
// ---------------------------------------------------------------------------
export function isDateCrossed(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const str = String(dateStr).trim();
  if (!str) return false;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let visitTime: number | null = null;

  // 1. Check DD-MM-YYYY or DD/MM/YYYY or D-M-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    visitTime = new Date(year, month, day).getTime();
  } else {
    // 2. Check YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      visitTime = new Date(year, month, day).getTime();
    } else {
      // 3. Fallback to Date.parse
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        visitTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }
    }
  }

  if (visitTime === null || isNaN(visitTime)) return false;
  return visitTime < todayMidnight;
}

// ---------------------------------------------------------------------------
// Multi-Tenant Database Client
// ---------------------------------------------------------------------------
export const db = {
  // ── Hospitals ─────────────────────────────────────────────────────────────
  async getHospitals(): Promise<Hospital[]> {
    const localHospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const cleanedLocalHospitals = localHospitals.map((h) => {
      if (
        h.id !== '11111111-1111-1111-1111-111111111111' &&
        h.logo === 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80'
      ) {
        return { ...h, logo: undefined };
      }
      return h;
    });

    try {
      const { data, error } = await supabase.from('hospitals').select('*');
      if (!error && data && data.length > 0) {
        const hospitalMap = new Map<string, Hospital>();
        cleanedLocalHospitals.forEach((h) => {
          if (h && h.id) hospitalMap.set(h.id, h);
        });
        (data as Hospital[]).forEach((remote) => {
          if (remote && remote.id) {
            const existing = hospitalMap.get(remote.id);
            const remoteLogo =
              remote.id !== '11111111-1111-1111-1111-111111111111' &&
              remote.logo === 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80'
                ? undefined
                : remote.logo;

            hospitalMap.set(remote.id, {
              ...remote,
              logo: existing?.logo !== undefined ? existing.logo : remoteLogo,
              website: existing?.website || (remote as any).website,
              sync_status: existing?.sync_status || 'active',
              last_synced: existing?.last_synced || 'Just now',
            });
          }
        });
        const merged = Array.from(hospitalMap.values());
        setStore('hospitals', merged);
        return merged;
      }
    } catch (err) {
      console.warn('Failed to fetch hospitals from Supabase, using local:', err);
    }
    setStore('hospitals', cleanedLocalHospitals);
    return cleanedLocalHospitals;
  },

  async getHospitalById(id: string): Promise<Hospital | null> {
    const hospitals = await this.getHospitals();
    return hospitals.find((h) => h.id === id) || null;
  },

  async getHospitalBySubdomain(subdomain: string): Promise<Hospital | null> {
    const hospitals = await this.getHospitals();
    return (
      hospitals.find(
        (h) => h.subdomain.toLowerCase() === subdomain.toLowerCase()
      ) || null
    );
  },

  async createHospital(
    hospitalData: Omit<Hospital, 'id' | 'created_at'>,
    adminData?: { name: string; email: string }
  ): Promise<Hospital> {
    const current = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const existingIds = new Set(current.map((h) => h.id));
    const hospitalId = generateHospitalId(hospitalData.name, existingIds);

    // Compute unique subdomain
    const existingSubdomains = new Set(
      current.map((h) => h.subdomain?.toLowerCase().trim()).filter(Boolean)
    );
    let finalSubdomain = (hospitalData.subdomain || hospitalData.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'hospital';

    if (existingSubdomains.has(finalSubdomain)) {
      const parts = hospitalId.split('-');
      const numPart = parts[parts.length - 1] || Math.floor(1000 + Math.random() * 9000);
      finalSubdomain = `${finalSubdomain}-${numPart}`;
    }

    const newHospital: Hospital = {
      ...hospitalData,
      id: hospitalId,
      subdomain: finalSubdomain,
      created_at: new Date().toISOString(),
      sync_status: 'active',
      last_synced: 'Just now',
    };

    // 1. Immediately persist to localStorage
    const updated = [newHospital, ...current.filter((h) => h.id !== newHospital.id)];
    setStore('hospitals', updated);

    // 2. Persist to Supabase with schema-compliant columns (supports TEXT or UUID)
    try {
      let supabasePayload = {
        id: newHospital.id,
        name: newHospital.name,
        subdomain: newHospital.subdomain,
        google_place_id: newHospital.google_place_id || null,
        sheet_id: newHospital.sheet_id || null,
        sheet_type: newHospital.sheet_type || 'google_sheets',
        logo: newHospital.logo || null,
        whatsapp_template_name: newHospital.whatsapp_template_name || null,
        created_at: newHospital.created_at,
      };

      let { error } = await supabase.from('hospitals').insert(supabasePayload);

      // Handle duplicate subdomain key collision by auto-suffixing
      if (error && error.message && error.message.includes('hospitals_subdomain_key')) {
        const uniqueSub = `${newHospital.subdomain}-${Math.floor(1000 + Math.random() * 9000)}`;
        newHospital.subdomain = uniqueSub;
        supabasePayload.subdomain = uniqueSub;
        const retry = await supabase.from('hospitals').insert(supabasePayload);
        error = retry.error;
      }

      if (error && error.message && error.message.includes('type uuid')) {
        // Fallback for Supabase before SQL migration
        const fallbackUuid = toPatientUuid(hospitalId);
        newHospital.id = fallbackUuid;
        await supabase.from('hospitals').insert({ ...supabasePayload, id: fallbackUuid });
      } else if (error) {
        console.error('Supabase createHospital error:', error);
        throw new Error(error.message || 'Failed to create hospital in database');
      }
    } catch (err: any) {
      console.error('Failed to insert hospital into Supabase:', err);
      throw err;
    }

    // 3. Create first hospital admin if provided
    if (adminData && adminData.email) {
      await this.createUser({
        hospital_id: newHospital.id,
        name: adminData.name,
        email: adminData.email,
        role: 'hospital_admin',
      });
    }

    return newHospital;
  },

  async updateHospital(id: string, updates: Partial<Hospital>): Promise<Hospital> {
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const idx = hospitals.findIndex((h) => h.id === id);
    if (idx === -1) throw new Error('Hospital not found');

    const updated: Hospital = {
      ...hospitals[idx],
      ...updates,
    };
    hospitals[idx] = updated;
    setStore('hospitals', hospitals);

    try {
      await supabase.from('hospitals').update({
        name: updated.name,
        subdomain: updated.subdomain,
        google_place_id: updated.google_place_id,
        logo: updated.logo || null,
        sheet_id: updated.sheet_id || null,
        sheet_type: updated.sheet_type || 'google_sheets',
        whatsapp_template_name: updated.whatsapp_template_name || null,
      }).eq('id', id);
    } catch (err) {
      console.warn('Failed to update hospital in Supabase:', err);
    }

    return updated;
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  async getUsers(hospitalId?: string | null): Promise<User[]> {
    const localUsers = getStore<User>('users', SEED_USERS);
    let allUsers = [...localUsers];

    try {
      let query = supabase.from('users').select('*');
      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const userMap = new Map<string, User>();
        // Add local users first
        localUsers.forEach((u) => {
          if (u && u.email) {
            userMap.set(u.email.toLowerCase().trim(), u);
          }
        });
        // Merge with Supabase users
        (data as User[]).forEach((remote) => {
          if (remote && remote.email) {
            const key = remote.email.toLowerCase().trim();
            const existing = userMap.get(key);
            userMap.set(key, {
              ...existing,
              ...remote,
              // If local user has custom password_hash, preserve it
              password_hash: existing?.password_hash || remote.password_hash,
            });
          }
        });
        allUsers = Array.from(userMap.values());
        setStore('users', allUsers);
      }
    } catch (err) {
      console.warn('Failed to fetch users from Supabase, using local:', err);
    }

    if (!hospitalId) return allUsers;
    return allUsers.filter(
      (u) => u.hospital_id === hospitalId || u.role === 'super_admin'
    );
  },

  async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const cleanEmail = userData.email.trim().toLowerCase();
    const newUser: User = {
      ...userData,
      email: cleanEmail,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    // 1. Immediately persist locally
    const currentUsers = getStore<User>('users', SEED_USERS);
    const filtered = currentUsers.filter((u) => u.email.toLowerCase().trim() !== cleanEmail);
    const updatedUsers = [newUser, ...filtered];
    setStore('users', updatedUsers);

    // 2. Persist to Supabase
    try {
      const userPayload = {
        id: newUser.id,
        hospital_id: newUser.hospital_id || null,
        name: newUser.name,
        email: cleanEmail,
        password_hash: newUser.password_hash || null,
        role: newUser.role,
        created_at: newUser.created_at,
      };
      const { error } = await supabase.from('users').upsert(userPayload, { onConflict: 'email' });
      if (error) {
        console.error('Supabase user upsert error:', error);
        throw new Error(error.message || 'Failed to save user account to database');
      }
    } catch (err: any) {
      console.error('Failed to upsert user into Supabase:', err);
      throw err;
    }

    return newUser;
  },

  // ── Visits & Patients ─────────────────────────────────────────────────────
  async getPatients(hospitalId?: string | null): Promise<Patient[]> {
    cleanCorruptedData();
    let localPatients = getStore<Patient>('patients', []).filter(
      (p) => !isDummyOrCorrupted(p.name, p.id)
    );

    try {
      let query = supabase.from('patients').select('*');
      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const patientMap = new Map<string, Patient>();
        localPatients.forEach((p) => {
          if (p?.id && !isDummyOrCorrupted(p.name, p.id)) patientMap.set(p.id, p);
        });
        (data as Patient[]).forEach((remote) => {
          if (remote?.id && !isDummyOrCorrupted(remote.name, remote.id)) {
            const ex = patientMap.get(remote.id);
            patientMap.set(remote.id, {
              ...remote,
              review_sent: ex?.review_sent || false,
              last_message_content: ex?.last_message_content,
            });
          }
        });
        const merged = Array.from(patientMap.values());
        setStore('patients', merged);
        return hospitalId ? merged.filter((p) => p.hospital_id === hospitalId) : merged;
      }
    } catch (err) {
      console.warn('Supabase getPatients error, falling back to local:', err);
    }
    return hospitalId ? localPatients.filter((p) => p.hospital_id === hospitalId) : localPatients;
  },

  async getVisits(
    hospitalId?: string | null,
    filters?: {
      department?: string;
      doctor?: string;
      status?: string;
      date?: string;
    }
  ): Promise<Visit[]> {
    cleanCorruptedData();
    let visits = getStore<Visit>('visits', []).filter((v) => !isDummyOrCorrupted(v.doctor, v.id));
    let patients = await this.getPatients(hospitalId);
    const hospitals = await this.getHospitals();
    const reviews = getStore<ReviewRequest>('review_requests', []);

    try {
      let query = supabase.from('visits').select('*').order('created_at', { ascending: false });
      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const visitMap = new Map<string, Visit>();
        visits.forEach((v) => {
          if (v?.id && !isDummyOrCorrupted(v.doctor, v.id)) visitMap.set(v.id, v);
        });
        (data as Visit[]).forEach((remote) => {
          if (remote?.id && !isDummyOrCorrupted(remote.doctor, remote.id)) {
            const ex = visitMap.get(remote.id);
            visitMap.set(remote.id, {
              ...remote,
              review_requested: ex?.review_requested || remote.review_requested || false,
            });
          }
        });
        visits = Array.from(visitMap.values());
        setStore('visits', visits);
      }
    } catch (err) {
      console.warn('Supabase getVisits error, falling back to local:', err);
    }

    let filtered = visits;
    if (hospitalId) {
      filtered = filtered.filter((v) => v.hospital_id === hospitalId);
    }
    if (filters?.department && filters.department !== 'all') {
      filtered = filtered.filter((v) => v.department === filters.department);
    }
    if (filters?.doctor && filters.doctor !== 'all') {
      filtered = filtered.filter((v) => v.doctor === filters.doctor);
    }
    if (filters?.date) {
      filtered = filtered.filter((v) => v.visit_date === filters.date);
    }

    // Hydrate with patient, hospital, review_request and mark completed if date crossed or sent
    const hydrated = filtered
      .map((v) => {
        const patient = patients.find((p) => p.id === v.patient_id);
        const reviewReq = reviews.find((r) => r.visit_id === v.id);
        const isSent = Boolean(patient?.review_sent || v.review_requested || reviewReq);
        const dateCrossed = isDateCrossed(v.visit_date);
        const isCompleted = isSent || dateCrossed || v.status === 'completed';

        return {
          ...v,
          status: isCompleted ? ('completed' as const) : ('in_consultation' as const),
          patient,
          hospital: hospitals.find((h) => h.id === v.hospital_id),
          review_request: reviewReq,
        };
      })
      .filter((v) => !isDummyOrCorrupted(v.patient?.name, v.patient?.id) && !isCorruptedText(v.visit_uid));

    if (filters?.status && filters.status !== 'all') {
      return hydrated.filter((v) => v.status === filters.status);
    }
    return hydrated;
  },

  async purgeCorruptedVisits(hospitalId?: string): Promise<number> {
    cleanCorruptedData();
    const visits = getStore<Visit>('visits', []);
    const patients = getStore<Patient>('patients', []);
    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const before = visits.length;

    const clean = visits.filter((v) => {
      if (hospitalId && v.hospital_id !== hospitalId) return true;
      const p = patientMap.get(v.patient_id);
      if (!p || !p.name || isDummyOrCorrupted(p.name, p.id) || isDummyOrCorrupted(v.doctor, v.id) || isCorruptedText(v.visit_uid)) {
        return false;
      }
      return true;
    });

    setStore('visits', clean);
    return before - clean.length;
  },

  async purgeAllDummyData(hospitalId?: string): Promise<void> {
    cleanCorruptedData();
    // 1. Clean LocalStorage
    const cleanPatients = getStore<Patient>('patients', []).filter((p) => !isDummyOrCorrupted(p.name, p.id));
    const validPatIds = new Set(cleanPatients.map((p) => p.id));
    const cleanVisits = getStore<Visit>('visits', []).filter((v) => validPatIds.has(v.patient_id) && !isDummyOrCorrupted(v.doctor, v.id));
    setStore('patients', cleanPatients);
    setStore('visits', cleanVisits);

    // 2. Clean Supabase
    try {
      for (const dummyName of Array.from(DUMMY_NAMES)) {
        await supabase.from('patients').delete().ilike('name', `%${dummyName}%`);
      }
      await supabase.from('patients').delete().like('id', '33333333%');
      await supabase.from('visits').delete().like('id', '44444444%');
      await supabase.from('review_requests').delete().like('id', '55555555%');
    } catch (err) {
      console.warn('Purge dummy data from Supabase note:', err);
    }
  },

  async createVisit(data: {
    hospital_id: string;
    patient_name: string;
    phone: string;
    department: string;
    doctor: string;
    visit_date?: string;
    whatsapp_consent?: boolean;
    sheet_row_id?: string;
    status?: VisitStatus;
    visit_uid?: string;
  }): Promise<Visit> {
    const patients = getStore<Patient>('patients', []);
    const phoneClean = data.phone.trim();
    const patientName = data.patient_name.trim();

    const visitUid = data.visit_uid || data.sheet_row_id || `V-${Date.now().toString().slice(-4)}`;

    // Look for existing patient with this phone in this PARTICULAR hospital
    let patient = patients.find(
      (p) => p.hospital_id === data.hospital_id && (p.phone === phoneClean || p.name.toLowerCase() === patientName.toLowerCase())
    );

    const existingPatientIds = new Set(patients.map((p) => p.id));
    const readablePatientId = generatePatientId(patientName, visitUid, existingPatientIds);
    const patientId = patient ? patient.id : readablePatientId;

    if (!patient) {
      patient = {
        id: patientId,
        hospital_id: data.hospital_id, // Strictly maintained in this particular hospital
        name: patientName,
        phone: phoneClean,
        whatsapp_consent: data.whatsapp_consent ?? true,
        created_at: new Date().toISOString(),
      };
      setStore('patients', [patient, ...patients.filter((p) => p.id !== patientId)]);
      try {
        const { error } = await supabase.from('patients').upsert({
          id: patient.id,
          hospital_id: patient.hospital_id,
          name: patient.name,
          phone: patient.phone,
          whatsapp_consent: patient.whatsapp_consent,
          created_at: patient.created_at,
        });
        if (error && error.message.includes('type uuid')) {
          const fallbackUuid = toPatientUuid(patient.id);
          patient.id = fallbackUuid;
          await supabase.from('patients').upsert({
            id: fallbackUuid,
            hospital_id: patient.hospital_id,
            name: patient.name,
            phone: patient.phone,
            whatsapp_consent: patient.whatsapp_consent,
            created_at: patient.created_at,
          });
        }
      } catch (err) {
        console.warn('Supabase patient upsert error:', err);
      }
    }

    const visitId = toVisitUuid(visitUid);
    const isoDate = toIsoDate(data.visit_date);
    const token = `rb-${visitUid.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    const rawStatus = (data.status || 'registered').toLowerCase();
    const supabaseStatus: VisitStatus = rawStatus === 'completed' ? 'completed' : 'registered';

    const newVisit: Visit = {
      id: visitId,
      hospital_id: data.hospital_id,
      patient_id: patient.id,
      department: data.department || 'General Medicine',
      doctor: data.doctor || 'Duty Medical Officer',
      visit_date: isoDate,
      status: supabaseStatus,
      sheet_row_id: visitUid,
      visit_uid: visitUid,
      token,
      created_at: new Date().toISOString(),
    };

    const visits = getStore<Visit>('visits', []);
    setStore('visits', [newVisit, ...visits.filter((v) => v.id !== visitId && v.visit_uid !== visitUid)]);

    try {
      await supabase.from('visits').upsert({
        id: newVisit.id,
        hospital_id: newVisit.hospital_id,
        patient_id: newVisit.patient_id,
        department: newVisit.department,
        doctor: newVisit.doctor,
        visit_date: newVisit.visit_date,
        status: newVisit.status,
        sheet_row_id: newVisit.sheet_row_id,
        visit_uid: newVisit.visit_uid,
        token: newVisit.token,
        created_at: newVisit.created_at,
      });
    } catch (err) {
      console.warn('Supabase visit upsert error:', err);
    }

    return {
      ...newVisit,
      patient,
    };
  },

  async markVisitComplete(
    visitId: string,
    webhookUrl?: string
  ): Promise<{ visit: Visit; reviewRequest: ReviewRequest; webhookFired: boolean }> {
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const visitIdx = visits.findIndex((v) => v.id === visitId);

    if (visitIdx === -1) {
      throw new Error(`Visit ${visitId} not found`);
    }

    // Update status
    visits[visitIdx].status = 'completed';
    setStore('visits', visits);

    const updatedVisit = visits[visitIdx];
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const patient = patients.find((p) => p.id === updatedVisit.patient_id);
    const hospital = hospitals.find((h) => h.id === updatedVisit.hospital_id);

    // Queue WhatsApp Review Request
    const reviewRequests = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );
    let reviewReq = reviewRequests.find((r) => r.visit_id === visitId);

    if (!reviewReq) {
      reviewReq = {
        id: crypto.randomUUID(),
        hospital_id: updatedVisit.hospital_id,
        visit_id: visitId,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'sent',
        rating: null,
        feedback_text: null,
        review_channel: 'whatsapp',
        submitted_at: null,
        created_at: new Date().toISOString(),
      };
      setStore('review_requests', [reviewReq, ...reviewRequests]);

      try {
        await supabase.from('review_requests').insert(reviewReq);
      } catch {}
    }

    // Trigger Webhook to Make.com / WhatsApp Automation if configured
    let webhookFired = false;
    const targetWebhook =
      webhookUrl ||
      localStorage.getItem('rb_make_webhook_url') ||
      '';

    if (targetWebhook) {
      try {
        fetch(targetWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'visit_completed',
            hospital: {
              id: hospital?.id,
              name: hospital?.name,
              google_place_id: hospital?.google_place_id,
              template_name: hospital?.whatsapp_template_name,
            },
            patient: {
              name: patient?.name,
              phone: patient?.phone,
              consent: patient?.whatsapp_consent,
            },
            visit: {
              id: updatedVisit.id,
              department: updatedVisit.department,
              doctor: updatedVisit.doctor,
              visit_date: updatedVisit.visit_date,
              token: updatedVisit.token,
              review_url: `${window.location.origin}/review?token=${updatedVisit.token}`,
            },
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) => console.log('Webhook dispatched (async):', err));
        webhookFired = true;
      } catch (err) {
        console.warn('Webhook trigger error:', err);
      }
    }

    return {
      visit: {
        ...updatedVisit,
        patient,
        hospital,
      },
      reviewRequest: reviewReq,
      webhookFired,
    };
  },

  // ── WhatsApp 1-Time Direct Review Flow (Anti-Spam Flag Protection) ─────────
  async sendWhatsAppReview(params: {
    hospitalId: string;
    visitId: string;
    customTemplate?: string;
  }): Promise<{
    success: boolean;
    skipped?: boolean;
    reason?: string;
    messageContent: string;
    patientName: string;
    phone: string;
  }> {
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);

    const visit = visits.find((v) => v.id === params.visitId);
    if (!visit) throw new Error('Visit not found');

    const patient = patients.find((p) => p.id === visit.patient_id);
    if (!patient) throw new Error('Patient not found');

    const hospital = hospitals.find((h) => h.id === params.hospitalId) || {
      name: 'Hospital',
    };

    // 1-TIME ANTI-SPAM LOCK:
    // If the patient was already sent a review previously, DO NOT SEND AGAIN!
    if (patient.review_sent) {
      return {
        success: false,
        skipped: true,
        reason: 'Patient has already received a review request previously (1-Time Anti-Spam Protected).',
        messageContent: patient.last_message_content || '',
        patientName: patient.name,
        phone: patient.phone,
      };
    }

    // Build the personalized WhatsApp template
    const template = params.customTemplate || WHATSAPP_REVIEW_TEMPLATE;
    const personalizedMessage = template
      .replace(/\[Patient Name\]/gi, patient.name)
      .replace(/\[Hospital Name\]/gi, hospital.name);

    // Update Patient Flag in database: marked sent so future visits NEVER re-spam
    patient.review_sent = true;
    patient.review_sent_at = new Date().toISOString();
    patient.last_message_content = personalizedMessage;
    setStore('patients', patients);

    // Update Visit in database
    visit.status = 'completed';
    visit.review_requested = true;
    setStore('visits', visits);

    // Queue / Record Review Request in database
    const reviewRequests = getStore<ReviewRequest>('review_requests', SEED_REVIEW_REQUESTS);
    const existingReq = reviewRequests.find((r) => r.visit_id === visit.id);
    if (existingReq) {
      existingReq.whatsapp_status = 'sent';
      existingReq.sent_at = new Date().toISOString();
      existingReq.message_template = personalizedMessage;
    } else {
      reviewRequests.push({
        id: crypto.randomUUID(),
        hospital_id: params.hospitalId,
        visit_id: visit.id,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'sent',
        message_template: personalizedMessage,
        rating: null,
        feedback_text: null,
        review_channel: 'whatsapp',
        submitted_at: null,
        created_at: new Date().toISOString(),
      });
    }
    setStore('review_requests', reviewRequests);

    // Try Supabase updates
    try {
      await supabase.from('patients').upsert({
        id: patient.id,
        hospital_id: patient.hospital_id,
        name: patient.name,
        phone: patient.phone,
        whatsapp_consent: patient.whatsapp_consent,
      });
    } catch {}

    return {
      success: true,
      skipped: false,
      messageContent: personalizedMessage,
      patientName: patient.name,
      phone: patient.phone,
    };
  },

  async sendAllPendingWhatsAppReviews(params: {
    hospitalId: string;
    customTemplate?: string;
  }): Promise<{
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
  }> {
    const visits = await this.getVisits(params.hospitalId);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    let sentCount = 0;
    let skippedCount = 0;
    const details = [];
    const processedPatientIds = new Set<string>();

    for (const v of visits) {
      const patient = patientMap.get(v.patient_id);
      if (!patient) continue;

      // Anti-Spam: Check if already sent in this batch or previously in the database
      if (processedPatientIds.has(patient.id) || patient.review_sent) {
        skippedCount++;
        details.push({
          patientName: patient.name,
          phone: patient.phone,
          status: 'skipped' as const,
          reason: 'Already received a review previously (1-Time Anti-Spam Protected)',
          message: patient.last_message_content || '',
        });
        continue;
      }

      processedPatientIds.add(patient.id);

      const res = await this.sendWhatsAppReview({
        hospitalId: params.hospitalId,
        visitId: v.id,
        customTemplate: params.customTemplate,
      });

      if (res.success && !res.skipped) {
        sentCount++;
        details.push({
          patientName: patient.name,
          phone: patient.phone,
          status: 'sent' as const,
          message: res.messageContent,
        });
      } else {
        skippedCount++;
        details.push({
          patientName: patient.name,
          phone: patient.phone,
          status: 'skipped' as const,
          reason: res.reason,
          message: '',
        });
      }
    }

    return {
      totalProcessed: visits.length,
      sentCount,
      skippedCount,
      details,
    };
  },

  async getReviews(hospitalId?: string): Promise<ReviewRequest[]> {
    const reviews = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );
    if (!hospitalId) return reviews;
    return reviews.filter((r) => r.hospital_id === hospitalId);
  },

  // ── Public Review Flow ────────────────────────────────────────────────────
  async getVisitByToken(tokenOrId: string): Promise<Visit | null> {
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const reviews = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );

    const visit = visits.find(
      (v) => v.token === tokenOrId || v.id === tokenOrId
    );
    if (!visit) return null;

    return {
      ...visit,
      patient: patients.find((p) => p.id === visit.patient_id),
      hospital: hospitals.find((h) => h.id === visit.hospital_id),
      review_request: reviews.find((r) => r.visit_id === visit.id),
    };
  },

  async submitReview(params: {
    tokenOrId: string;
    rating: number;
    feedbackText?: string;
  }): Promise<{
    success: boolean;
    redirectUrl?: string;
    isLowRating: boolean;
  }> {
    const visit = await this.getVisitByToken(params.tokenOrId);
    if (!visit) {
      throw new Error('Visit not found');
    }

    const reviewRequests = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );
    const reqIdx = reviewRequests.findIndex((r) => r.visit_id === visit.id);

    const isHighRating = params.rating >= 4;
    const isLowRating = params.rating <= 3;

    if (reqIdx !== -1) {
      reviewRequests[reqIdx].rating = params.rating;
      reviewRequests[reqIdx].feedback_text = params.feedbackText || null;
      reviewRequests[reqIdx].submitted_at = new Date().toISOString();
      reviewRequests[reqIdx].whatsapp_status = 'read';
    } else {
      reviewRequests.push({
        id: crypto.randomUUID(),
        hospital_id: visit.hospital_id,
        visit_id: visit.id,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'read',
        rating: params.rating,
        feedback_text: params.feedbackText || null,
        review_channel: 'whatsapp',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    setStore('review_requests', reviewRequests);

    try {
      await supabase
        .from('review_requests')
        .upsert({
          hospital_id: visit.hospital_id,
          visit_id: visit.id,
          rating: params.rating,
          feedback_text: params.feedbackText || null,
          submitted_at: new Date().toISOString(),
          whatsapp_status: 'read',
        });
    } catch {}

    const googlePlaceId = visit.hospital?.google_place_id;
    const redirectUrl = isHighRating
      ? `https://search.google.com/local/writereview?placeid=${googlePlaceId || 'ChIJN1t_tDeuEmsRUsoyG83frY4'}`
      : undefined;

    return {
      success: true,
      redirectUrl,
      isLowRating,
    };
  },

  // ── Sheet Connection, Backfill & Delta Sync Engine (Part A & B) ───────────

  async getSheetConnection(hospitalId: string): Promise<HospitalSheetConnection | null> {
    const list = await this.getSheetConnections(hospitalId);
    return list.find((c) => c.status === 'active') || list[0] || null;
  },

  async getSheetConnections(hospitalId: string): Promise<HospitalSheetConnection[]> {
    const list = getStore<HospitalSheetConnection>('sheet_connections', [
      {
        id: 'conn-citycare-01',
        hospital_id: '11111111-1111-1111-1111-111111111111',
        sheet_type: 'google_sheets',
        sheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        table_name: 'PatientVisits_2026',
        column_mapping: {
          visit_uid: 'visit_uid',
          patient_name: 'patient_name',
          phone: 'phone',
          visit_date: 'visit_date',
          department: 'department',
          doctor: 'doctor',
          status: 'status',
        },
        status: 'active',
        last_synced_at: new Date(Date.now() - 10 * 60000).toISOString(),
        total_rows_tracked: 4,
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
    ]);
    return list.filter((c) => c.hospital_id === hospitalId);
  },

  async updateVisitRating(visitId: string, rating: number, feedbackText?: string): Promise<void> {
    const reviewRequests = getStore<ReviewRequest>('review_requests', SEED_REVIEW_REQUESTS);
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const visit = visits.find((v) => v.id === visitId);

    const reqIdx = reviewRequests.findIndex((r) => r.visit_id === visitId);
    if (reqIdx !== -1) {
      reviewRequests[reqIdx].rating = rating;
      if (feedbackText) reviewRequests[reqIdx].feedback_text = feedbackText;
      reviewRequests[reqIdx].submitted_at = new Date().toISOString();
      reviewRequests[reqIdx].whatsapp_status = 'read';
    } else if (visit) {
      reviewRequests.push({
        id: crypto.randomUUID(),
        hospital_id: visit.hospital_id,
        visit_id: visit.id,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'read',
        rating,
        feedback_text: feedbackText || null,
        review_channel: 'whatsapp',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }
    setStore('review_requests', reviewRequests);
  },

  async saveSheetConnection(data: {
    hospital_id: string;
    sheet_type: 'google_sheets' | 'excel_365' | 'onedrive' | 'google_forms';
    sheet_id: string;
    table_name: string;
    column_mapping: ColumnMapping;
    total_rows_tracked?: number;
    id?: string;
  }): Promise<HospitalSheetConnection> {
    const list = getStore<HospitalSheetConnection>('sheet_connections', []);
    const existingIdx = data.id
      ? list.findIndex((c) => c.id === data.id)
      : list.findIndex((c) => c.hospital_id === data.hospital_id && c.sheet_id === data.sheet_id);

    const connection: HospitalSheetConnection = {
      ...data,
      id: existingIdx !== -1 ? list[existingIdx].id : crypto.randomUUID(),
      status: 'active',
      last_synced_at: new Date().toISOString(),
      total_rows_tracked:
        data.total_rows_tracked !== undefined
          ? data.total_rows_tracked
          : existingIdx !== -1
          ? list[existingIdx].total_rows_tracked
          : 0,
      created_at: existingIdx !== -1 ? list[existingIdx].created_at : new Date().toISOString(),
    };

    if (existingIdx !== -1) {
      list[existingIdx] = connection;
    } else {
      list.push(connection);
    }
    setStore('sheet_connections', list);

    try {
      await supabase.from('hospital_sheet_connections').upsert(connection);
    } catch {}

    return connection;
  },

  async ingestGoogleFormResponse(data: {
    hospital_id: string;
    patient_name: string;
    phone: string;
    doctor: string;
    visit_date: string;
    department?: string;
  }): Promise<{ patient: Patient; visit: Visit }> {
    const hospitalId = data.hospital_id;
    const cleanName = data.patient_name.trim();
    let rawPhone = data.phone.trim().replace(/\s+/g, '');
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`;
    const doctor = data.doctor.trim() || 'Dr. Ramesh Kumar';
    const department = data.department?.trim() || 'General Consultation';
    const visitDate = toIsoDate(data.visit_date);

    const visitUid = `GF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const patients = getStore<Patient>('patients', []);
    let patient = patients.find(
      (p) => p.hospital_id === hospitalId && (p.phone === phone || p.name.toLowerCase() === cleanName.toLowerCase())
    );

    const existingPatientIds = new Set(patients.map((p) => p.id));
    const readablePatientId = generatePatientId(cleanName, visitUid, existingPatientIds);

    if (!patient) {
      patient = {
        id: readablePatientId,
        hospital_id: hospitalId,
        name: cleanName,
        phone,
        whatsapp_consent: true,
        created_at: new Date().toISOString(),
      };
      setStore('patients', [patient, ...patients.filter((p) => p.id !== readablePatientId)]);
      try {
        const { error } = await supabase.from('patients').upsert({
          id: patient.id,
          hospital_id: patient.hospital_id,
          name: patient.name,
          phone: patient.phone,
          whatsapp_consent: patient.whatsapp_consent,
          created_at: patient.created_at,
        });
        if (error && error.message.includes('type uuid')) {
          const fallbackUuid = toPatientUuid(patient.id);
          patient.id = fallbackUuid;
          await supabase.from('patients').upsert({
            id: fallbackUuid,
            hospital_id: patient.hospital_id,
            name: patient.name,
            phone: patient.phone,
            whatsapp_consent: patient.whatsapp_consent,
            created_at: patient.created_at,
          });
        }
      } catch (err) {
        console.warn('Supabase patient upsert error:', err);
      }
    } else {
      patient.name = cleanName;
      patient.phone = phone;
    }

    const visitId = toVisitUuid(visitUid);
    const token = `rb-gf-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    const newVisit: Visit = {
      id: visitId,
      hospital_id: hospitalId,
      patient_id: patient.id,
      department,
      doctor,
      visit_date: visitDate,
      status: 'pending',
      sheet_row_id: visitUid,
      visit_uid: visitUid,
      token,
      created_at: new Date().toISOString(),
    };

    const visits = getStore<Visit>('visits', []);
    setStore('visits', [newVisit, ...visits.filter((v) => v.id !== visitId && v.visit_uid !== visitUid)]);

    try {
      await supabase.from('visits').upsert({
        id: newVisit.id,
        hospital_id: newVisit.hospital_id,
        patient_id: newVisit.patient_id,
        department: newVisit.department,
        doctor: newVisit.doctor,
        visit_date: newVisit.visit_date,
        status: 'registered',
        sheet_row_id: newVisit.sheet_row_id,
        visit_uid: newVisit.visit_uid,
        token: newVisit.token,
        created_at: newVisit.created_at,
      });
    } catch (err) {
      console.warn('Supabase visit upsert error:', err);
    }

    const conns = getStore<HospitalSheetConnection>('sheet_connections', []);
    const gfConn = conns.find((c) => c.hospital_id === hospitalId && c.sheet_type === 'google_forms');
    if (gfConn) {
      gfConn.total_rows_tracked = (gfConn.total_rows_tracked || 0) + 1;
      gfConn.last_synced_at = new Date().toISOString();
      setStore('sheet_connections', conns);
      try {
        await supabase.from('hospital_sheet_connections').upsert(gfConn);
      } catch {}
    }

    return { patient, visit: newVisit };
  },

  async disconnectSheet(hospitalId: string): Promise<void> {
    const list = getStore<HospitalSheetConnection>('sheet_connections', []);
    const idx = list.findIndex((c) => c.hospital_id === hospitalId);
    if (idx !== -1) {
      list[idx].status = 'disconnected';
      setStore('sheet_connections', list);
      try {
        await supabase
          .from('hospital_sheet_connections')
          .update({ status: 'disconnected' })
          .eq('hospital_id', hospitalId);
      } catch {}
    }
  },

  // Compute a deterministic hash representing the row's values
  computeRowHash(data: {
    visit_uid: string;
    patient_name: string;
    phone: string;
    visit_date: string;
    department: string;
    doctor: string;
    status: string;
  }): string {
    const str = `${data.visit_uid}|${data.patient_name.trim().toLowerCase()}|${data.phone.trim()}|${data.visit_date}|${data.department.trim().toLowerCase()}|${data.doctor.trim().toLowerCase()}|${data.status.trim().toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  },

  // Part A Step 4: Dry Run and Preview before importing
  async previewSheetImport(
    hospitalId: string,
    rawRows: Record<string, any>[],
    mapping: ColumnMapping
  ): Promise<{
    previewRows: Array<{
      rowNumber: number;
      visit_uid: string;
      patient_name: string;
      phone: string;
      visit_date: string;
      department: string;
      doctor: string;
      status: string;
      isValid: boolean;
      errorReason?: string;
    }>;
    totalRows: number;
    validCount: number;
    errorCount: number;
  }> {
    const existingVisits = await this.getVisits(hospitalId);
    const existingUids = new Set(existingVisits.map((v) => v.visit_uid).filter(Boolean));
    const seenUidsInSheet = new Set<string>();

    const previewList = [];
    let validCount = 0;
    let errorCount = 0;

    const sampleLimit = Math.min(rawRows.length, 50);

    for (let i = 0; i < sampleLimit; i++) {
      const raw = rawRows[i];
      const visit_uid = String(raw[mapping.visit_uid] || '').trim();
      const patient_name = String(raw[mapping.patient_name] || '').trim();
      const rawPhone = String(raw[mapping.phone] || '').trim();
      const visit_date = String(raw[mapping.visit_date] || '').trim() || new Date().toISOString().split('T')[0];
      const department = String(raw[mapping.department] || '').trim() || 'General Medicine';
      const doctor = String(raw[mapping.doctor] || '').trim() || 'Duty Medical Officer';
      const status = String(raw[mapping.status] || '').trim().toLowerCase() || 'registered';

      let isValid = true;
      let errorReason: string | undefined;

      // Validate unique business ID
      if (!visit_uid) {
        isValid = false;
        errorReason = 'Missing visit_uid (e.g. H12-2026-000451 required).';
      } else if (seenUidsInSheet.has(visit_uid)) {
        isValid = false;
        errorReason = `Duplicate visit_uid "${visit_uid}" found within sheet.`;
      } else {
        seenUidsInSheet.add(visit_uid);
      }

      // Validate patient name
      if (isValid && !patient_name) {
        isValid = false;
        errorReason = 'Missing patient name.';
      }

      // Validate phone
      const cleanedPhone = rawPhone.replace(/\s+/g, '');
      if (isValid && (!cleanedPhone || cleanedPhone.length < 10)) {
        isValid = false;
        errorReason = `Invalid phone number "${rawPhone}". Must include country code and valid digits.`;
      }

      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      previewList.push({
        rowNumber: i + 1,
        visit_uid: visit_uid || `ROW-${i + 1}`,
        patient_name: patient_name || '—',
        phone: cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone}`,
        visit_date,
        department,
        doctor,
        status: ['completed', 'registered', 'in_consultation'].includes(status) ? status : 'registered',
        isValid,
        errorReason,
      });
    }

    return {
      previewRows: previewList,
      totalRows: rawRows.length,
      validCount,
      errorCount,
    };
  },

  // Part A Step 5 & 6: Run Initial Import (Backfill with historical = true)
  async runInitialBackfill(
    hospitalId: string,
    rawRows: Record<string, any>[],
    mapping: ColumnMapping
  ): Promise<{
    syncRun: SyncRun;
    importedCount: number;
    rejectedCount: number;
    errors: string[];
  }> {
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    const syncErrors: SyncError[] = [];

    let importedCount = 0;
    let rejectedCount = 0;

    const visits = getStore<Visit>('visits', []);
    const patients = getStore<Patient>('patients', []);

    const existingUidSet = new Set(
      visits.filter((v) => v.hospital_id === hospitalId).map((v) => v.visit_uid).filter(Boolean)
    );
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const visit_uid = String(raw[mapping.visit_uid] || '').trim();
      const patient_name = String(raw[mapping.patient_name] || '').trim();
      const rawPhone = String(raw[mapping.phone] || '').trim();
      const visit_date = String(raw[mapping.visit_date] || '').trim() || new Date().toISOString().split('T')[0];
      const department = String(raw[mapping.department] || '').trim() || 'General Medicine';
      const doctor = String(raw[mapping.doctor] || '').trim() || 'Duty Medical Officer';
      const rawStatus = String(raw[mapping.status] || '').trim().toLowerCase();
      const status: VisitStatus = ['completed', 'registered', 'in_consultation'].includes(rawStatus)
        ? (rawStatus as VisitStatus)
        : 'registered';

      if (!visit_uid) {
        rejectedCount++;
        const msg = `Row ${i + 1}: Missing unique visit_uid.`;
        errors.push(msg);
        syncErrors.push({ id: crypto.randomUUID(), sync_run_id: runId, hospital_id: hospitalId, row_reference: `Row ${i + 1}`, reason: msg, created_at: new Date().toISOString() });
        continue;
      }

      if (seenInBatch.has(visit_uid)) {
        rejectedCount++;
        const msg = `Row ${i + 1}: Duplicate visit_uid "${visit_uid}" in batch.`;
        errors.push(msg);
        syncErrors.push({ id: crypto.randomUUID(), sync_run_id: runId, hospital_id: hospitalId, row_reference: visit_uid, reason: msg, created_at: new Date().toISOString() });
        continue;
      }

      const cleanedPhone = rawPhone.replace(/\s+/g, '');
      if (!cleanedPhone || cleanedPhone.length < 10) {
        rejectedCount++;
        const msg = `Row ${i + 1} (${patient_name}): Invalid phone number "${rawPhone}".`;
        errors.push(msg);
        syncErrors.push({ id: crypto.randomUUID(), sync_run_id: runId, hospital_id: hospitalId, row_reference: visit_uid, reason: msg, created_at: new Date().toISOString() });
        continue;
      }

      const phoneWithCode = cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone}`;

      const existingPatientIds = new Set(patients.map((p) => p.id));
      const readablePatientId = generatePatientId(patient_name, visit_uid, existingPatientIds);

      // Check or create patient strictly for THIS particular hospital
      let patient = patients.find(
        (p) => p.hospital_id === hospitalId && (p.phone === phoneWithCode || p.name.toLowerCase() === patient_name.toLowerCase())
      );
      if (!patient) {
        patient = {
          id: readablePatientId,
          hospital_id: hospitalId, // strictly maintained in this particular hospital
          name: patient_name || 'Patient',
          phone: phoneWithCode,
          whatsapp_consent: true,
          created_at: new Date().toISOString(),
        };
        patients.push(patient);
      } else {
        patient.name = patient_name;
        patient.phone = phoneWithCode;
      }

      // Upsert directly to Supabase patients table (without dropping any patient!)
      try {
        const { error: pErr } = await supabase.from('patients').upsert({
          id: patient.id,
          hospital_id: patient.hospital_id,
          name: patient.name,
          phone: patient.phone,
          whatsapp_consent: patient.whatsapp_consent,
          created_at: patient.created_at || new Date().toISOString(),
        });
        if (pErr && pErr.message.includes('type uuid')) {
          const fallbackUuid = toPatientUuid(patient.id);
          patient.id = fallbackUuid;
          await supabase.from('patients').upsert({
            id: fallbackUuid,
            hospital_id: patient.hospital_id,
            name: patient.name,
            phone: patient.phone,
            whatsapp_consent: patient.whatsapp_consent,
            created_at: patient.created_at || new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn(`Supabase patient upsert error for ${patient.name}:`, err?.message);
      }

      const rowHash = this.computeRowHash({
        visit_uid,
        patient_name: patient.name,
        phone: phoneWithCode,
        visit_date,
        department,
        doctor,
        status,
      });

      const vId = toVisitUuid(visit_uid);
      const isoDate = toIsoDate(visit_date);
      const supabaseStatus: VisitStatus = status === 'completed' ? 'completed' : 'registered';

      const newVisit: Visit = {
        id: vId,
        hospital_id: hospitalId,
        patient_id: patient.id,
        department,
        doctor,
        visit_date: isoDate,
        status: supabaseStatus,
        visit_uid,
        sheet_row_id: visit_uid,
        row_hash: rowHash,
        historical: false,
        review_requested: false,
        deleted_at: null,
        token: `rb-${visit_uid.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: new Date().toISOString(),
      };

      // Upsert directly to Supabase visits table
      try {
        await supabase.from('visits').upsert({
          id: newVisit.id,
          hospital_id: newVisit.hospital_id,
          patient_id: newVisit.patient_id,
          department: newVisit.department,
          doctor: newVisit.doctor,
          visit_date: newVisit.visit_date,
          status: newVisit.status,
          sheet_row_id: newVisit.sheet_row_id,
          visit_uid: newVisit.visit_uid,
          token: newVisit.token,
          created_at: newVisit.created_at,
        });
      } catch (err: any) {
        console.warn(`Supabase visit upsert error for ${visit_uid}:`, err?.message);
      }

      const exIdx = visits.findIndex((v) => v.id === newVisit.id || v.visit_uid === newVisit.visit_uid);
      if (exIdx !== -1) {
        visits[exIdx] = newVisit;
      } else {
        visits.unshift(newVisit);
      }

      seenInBatch.add(visit_uid);
      existingUidSet.add(visit_uid);
      importedCount++;
    }

    setStore('patients', patients);
    setStore('visits', visits);

    // Save Sync Errors
    const allErrors = getStore<SyncError>('sync_errors', []);
    setStore('sync_errors', [...syncErrors, ...allErrors]);

    // Create Sync Run
    const syncRun: SyncRun = {
      id: runId,
      hospital_id: hospitalId,
      sync_type: 'initial_backfill',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      rows_added: importedCount,
      rows_updated: 0,
      rows_rejected: rejectedCount,
      status: rejectedCount === 0 ? 'success' : 'partial',
    };

    const allRuns = getStore<SyncRun>('sync_runs', []);
    setStore('sync_runs', [syncRun, ...allRuns]);

    // Update connection status
    await this.saveSheetConnection({
      hospital_id: hospitalId,
      sheet_type: 'google_sheets',
      sheet_id: 'active_sheet',
      table_name: 'PatientVisits',
      column_mapping: mapping,
    });

    return {
      syncRun,
      importedCount,
      rejectedCount,
      errors,
    };
  },

  // Part B Step 8 & 9: Scheduled / Manual Delta Sync (Compares row hashes)
  async runDeltaSync(
    hospitalId: string,
    rawRows: Record<string, any>[],
    mapping?: ColumnMapping
  ): Promise<{
    syncRun: SyncRun;
    added: number;
    updated: number;
    unchanged: number;
    deleted: number;
    reviewDispatchedCount: number;
    errors: string[];
  }> {
    const conn = await this.getSheetConnection(hospitalId);
    const activeMapping = mapping || conn?.column_mapping || {
      visit_uid: 'visit_uid',
      patient_name: 'patient_name',
      phone: 'phone',
      visit_date: 'visit_date',
      department: 'department',
      doctor: 'doctor',
      status: 'status',
    };

    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    const syncErrors: SyncError[] = [];

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let deleted = 0;
    let reviewDispatchedCount = 0;

    const visits = getStore<Visit>('visits', []);
    const patients = getStore<Patient>('patients', []);

    const sheetUids = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const visit_uid = String(raw[activeMapping.visit_uid] || '').trim();
      const patient_name = String(raw[activeMapping.patient_name] || '').trim();
      const rawPhone = String(raw[activeMapping.phone] || '').trim();
      const visit_date = String(raw[activeMapping.visit_date] || '').trim() || new Date().toISOString().split('T')[0];
      const department = String(raw[activeMapping.department] || '').trim() || 'General Medicine';
      const doctor = String(raw[activeMapping.doctor] || '').trim() || 'Duty Medical Officer';
      const rawStatus = String(raw[activeMapping.status] || '').trim().toLowerCase();
      const status: VisitStatus = ['completed', 'registered', 'in_consultation'].includes(rawStatus)
        ? (rawStatus as VisitStatus)
        : 'registered';

      if (!visit_uid) {
        errors.push(`Row ${i + 1}: Missing visit_uid`);
        continue;
      }

      sheetUids.add(visit_uid);

      const cleanedPhone = rawPhone.replace(/\s+/g, '');
      const phoneWithCode = cleanedPhone.startsWith('+') ? cleanedPhone : `+91${cleanedPhone}`;

      // Calculate row hash
      const newHash = this.computeRowHash({
        visit_uid,
        patient_name,
        phone: phoneWithCode,
        visit_date,
        department,
        doctor,
        status,
      });

      const existingPatientIds = new Set(patients.map((p) => p.id));
      const readablePatientId = generatePatientId(patient_name, visit_uid, existingPatientIds);

      const vId = toVisitUuid(visit_uid);
      const isoDate = toIsoDate(visit_date);
      const supabaseStatus: VisitStatus = status === 'completed' ? 'completed' : 'registered';

      // Find existing visit by (hospital_id, visit_uid)
      const existingIdx = visits.findIndex(
        (v) => v.hospital_id === hospitalId && (v.visit_uid === visit_uid || v.id === vId) && !v.deleted_at
      );

      if (existingIdx === -1) {
        let patient = patients.find(
          (p) => p.hospital_id === hospitalId && (p.phone === phoneWithCode || p.name.toLowerCase() === patient_name.toLowerCase())
        );
        if (!patient) {
          patient = {
            id: readablePatientId,
            hospital_id: hospitalId, // strictly maintained in this particular hospital
            name: patient_name || 'Patient',
            phone: phoneWithCode,
            whatsapp_consent: true,
            created_at: new Date().toISOString(),
          };
          patients.push(patient);
        }

        try {
          const { error: pErr } = await supabase.from('patients').upsert({
            id: patient.id,
            hospital_id: patient.hospital_id,
            name: patient.name,
            phone: patient.phone,
            whatsapp_consent: patient.whatsapp_consent,
            created_at: patient.created_at || new Date().toISOString(),
          });
          if (pErr && pErr.message.includes('type uuid')) {
            const fallbackUuid = toPatientUuid(patient.id);
            patient.id = fallbackUuid;
            await supabase.from('patients').upsert({
              id: fallbackUuid,
              hospital_id: patient.hospital_id,
              name: patient.name,
              phone: patient.phone,
              whatsapp_consent: patient.whatsapp_consent,
              created_at: patient.created_at || new Date().toISOString(),
            });
          }
        } catch {}

        const newVisit: Visit = {
          id: vId,
          hospital_id: hospitalId,
          patient_id: patient.id,
          department,
          doctor,
          visit_date: isoDate,
          status: supabaseStatus,
          visit_uid,
          sheet_row_id: visit_uid,
          row_hash: newHash,
          historical: false,
          review_requested: false,
          deleted_at: null,
          token: `rb-${visit_uid.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: new Date().toISOString(),
        };

        try {
          await supabase.from('visits').upsert({
            id: newVisit.id,
            hospital_id: newVisit.hospital_id,
            patient_id: newVisit.patient_id,
            department: newVisit.department,
            doctor: newVisit.doctor,
            visit_date: newVisit.visit_date,
            status: newVisit.status,
            sheet_row_id: newVisit.sheet_row_id,
            visit_uid: newVisit.visit_uid,
            token: newVisit.token,
            created_at: newVisit.created_at,
          });
        } catch {}

        visits.unshift(newVisit);
        added++;
      } else {
        const existing = visits[existingIdx];

        if (existing.row_hash === newHash) {
          unchanged++;
        } else {
          existing.department = department;
          existing.doctor = doctor;
          existing.visit_date = isoDate;
          existing.status = supabaseStatus;
          existing.row_hash = newHash;

          try {
            await supabase.from('visits').update({
              department,
              doctor,
              visit_date: isoDate,
              status: supabaseStatus,
            }).eq('id', existing.id);
          } catch {}

          updated++;
        }
      }
    }

    setStore('patients', patients);
    setStore('visits', visits);

    const syncRun: SyncRun = {
      id: runId,
      hospital_id: hospitalId,
      sync_type: 'delta_sync',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      rows_added: added,
      rows_updated: updated,
      rows_rejected: errors.length,
      status: errors.length === 0 ? 'success' : 'partial',
    };

    const allRuns = getStore<SyncRun>('sync_runs', []);
    setStore('sync_runs', [syncRun, ...allRuns]);

    return {
      syncRun,
      added,
      updated,
      unchanged,
      deleted,
      reviewDispatchedCount,
      errors,
    };
  },

  async syncAllLocalRowsToSupabase(
    hospitalId: string,
    rawRows?: Record<string, any>[]
  ): Promise<{ syncedCount: number; errors: string[] }> {
    if (rawRows && rawRows.length > 0) {
      const res = await this.runInitialBackfill(hospitalId, rawRows, {
        visit_uid: 'visit_uid',
        patient_name: 'patient_name',
        phone: 'phone',
        visit_date: 'visit_date',
        department: 'department',
        doctor: 'doctor',
        status: 'status',
      });
      return { syncedCount: res.importedCount, errors: res.errors };
    }

    const visits = getStore<Visit>('visits', []).filter((v) => v.hospital_id === hospitalId && !isDummyOrCorrupted(v.doctor, v.id));
    const patients = getStore<Patient>('patients', []).filter((p) => p.hospital_id === hospitalId && !isDummyOrCorrupted(p.name, p.id));
    const errors: string[] = [];
    let syncedCount = 0;

    for (const p of patients) {
      try {
        await supabase.from('patients').upsert({
          id: p.id,
          hospital_id: p.hospital_id,
          name: p.name,
          phone: p.phone,
          whatsapp_consent: p.whatsapp_consent ?? true,
          created_at: p.created_at || new Date().toISOString(),
        });
      } catch (err: any) {
        errors.push(`Patient ${p.name}: ${err?.message}`);
      }
    }

    for (const v of visits) {
      try {
        const isoDate = toIsoDate(v.visit_date);
        const supabaseStatus = v.status === 'completed' ? 'completed' : 'registered';
        await supabase.from('visits').upsert({
          id: v.id,
          hospital_id: v.hospital_id,
          patient_id: v.patient_id,
          department: v.department,
          doctor: v.doctor,
          visit_date: isoDate,
          status: supabaseStatus,
          sheet_row_id: v.sheet_row_id || v.visit_uid,
          visit_uid: v.visit_uid,
          token: v.token,
          created_at: v.created_at || new Date().toISOString(),
        });
        syncedCount++;
      } catch (err: any) {
        errors.push(`Visit ${v.visit_uid}: ${err?.message}`);
      }
    }

    return { syncedCount, errors };
  },

  async getSyncRuns(hospitalId: string): Promise<SyncRun[]> {
    const runs = getStore<SyncRun>('sync_runs', []);
    return runs.filter((r) => r.hospital_id === hospitalId);
  },

  async getSyncErrors(hospitalId: string): Promise<SyncError[]> {
    const errs = getStore<SyncError>('sync_errors', []);
    return errs.filter((e) => e.hospital_id === hospitalId);
  },

  async syncSheetRows(
    hospitalId: string,
    rows: any[],
    apiKey?: string
  ): Promise<{
    accepted: number;
    rejected: number;
    errors: string[];
  }> {
    const res = await this.runDeltaSync(hospitalId, rows);
    return {
      accepted: res.added + res.updated,
      rejected: res.errors.length,
      errors: res.errors,
    };
  },
};

