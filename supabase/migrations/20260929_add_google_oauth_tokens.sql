-- ==============================================================
-- RescueBridge: Google OAuth 2.0 Token Storage Migration
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================

-- 1. Add OAuth token columns to 'hospitals' table
ALTER TABLE public.hospitals
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_account_email TEXT;

-- 2. Add OAuth token columns to 'hospital_sheet_connections' table
ALTER TABLE public.hospital_sheet_connections
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_account_email TEXT;

-- 3. Document columns for security compliance
COMMENT ON COLUMN public.hospitals.google_access_token IS 'OAuth 2.0 access token for Google Sheets API';
COMMENT ON COLUMN public.hospitals.google_refresh_token IS 'OAuth 2.0 refresh token for silent offline token renewal';
COMMENT ON COLUMN public.hospitals.google_token_expires_at IS 'Expiration timestamp for Google OAuth access token';
COMMENT ON COLUMN public.hospitals.google_account_email IS 'Authenticated Google account email of hospital administrator';
