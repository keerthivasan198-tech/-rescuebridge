// ==============================================================
// Google Sheets Synchronization Routes (Security Checklist #4, #5)
// ==============================================================

const express = require('express');
const router = express.Router();
const https = require('https');
const { getSheetHeaders, performSync } = require('../automation/googleSheetsSync');
const { validateGoogleSheetUrl, sanitizeString } = require('../utils/inputValidator');
const { supabaseRequest } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

// -------------------------------------------------------------
// GET /api/sheets/service-account
// Returns public client_email of the service account
// -------------------------------------------------------------
router.get('/sheets/service-account', (req, res) => {
  try {
    const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyString) {
      return res.status(200).json({ email: 'sync@rescuebridge.iam.gserviceaccount.com', configured: false });
    }
    const creds = JSON.parse(keyString);
    return res.status(200).json({ email: creds.client_email, configured: true });
  } catch (err) {
    return res.status(200).json({ email: 'sync@rescuebridge.iam.gserviceaccount.com', configured: false });
  }
});

// -------------------------------------------------------------
// GET /api/sheets/headers
// Reads column headers for a given sheet ID
// -------------------------------------------------------------
router.get('/sheets/headers', async (req, res) => {
  try {
    const sheetId = sanitizeString(req.query.sheetId, 100);
    if (!sheetId) {
      return res.status(400).json({ error: 'Query parameter "sheetId" is required.' });
    }

    const headers = await getSheetHeaders(sheetId);
    return res.status(200).json({ success: true, headers });
  } catch (err) {
    logger.error('Error fetching sheet headers', err);
    return res.status(500).json({ error: err.message || 'Failed to inspect sheet columns.' });
  }
});

// -------------------------------------------------------------
// POST /api/sheets/sync
// Manually triggers sync for a specific hospital or connection
// -------------------------------------------------------------
router.post('/sheets/sync', async (req, res) => {
  try {
    const { connectionId, hospitalId } = req.body || {};

    let targetConnection = null;

    if (connectionId) {
      const cleanConnId = sanitizeString(connectionId, 64);
      const conns = await supabaseRequest(`hospital_sheet_connections?id=eq.${cleanConnId}`);
      if (conns && conns.length > 0) {
        targetConnection = conns[0];
      }
    } else if (hospitalId) {
      const cleanHospId = sanitizeString(hospitalId, 64);
      const conns = await supabaseRequest(`hospital_sheet_connections?hospital_id=eq.${cleanHospId}&status=in.(active,connected)&limit=1`);
      if (conns && conns.length > 0) {
        targetConnection = conns[0];
      }
    }

    if (!targetConnection) {
      return res.status(404).json({ error: 'No active Google Sheet connection found for sync.' });
    }

    const result = await performSync(targetConnection);
    return res.status(200).json(result);
  } catch (err) {
    logger.error('Manual sheet sync failed', err);
    return res.status(500).json({ error: err.message || 'Sheet sync encountered an error.' });
  }
});

// -------------------------------------------------------------
// GET /api/fetch-google-sheet
// SSRF-Protected Google Sheet live export fetcher
// -------------------------------------------------------------
router.get('/fetch-google-sheet', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl) {
      return res.status(400).json({ error: 'Query parameter "url" is required.' });
    }

    // SSRF Guard: strictly validates hostname is docs.google.com and extracts sheetId
    const { sheetId } = validateGoogleSheetUrl(rawUrl);
    const gid = sanitizeString(req.query.gid || '0', 20);

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    https.get(exportUrl, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        const isHtml = resp.headers['content-type']?.includes('text/html');
        if (resp.statusCode === 401 || resp.statusCode === 403 || isHtml) {
          return res.status(401).json({
            error: 'Google Sheet is private. Set share permissions to "Anyone with the link can view".',
            status: 401,
          });
        }

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ success: true, csv: data });
      });
    }).on('error', (netErr) => {
      logger.error('Error fetching sheet export', netErr);
      return res.status(502).json({ error: 'Failed to reach Google Sheets servers.' });
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
