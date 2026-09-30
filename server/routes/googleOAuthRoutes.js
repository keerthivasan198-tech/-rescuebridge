// ==============================================================
// Google OAuth 2.0 Authentication Routes
// Enables 1-click Google account authorization for hospitals
// ==============================================================

const express = require('express');
const router = express.Router();
const {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  saveTokensForHospital,
  getTokensForHospital,
  disconnectHospital,
} = require('../utils/googleOAuthManager');
const { sanitizeString } = require('../utils/inputValidator');
const logger = require('../utils/logger');

// -------------------------------------------------------------
// GET /api/auth/google/url
// Returns the OAuth consent screen URL
// -------------------------------------------------------------
router.get('/auth/google/url', (req, res) => {
  try {
    const hospitalId = sanitizeString(req.query.hospitalId || '11111111-1111-1111-1111-111111111111', 64);
    const returnTo = sanitizeString(req.query.returnTo || '/staff/sheet-sync', 100);
    const customRedirectUri = req.query.redirectUri ? sanitizeString(req.query.redirectUri, 200) : undefined;

    const url = getAuthorizationUrl(hospitalId, returnTo, customRedirectUri);
    return res.status(200).json({ success: true, url });
  } catch (err) {
    logger.error('Failed to generate Google OAuth URL:', err);
    return res.status(500).json({ error: 'Could not generate Google OAuth URL' });
  }
});

// -------------------------------------------------------------
// POST /api/auth/google/exchange
// Exchanges temporary authorization code for tokens and saves them
// -------------------------------------------------------------
router.post('/auth/google/exchange', async (req, res) => {
  try {
    const { code, hospitalId, redirectUri } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required.' });
    }

    const cleanHospitalId = sanitizeString(hospitalId || '11111111-1111-1111-1111-111111111111', 64);
    const cleanRedirectUri = redirectUri ? sanitizeString(redirectUri, 200) : undefined;

    logger.info(`Exchanging Google OAuth code for hospital ${cleanHospitalId}`);
    const tokenData = await exchangeCodeForTokens(code, cleanRedirectUri);

    await saveTokensForHospital(cleanHospitalId, tokenData);

    logger.info(`OAuth tokens stored successfully for hospital ${cleanHospitalId}`, { email: tokenData.email });

    return res.status(200).json({
      success: true,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
      message: 'Successfully connected Google account!',
    });
  } catch (err) {
    logger.error('Google OAuth token exchange failed:', err);
    return res.status(500).json({
      error: err.message || 'Failed to exchange authorization code with Google.',
    });
  }
});

// -------------------------------------------------------------
// GET /api/auth/google/status
// Returns the connection status of a hospital's Google account
// -------------------------------------------------------------
router.get('/auth/google/status', async (req, res) => {
  try {
    const hospitalId = sanitizeString(req.query.hospitalId, 64);
    if (!hospitalId) {
      return res.status(400).json({ error: 'hospitalId query parameter is required.' });
    }

    const tokens = await getTokensForHospital(hospitalId);
    if (!tokens || !tokens.accessToken) {
      return res.status(200).json({ connected: false });
    }

    return res.status(200).json({
      connected: true,
      email: tokens.email || null,
      expiresAt: tokens.expiresAt || null,
    });
  } catch (err) {
    logger.error('Failed to get Google OAuth status:', err);
    return res.status(500).json({ error: 'Failed to check OAuth connection status.' });
  }
});

// -------------------------------------------------------------
// POST /api/auth/google/disconnect
// Disconnects Google OAuth connection for a hospital
// -------------------------------------------------------------
router.post('/auth/google/disconnect', async (req, res) => {
  try {
    const { hospitalId } = req.body || {};
    const cleanHospitalId = sanitizeString(hospitalId, 64);
    if (!cleanHospitalId) {
      return res.status(400).json({ error: 'hospitalId is required.' });
    }

    await disconnectHospital(cleanHospitalId);
    return res.status(200).json({ success: true, message: 'Google account disconnected.' });
  } catch (err) {
    logger.error('Failed to disconnect Google OAuth:', err);
    return res.status(500).json({ error: 'Failed to disconnect Google account.' });
  }
});

module.exports = router;
