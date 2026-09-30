// ==============================================================
// Google Sheets Auto-Sync Automation Worker (Security Checklist #4, #8)
// Runs securely inside the backend process; no client involvement.
// ==============================================================

const https = require('https');
const XLSX = require('xlsx');
const { supabaseRequest } = require('../utils/supabaseClient');
const { validateGoogleSheetUrl, sanitizePhone, sanitizeString } = require('../utils/inputValidator');
const { getAuthenticatedClientForHospital } = require('../utils/googleOAuthManager');
const logger = require('../utils/logger');


let authClient = null;
let googleLib = null;

function getGoogle() {
  if (googleLib) return googleLib;
  try {
    const { google } = require('googleapis');
    googleLib = google;
    return googleLib;
  } catch (err) {
    logger.warn('googleapis module not available for service account, using public sheet fetcher.');
    return null;
  }
}

function getAuthClient() {
  if (authClient) return authClient;
  try {
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyString) return null;
    const google = getGoogle();
    if (!google) return null;
    const credentials = JSON.parse(keyString);
    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return authClient;
  } catch (err) {
    logger.error('Failed to initialize GOOGLE_SERVICE_ACCOUNT_KEY', err);
    return null;
  }
}

// Fetch all rows from a sheet (via Hospital OAuth, Service Account, or secure Gviz CSV)
async function fetchAllSheetRows(sheetId, range = 'Sheet1!A:Z', hospitalId = null) {
  // Validate sheetId format to prevent path traversal / injection
  if (!sheetId || !/^[a-zA-Z0-9-_]+$/.test(sheetId)) {
    throw new Error('Invalid sheetId format.');
  }

  // Method 1: Hospital Administrator OAuth 2.0 Token (1-Click Google Connect)
  if (hospitalId) {
    try {
      const oauthClient = await getAuthenticatedClientForHospital(hospitalId);
      if (oauthClient) {
        const google = getGoogle();
        if (google) {
          const sheets = google.sheets({ version: 'v4', auth: oauthClient });
          const resp = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range || 'Sheet1!A:Z',
          });
          if (resp.data && resp.data.values && resp.data.values.length > 0) {
            logger.info(`Successfully fetched ${resp.data.values.length} rows using hospital OAuth token.`);
            return resp.data.values;
          }
        }
      }
    } catch (oauthErr) {
      logger.warn(`Hospital OAuth API call failed (${oauthErr.message}), trying fallback authentication...`);
    }
  }

  const auth = getAuthClient();

  // Method 2: Official Service Account v4 API
  if (auth) {
    try {
      const google = getGoogle();
      const sheets = google.sheets({ version: 'v4', auth });
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range || 'Sheet1!A:Z',
      });
      if (resp.data && resp.data.values && resp.data.values.length > 0) {
        return resp.data.values;
      }
    } catch (apiErr) {
      logger.warn('Service Account API call error, falling back to public export: ' + apiErr.message);
    }
  }

  // Method 3: Google Visualization API / CSV Export (SSRF-safe, strictly docs.google.com)
  return new Promise((resolve, reject) => {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv`;
    https.get(gvizUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Google Sheet returned HTTP ${res.statusCode}. Ensure sheet is shared or connected via Google OAuth.`));
        }
        try {
          const wb = XLSX.read(data, { type: 'string' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
          resolve(rows || []);
        } catch (parseErr) {
          reject(new Error('Failed to parse sheet data: ' + parseErr.message));
        }
      });
    }).on('error', reject);
  });
}

// Read headers for the UI
async function getSheetHeaders(sheetId, hospitalId = null) {
  const rows = await fetchAllSheetRows(sheetId, 'Sheet1!1:1', hospitalId);
  if (rows && rows.length > 0) {
    return rows[0];
  }
  return [];
}

// Normalize date into YYYY-MM-DD
function normalizeDate(raw) {
  if (!raw) return new Date().toISOString().split('T')[0];
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    let [m, d, y] = parts;
    if (y.length === 2) y = '20' + y;
    if (m.length === 1) m = '0' + m;
    if (d.length === 1) d = '0' + d;
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// Auto-detect column indices from headers
function detectMapping(headers, providedMapping = {}) {
  const mapping = {};
  if (!headers || headers.length === 0) return mapping;

  headers.forEach((h, idx) => {
    const hl = String(h || '').toLowerCase().trim();
    if (hl.includes('patient') || hl.includes('name')) {
      if (mapping.patient_name === undefined) mapping.patient_name = idx;
    } else if (hl.includes('phone') || hl.includes('mobile') || hl.includes('contact') || hl.includes('whatsapp')) {
      if (mapping.phone === undefined) mapping.phone = idx;
    } else if (hl.includes('doctor') || hl.includes('physician') || hl.includes('consultant')) {
      if (mapping.doctor === undefined) mapping.doctor = idx;
    } else if (hl.includes('appoint') || (hl.includes('date') && !hl.includes('birth'))) {
      if (mapping.visit_date === undefined) mapping.visit_date = idx;
    } else if (hl.includes('issue') || hl.includes('detail') || hl.includes('dept') || hl.includes('reason') || hl.includes('problem')) {
      if (mapping.department === undefined) mapping.department = idx;
    } else if (hl.includes('status')) {
      if (mapping.status === undefined) mapping.status = idx;
    } else if (hl.includes('uid') || hl.includes('token')) {
      if (mapping.visit_uid === undefined) mapping.visit_uid = idx;
    }
  });

  if (mapping.visit_date === undefined) {
    headers.forEach((h, idx) => {
      const hl = String(h || '').toLowerCase().trim();
      if (hl.includes('time') || hl.includes('date')) {
        if (mapping.visit_date === undefined) mapping.visit_date = idx;
      }
    });
  }

  if (providedMapping) {
    for (const [k, v] of Object.entries(providedMapping)) {
      if (v !== undefined && v !== null) {
        mapping[k] = v;
      }
    }
  }

  return mapping;
}

// Perform sync for a single connection
async function performSync(connection) {
  const hospitalId = connection.hospital_id;
  logger.info(`Starting sheet sync for hospital ${hospitalId}`);

  try {
    const allRows = await fetchAllSheetRows(connection.sheet_id, 'Sheet1!A:Z', hospitalId);
    if (!allRows || allRows.length === 0) {
      await supabaseRequest(`hospital_sheet_connections?id=eq.${connection.id}`, {
        method: 'PATCH',
        body: { status: 'active', last_synced_at: new Date().toISOString() },
        headers: { Prefer: 'return=minimal' },
      });
      return { success: true, added: 0, updated: 0, message: 'Sheet is empty' };
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1);

    let mapping = typeof connection.column_mapping === 'string'
      ? JSON.parse(connection.column_mapping)
      : (connection.column_mapping || {});
    mapping = detectMapping(headers, mapping);

    let existingVisits = [];
    try {
      existingVisits = await supabaseRequest(`visits?hospital_id=eq.${hospitalId}&select=id,patient_id,visit_date,token,visit_uid`) || [];
    } catch (e) {
      logger.warn('Could not fetch existing visits for matching: ' + e.message);
    }

    const patientsToInsert = [];
    const visitsToInsert = [];
    let added = 0;
    let rejected = 0;

    dataRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      if (!row || row.every(cell => !cell || String(cell).trim() === '')) return;

      const patientName = sanitizeString(row[mapping.patient_name] || '');
      const rawPhone = String(row[mapping.phone] || '').trim();

      if (!patientName || !rawPhone) {
        rejected++;
        return;
      }

      let phoneWithCode;
      try {
        phoneWithCode = sanitizePhone(rawPhone);
      } catch {
        rejected++;
        return;
      }

      const cleanDigits = phoneWithCode.replace(/\D/g, '');
      const cleanNameSlug = patientName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      const patientId = `PAT-${cleanNameSlug}-${cleanDigits.slice(-6)}`;
      const visitUid = sanitizeString(row[mapping.visit_uid] || '') || `VISIT-${cleanNameSlug}-${rowNum}-${cleanDigits.slice(-4)}`;

      const visitDate = normalizeDate(row[mapping.visit_date]);
      const rawDoctor = sanitizeString(row[mapping.doctor] || '') || 'Duty Medical Officer';
      const doctor = rawDoctor.toLowerCase().startsWith('dr') ? rawDoctor : `Dr. ${rawDoctor}`;
      const department = sanitizeString(row[mapping.department] || '') || 'General Consultation';

      let visitStatus = String(row[mapping.status] || 'registered').toLowerCase().trim();
      if (!['registered', 'in_consultation', 'completed', 'cancelled'].includes(visitStatus)) {
        visitStatus = 'registered';
      }

      const existing = existingVisits.find(ev => 
        (ev.visit_uid && ev.visit_uid === visitUid) || 
        (ev.patient_id === patientId && ev.visit_date === visitDate)
      );

      const visitId = existing ? existing.id : `visit-${hospitalId.slice(0, 8)}-${cleanNameSlug}-${cleanDigits.slice(-4)}-${visitDate.replace(/-/g, '')}`;
      const token = existing ? existing.token : `rb-sync-${cleanNameSlug}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;

      patientsToInsert.push({
        id: patientId,
        hospital_id: hospitalId,
        name: patientName,
        phone: phoneWithCode,
        whatsapp_consent: true,
      });

      visitsToInsert.push({
        isExisting: !!existing,
        payload: {
          id: visitId,
          hospital_id: hospitalId,
          patient_id: patientId,
          department: department,
          doctor: doctor,
          visit_date: visitDate,
          status: visitStatus,
          visit_uid: existing?.visit_uid || visitUid,
          sheet_row_id: existing?.visit_uid || visitUid,
          token: token,
          historical: false,
          review_requested: false,
        },
      });

      added++;
    });

    // Upsert patients
    for (const p of patientsToInsert) {
      try {
        await supabaseRequest('patients', {
          method: 'POST',
          body: p,
          headers: { Prefer: 'resolution=merge-duplicates' },
        });
      } catch (e) {
        logger.warn('Patient save note: ' + e.message);
      }
    }

    // Upsert or patch visits
    for (const v of visitsToInsert) {
      try {
        if (v.isExisting) {
          await supabaseRequest(`visits?id=eq.${v.payload.id}`, {
            method: 'PATCH',
            body: {
              doctor: v.payload.doctor,
              department: v.payload.department,
              visit_date: v.payload.visit_date,
              status: v.payload.status,
            },
            headers: { Prefer: 'return=minimal' },
          });
        } else {
          await supabaseRequest('visits', {
            method: 'POST',
            body: v.payload,
            headers: { Prefer: 'resolution=merge-duplicates' },
          });
        }
      } catch (e) {
        logger.warn('Visit save note: ' + e.message);
      }
    }

    const totalRowsInSheet = dataRows.length;
    await supabaseRequest(`hospital_sheet_connections?id=eq.${connection.id}`, {
      method: 'PATCH',
      body: {
        status: 'active',
        last_synced_at: new Date().toISOString(),
        total_rows_tracked: totalRowsInSheet,
        column_mapping: mapping,
      },
      headers: { Prefer: 'return=minimal' },
    });

    logger.info(`Sheet sync completed for hospital ${hospitalId}`, { count: added });
    return { success: true, added, total: totalRowsInSheet };
  } catch (err) {
    logger.error(`Sheet sync failed for hospital ${hospitalId}`, err);
    return { success: false, error: err.message };
  }
}

// Background sync loop
async function runAllSyncs() {
  logger.info('Executing background sheet auto-sync check...');
  try {
    const connections = await supabaseRequest('hospital_sheet_connections?status=in.(active,connected)&sheet_type=eq.google_sheets');
    if (!connections || connections.length === 0) {
      logger.info('No active Google Sheets connections found to sync.');
      return;
    }

    for (const conn of connections) {
      if (conn.sheet_id) {
        await performSync(conn);
      }
    }
  } catch (err) {
    logger.error('Global sheet auto-sync loop failed', err);
  }
}

let syncInterval = null;

function startCron() {
  if (syncInterval) clearInterval(syncInterval);
  // Run once immediately
  runAllSyncs().catch((err) => logger.error('Initial cron sync error', err));
  // Every 2 minutes
  syncInterval = setInterval(runAllSyncs, 2 * 60 * 1000);
  logger.info('Google Sheets auto-sync background worker started (2-minute interval).');
}

function stopCron() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.info('Google Sheets auto-sync background worker stopped.');
  }
}

module.exports = {
  getSheetHeaders,
  performSync,
  runAllSyncs,
  startCron,
  stopCron,
};
