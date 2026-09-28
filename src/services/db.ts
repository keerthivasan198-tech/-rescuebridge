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

const SEED_HOSPITALS: Hospital[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'City Care Hospital',
    subdomain: 'citycare',
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    sheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    sheet_type: 'google_sheets',
    logo: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80',
    whatsapp_template_name: 'patient_review_v1',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    sync_status: 'active',
    last_synced: '10 mins ago',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Apex Multi-Specialty Clinic',
    subdomain: 'apex',
    google_place_id: 'ChIJ3S4IddeuEmsRil83y53frY2',
    sheet_id: '1A2b3c4d5e6f7g8h9i0j',
    sheet_type: 'excel_365',
    logo: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=128&q=80',
    whatsapp_template_name: 'patient_review_v1',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    sync_status: 'active',
    last_synced: '25 mins ago',
  },
];

const SEED_USERS: User[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    hospital_id: null,
    name: 'Super Administrator',
    email: 'superadmin@rescuebridge.com',
    role: 'super_admin',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Dr. Ramesh Kumar (Admin)',
    email: 'admin@citycare.com',
    role: 'hospital_admin',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Pooja (Reception Desk)',
    email: 'staff@citycare.com',
    role: 'staff',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    name: 'Dr. Priya V (Apex Admin)',
    email: 'admin@apexclinic.com',
    role: 'hospital_admin',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

const SEED_PATIENTS: Patient[] = [
  {
    id: '33333333-3333-3333-3333-333333333331',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Kavitha Sundaram',
    phone: '+919876543210',
    whatsapp_consent: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333332',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Arun Kumar',
    phone: '+919845012345',
    whatsapp_consent: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Deepa Venkat',
    phone: '+919712345678',
    whatsapp_consent: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333334',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    name: 'Mohammed Farooq',
    phone: '+919988776655',
    whatsapp_consent: true,
  },
];

const SEED_VISITS: Visit[] = [
  {
    id: '44444444-4444-4444-4444-444444444441',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    patient_id: '33333333-3333-3333-3333-333333333331',
    department: 'Cardiology',
    doctor: 'Dr. Ramesh Kumar',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'completed',
    sheet_row_id: 'ROW-101',
    token: 'token-citycare-kavitha-001',
    created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444442',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    patient_id: '33333333-3333-3333-3333-333333333332',
    department: 'General Medicine',
    doctor: 'Dr. S. Anita',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'registered',
    sheet_row_id: 'ROW-102',
    token: 'token-citycare-arun-002',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444443',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    patient_id: '33333333-3333-3333-3333-333333333333',
    department: 'Orthopedics',
    doctor: 'Dr. Rajesh Nathan',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'completed',
    sheet_row_id: 'ROW-103',
    token: 'token-citycare-deepa-003',
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    patient_id: '33333333-3333-3333-3333-333333333334',
    department: 'Pediatrics',
    doctor: 'Dr. Priya V',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'completed',
    sheet_row_id: 'ROW-201',
    token: 'token-apex-farooq-001',
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
];

const SEED_REVIEW_REQUESTS: ReviewRequest[] = [
  {
    id: '55555555-5555-5555-5555-555555555551',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    visit_id: '44444444-4444-4444-4444-444444444441',
    sent_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    whatsapp_status: 'read',
    rating: 5,
    feedback_text: 'Exceptional doctor and warm staff. Very prompt care.',
    review_channel: 'whatsapp',
    submitted_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555553',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    visit_id: '44444444-4444-4444-4444-444444444443',
    sent_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    whatsapp_status: 'read',
    rating: 2,
    feedback_text: 'Waiting time in pharmacy was more than 40 minutes.',
    review_channel: 'whatsapp',
    submitted_at: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
];

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

// ---------------------------------------------------------------------------
// Multi-Tenant Database Client
// ---------------------------------------------------------------------------
export const db = {
  // ── Hospitals ─────────────────────────────────────────────────────────────
  async getHospitals(): Promise<Hospital[]> {
    try {
      const { data, error } = await supabase.from('hospitals').select('*');
      if (!error && data && data.length > 0) {
        return data as Hospital[];
      }
    } catch {
      // Fall through to local fallback
    }
    return getStore<Hospital>('hospitals', SEED_HOSPITALS);
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
    const newHospital: Hospital = {
      ...hospitalData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      sync_status: 'active',
      last_synced: 'Just now',
    };

    // Try Supabase first
    try {
      await supabase.from('hospitals').insert(newHospital);
    } catch {
      // Supabase table not created yet; stored locally
    }

    const current = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const updated = [newHospital, ...current];
    setStore('hospitals', updated);

    // Create first hospital admin if provided
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

  // ── Users ─────────────────────────────────────────────────────────────────
  async getUsers(hospitalId?: string | null): Promise<User[]> {
    let users = getStore<User>('users', SEED_USERS);
    try {
      let query = supabase.from('users').select('*');
      if (hospitalId) {
        query = query.eq('hospital_id', hospitalId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        users = data as User[];
      }
    } catch {
      // Fallback
    }

    if (!hospitalId) return users;
    return users.filter(
      (u) => u.hospital_id === hospitalId || u.role === 'super_admin'
    );
  },

  async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const newUser: User = {
      ...userData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from('users').insert(newUser);
    } catch {}

    const users = getStore<User>('users', SEED_USERS);
    setStore('users', [newUser, ...users]);
    return newUser;
  },

  // ── Visits & Patients ─────────────────────────────────────────────────────
  async getVisits(
    hospitalId?: string | null,
    filters?: {
      department?: string;
      doctor?: string;
      status?: string;
      date?: string;
    }
  ): Promise<Visit[]> {
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const reviews = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );

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
    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter((v) => v.status === filters.status);
    }
    if (filters?.date) {
      filtered = filtered.filter((v) => v.visit_date === filters.date);
    }

    // Hydrate with patient, hospital, review_request
    return filtered.map((v) => ({
      ...v,
      patient: patients.find((p) => p.id === v.patient_id),
      hospital: hospitals.find((h) => h.id === v.hospital_id),
      review_request: reviews.find((r) => r.visit_id === v.id),
    }));
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
  }): Promise<Visit> {
    const patients = getStore<Patient>('patients', SEED_PATIENTS);

    // Look for existing patient with this phone in this hospital
    let patient = patients.find(
      (p) => p.hospital_id === data.hospital_id && p.phone === data.phone
    );

    if (!patient) {
      patient = {
        id: crypto.randomUUID(),
        hospital_id: data.hospital_id,
        name: data.patient_name,
        phone: data.phone,
        whatsapp_consent: data.whatsapp_consent ?? true,
        created_at: new Date().toISOString(),
      };
      setStore('patients', [patient, ...patients]);
      try {
        await supabase.from('patients').insert(patient);
      } catch {}
    }

    const token = `rb-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    const newVisit: Visit = {
      id: crypto.randomUUID(),
      hospital_id: data.hospital_id,
      patient_id: patient.id,
      department: data.department,
      doctor: data.doctor,
      visit_date: data.visit_date || new Date().toISOString().split('T')[0],
      status: 'registered',
      sheet_row_id: data.sheet_row_id || null,
      token,
      created_at: new Date().toISOString(),
    };

    const visits = getStore<Visit>('visits', SEED_VISITS);
    setStore('visits', [newVisit, ...visits]);

    try {
      await supabase.from('visits').insert(newVisit);
    } catch {}

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
    return list.find((c) => c.hospital_id === hospitalId) || null;
  },

  async saveSheetConnection(data: {
    hospital_id: string;
    sheet_type: 'google_sheets' | 'excel_365' | 'onedrive';
    sheet_id: string;
    table_name: string;
    column_mapping: ColumnMapping;
  }): Promise<HospitalSheetConnection> {
    const list = getStore<HospitalSheetConnection>('sheet_connections', []);
    const existingIdx = list.findIndex((c) => c.hospital_id === data.hospital_id);

    const connection: HospitalSheetConnection = {
      ...data,
      id: existingIdx !== -1 ? list[existingIdx].id : crypto.randomUUID(),
      status: 'active',
      last_synced_at: new Date().toISOString(),
      total_rows_tracked: existingIdx !== -1 ? list[existingIdx].total_rows_tracked : 0,
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

    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);

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

      if (seenInBatch.has(visit_uid) || existingUidSet.has(visit_uid)) {
        rejectedCount++;
        const msg = `Row ${i + 1}: Duplicate visit_uid "${visit_uid}".`;
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

      // Check or create patient
      let patient = patients.find((p) => p.hospital_id === hospitalId && p.phone === phoneWithCode);
      if (!patient) {
        patient = {
          id: crypto.randomUUID(),
          hospital_id: hospitalId,
          name: patient_name || 'Patient',
          phone: phoneWithCode,
          whatsapp_consent: true,
          created_at: new Date().toISOString(),
        };
        patients.push(patient);
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

      // Crucial Step 5: Mark historical = true so past patients NEVER get spammed!
      const newVisit: Visit = {
        id: crypto.randomUUID(),
        hospital_id: hospitalId,
        patient_id: patient.id,
        department,
        doctor,
        visit_date,
        status,
        visit_uid,
        sheet_row_id: visit_uid,
        row_hash: rowHash,
        historical: true,               // Historical flag prevents review dispatch
        review_requested: false,
        deleted_at: null,
        token: `rb-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
        created_at: new Date().toISOString(),
      };

      visits.unshift(newVisit);
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

    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);

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

      // Find existing visit by (hospital_id, visit_uid)
      const existingIdx = visits.findIndex(
        (v) => v.hospital_id === hospitalId && v.visit_uid === visit_uid && !v.deleted_at
      );

      if (existingIdx === -1) {
        // CASE 1: visit_uid not in database -> INSERT AS NEW VISIT (historical = false)
        let patient = patients.find((p) => p.hospital_id === hospitalId && p.phone === phoneWithCode);
        if (!patient) {
          patient = {
            id: crypto.randomUUID(),
            hospital_id: hospitalId,
            name: patient_name || 'Patient',
            phone: phoneWithCode,
            whatsapp_consent: true,
            created_at: new Date().toISOString(),
          };
          patients.push(patient);
        }

        const newVisit: Visit = {
          id: crypto.randomUUID(),
          hospital_id: hospitalId,
          patient_id: patient.id,
          department,
          doctor,
          visit_date,
          status,
          visit_uid,
          sheet_row_id: visit_uid,
          row_hash: newHash,
          historical: false,              // NEW VISIT: eligible for review request!
          review_requested: false,
          deleted_at: null,
          token: `rb-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
          created_at: new Date().toISOString(),
        };

        // Step 9: Trigger review flow if status = completed & patient has consent
        if (status === 'completed' && patient.whatsapp_consent) {
          await this.markVisitComplete(newVisit.id);
          newVisit.review_requested = true;
          reviewDispatchedCount++;
        }

        visits.unshift(newVisit);
        added++;
      } else {
        const existing = visits[existingIdx];

        if (existing.row_hash === newHash) {
          // CASE 2: Hash unchanged -> SKIP
          unchanged++;
        } else {
          // CASE 3: Hash changed -> UPDATE VISIT
          existing.department = department;
          existing.doctor = doctor;
          existing.visit_date = visit_date;
          existing.status = status;
          existing.row_hash = newHash;

          // If status became completed and was not previously requested
          if (status === 'completed' && !existing.review_requested && !existing.historical) {
            await this.markVisitComplete(existing.id);
            existing.review_requested = true;
            reviewDispatchedCount++;
          }

          updated++;
        }
      }
    }

    // CASE 4: visit_uid in DB but missing from sheet -> SOFT DELETE
    visits.forEach((v) => {
      if (
        v.hospital_id === hospitalId &&
        v.visit_uid &&
        !sheetUids.has(v.visit_uid) &&
        !v.deleted_at
      ) {
        v.deleted_at = new Date().toISOString();
        deleted++;
      }
    });

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

    // Update connection timestamp
    const connList = getStore<HospitalSheetConnection>('sheet_connections', []);
    const cIdx = connList.findIndex((c) => c.hospital_id === hospitalId);
    if (cIdx !== -1) {
      connList[cIdx].last_synced_at = new Date().toISOString();
      connList[cIdx].total_rows_tracked = rawRows.length;
      setStore('sheet_connections', connList);
    }

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

