// ==============================================================
// Google OAuth 2.0 Manager for RescueBridge
// Handles OAuth consent URL generation, token exchange, silent token refresh,
// and secure token persistence per hospital.
// ==============================================================

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { supabaseRequest } = require('./supabaseClient');
const logger = require('./logger');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://rescuebridge-omega.vercel.app/';

const LOCAL_TOKENS_PATH = path.join(__dirname, '..', 'data', 'oauth_tokens.json');

// Ensure data directory exists
function ensureDataDir() {
  const dir = path.dirname(LOCAL_TOKENS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Fallback file-based token storage (in case Supabase migration hasn't been executed yet)
function readLocalTokens() {
  try {
    ensureDataDir();
    if (fs.existsSync(LOCAL_TOKENS_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_TOKENS_PATH, 'utf-8'));
    }
  } catch (err) {
    logger.warn('Error reading local token store:', err.message);
  }
  return {};
}

function writeLocalTokens(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(LOCAL_TOKENS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.warn('Error saving local token store:', err.message);
  }
}

/**
 * Creates a fresh Google OAuth2 client instance
 */
function createOAuth2Client(redirectUri = REDIRECT_URI) {
  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    redirectUri
  );
}

/**
 * Generate Google OAuth consent URL for a specific hospital
 */
function getAuthorizationUrl(hospitalId, returnTo = '/staff/sheet-sync', customRedirectUri) {
  const redirectUri = customRedirectUri || REDIRECT_URI;
  const client = createOAuth2Client(redirectUri);

  const statePayload = JSON.stringify({
    hospitalId,
    returnTo,
    ts: Date.now(),
  });

  return client.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    prompt: 'consent',      // Force consent to always receive refresh token
    scope: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state: Buffer.from(statePayload).toString('base64'),
  });
}

/**
 * Exchange auth code for tokens and retrieve hospital administrator's email
 */
async function exchangeCodeForTokens(code, customRedirectUri) {
  const redirectUri = customRedirectUri || REDIRECT_URI;
  const client = createOAuth2Client(redirectUri);

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Retrieve user email to display "Connected as admin@hospital.com"
  let email = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    email = userInfo.data?.email || null;
  } catch (e) {
    logger.warn('Could not fetch Google user profile email:', e.message);
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3500 * 1000).toISOString();

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    email,
  };
}

/**
 * Save OAuth tokens for a hospital in Supabase (with fallback to local store)
 */
async function saveTokensForHospital(hospitalId, { accessToken, refreshToken, expiresAt, email }) {
  if (!hospitalId) throw new Error('hospitalId is required to save OAuth tokens.');

  let savedToSupabase = false;

  // 1. Try to update 'hospitals' table in Supabase
  try {
    const updatePayload = {
      google_access_token: accessToken,
      google_token_expires_at: expiresAt,
      google_account_email: email,
    };
    if (refreshToken) {
      updatePayload.google_refresh_token = refreshToken;
    }

    await supabaseRequest(`hospitals?id=eq.${hospitalId}`, {
      method: 'PATCH',
      body: updatePayload,
      headers: { Prefer: 'return=minimal' },
    });
    savedToSupabase = true;
    logger.info(`Successfully stored OAuth tokens in Supabase hospitals table for ${hospitalId}`);
  } catch (err) {
    logger.warn(`Could not save tokens to Supabase hospitals table (${err.message}). Saving to persistent backup.`);
  }

  // 2. Also try updating active connection in 'hospital_sheet_connections' if present
  try {
    const updatePayload = {
      google_access_token: accessToken,
      google_token_expires_at: expiresAt,
      google_account_email: email,
    };
    if (refreshToken) {
      updatePayload.google_refresh_token = refreshToken;
    }
    await supabaseRequest(`hospital_sheet_connections?hospital_id=eq.${hospitalId}`, {
      method: 'PATCH',
      body: updatePayload,
      headers: { Prefer: 'return=minimal' },
    });
  } catch {
    // Non-critical if table columns aren't yet migrated
  }

  // 3. Always maintain local copy for resilience
  const local = readLocalTokens();
  local[hospitalId] = {
    accessToken,
    refreshToken: refreshToken || local[hospitalId]?.refreshToken || null,
    expiresAt,
    email: email || local[hospitalId]?.email || null,
    updatedAt: new Date().toISOString(),
  };
  writeLocalTokens(local);

  return { success: true, savedToSupabase, email };
}

/**
 * Get stored tokens for a hospital
 */
async function getTokensForHospital(hospitalId) {
  if (!hospitalId) return null;

  // Check Supabase first
  try {
    const res = await supabaseRequest(`hospitals?id=eq.${hospitalId}&select=google_access_token,google_refresh_token,google_token_expires_at,google_account_email`);
    if (res && res.length > 0 && res[0].google_access_token) {
      return {
        accessToken: res[0].google_access_token,
        refreshToken: res[0].google_refresh_token,
        expiresAt: res[0].google_token_expires_at,
        email: res[0].google_account_email,
      };
    }
  } catch {
    // Supabase column might not be migrated yet, fallback to local store
  }

  // Check fallback store
  const local = readLocalTokens();
  if (local[hospitalId] && local[hospitalId].accessToken) {
    return local[hospitalId];
  }

  return null;
}

/**
 * Get an authenticated OAuth2 client with auto-refreshing capability
 */
async function getAuthenticatedClientForHospital(hospitalId) {
  const tokenData = await getTokensForHospital(hospitalId);
  if (!tokenData || (!tokenData.accessToken && !tokenData.refreshToken)) {
    return null;
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokenData.accessToken,
    refresh_token: tokenData.refreshToken,
    expiry_date: tokenData.expiresAt ? new Date(tokenData.expiresAt).getTime() : undefined,
  });

  // Listen for automatic token refresh event to persist new tokens
  client.on('tokens', async (newTokens) => {
    logger.info(`Google OAuth token refreshed automatically for hospital ${hospitalId}`);
    try {
      await saveTokensForHospital(hospitalId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokenData.refreshToken,
        expiresAt: newTokens.expiry_date
          ? new Date(newTokens.expiry_date).toISOString()
          : new Date(Date.now() + 3500 * 1000).toISOString(),
        email: tokenData.email,
      });
    } catch (e) {
      logger.error('Failed to persist refreshed OAuth token:', e);
    }
  });

  return client;
}

/**
 * Disconnect Google OAuth account for a hospital
 */
async function disconnectHospital(hospitalId) {
  if (!hospitalId) return;

  try {
    await supabaseRequest(`hospitals?id=eq.${hospitalId}`, {
      method: 'PATCH',
      body: {
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        google_account_email: null,
      },
      headers: { Prefer: 'return=minimal' },
    });
  } catch {
    // Column might not exist in Supabase
  }

  const local = readLocalTokens();
  if (local[hospitalId]) {
    delete local[hospitalId];
    writeLocalTokens(local);
  }

  logger.info(`Google OAuth disconnected for hospital ${hospitalId}`);
  return { success: true };
}

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  createOAuth2Client,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  saveTokensForHospital,
  getTokensForHospital,
  getAuthenticatedClientForHospital,
  disconnectHospital,
};
