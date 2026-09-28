// RescueBridge Multi-Hospital Multi-Tenant Data Types

export type UserRole = 'super_admin' | 'hospital_admin' | 'staff';

export type SheetType = 'google_sheets' | 'excel_365' | 'onedrive' | 'google_forms' | 'manual';

export interface Hospital {
  id: string;
  name: string;
  subdomain: string;
  google_place_id: string;
  sheet_id: string;
  sheet_type: SheetType;
  logo?: string;
  website?: string;
  phone?: string;
  admin_email?: string;
  google_review_url?: string;
  whatsapp_template_name: string;
  created_at?: string;
  // Computed / UI stats
  total_visits?: number;
  completed_visits?: number;
  reviews_received?: number;
  average_rating?: number;
  sync_status?: 'active' | 'syncing' | 'sync_broken' | 'disconnected';
  last_synced?: string;
}

export interface User {
  id: string;
  hospital_id: string | null; // NULL for super_admin
  name: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  created_at?: string;
}

export interface Patient {
  id: string;
  hospital_id: string;
  name: string;
  phone: string;
  whatsapp_consent: boolean;
  review_sent?: boolean;          // One-time review flag: patient cannot be spammed again
  review_sent_at?: string | null; // Timestamp when review message was sent
  last_message_content?: string;  // WhatsApp template content sent to this patient
  created_at?: string;
}

export type VisitStatus = 'registered' | 'in_consultation' | 'completed' | 'cancelled' | 'pending';

export interface Visit {
  id: string;
  hospital_id: string;
  patient_id: string;
  department: string;
  doctor: string;
  visit_date: string;
  status: VisitStatus;
  visit_uid?: string;                 // e.g. H12-2026-000451 (unique business ID per visit)
  sheet_row_id?: string | null;
  row_hash?: string;                  // SHA fingerprint of row values
  historical?: boolean;               // True for backfilled initial import (no WhatsApp sent)
  review_requested?: boolean;         // Idempotency flag preventing duplicate WhatsApp dispatches
  deleted_at?: string | null;         // Soft delete timestamp
  token: string;
  created_at?: string;
  // Hydrated joins
  patient?: Patient;
  hospital?: Hospital;
  review_request?: ReviewRequest;
}

export type WhatsAppStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type ReviewChannel = 'whatsapp' | 'sms' | 'qr' | 'direct';

export interface ReviewRequest {
  id: string;
  hospital_id: string;
  visit_id: string;
  sent_at: string | null;
  whatsapp_status: WhatsAppStatus;
  message_template?: string;
  rating: number | null; // 1 to 5
  feedback_text: string | null;
  review_channel: ReviewChannel;
  submitted_at: string | null;
  created_at?: string;
  visit?: Visit;
}

// ── Sheet Connection & Delta Sync Types (Part A & B) ─────────────────────────

export interface ColumnMapping {
  visit_uid: string;
  patient_name: string;
  phone: string;
  visit_date: string;
  department: string;
  doctor: string;
  status: string;
}

export interface HospitalSheetConnection {
  id: string;
  hospital_id: string;
  sheet_type: 'google_sheets' | 'excel_365' | 'onedrive' | 'google_forms';
  sheet_id: string;
  table_name: string;
  column_mapping: ColumnMapping;
  status: 'connected' | 'active' | 'sync_broken' | 'disconnected';
  last_synced_at: string | null;
  total_rows_tracked: number;
  created_at?: string;
}

export interface SyncRun {
  id: string;
  hospital_id: string;
  sync_type: 'initial_backfill' | 'delta_sync';
  started_at: string;
  finished_at?: string;
  rows_added: number;
  rows_updated: number;
  rows_rejected: number;
  status: 'success' | 'failed' | 'partial';
}

export interface SyncError {
  id: string;
  sync_run_id: string;
  hospital_id: string;
  row_reference: string;
  reason: string;
  created_at: string;
}
