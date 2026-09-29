// ==============================================================
// Authentication & API Key Middleware (Security Checklist #1, #3)
// ==============================================================

const crypto = require('crypto');
const logger = require('../utils/logger');

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Constant time dummy check
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyApiKey(req, res, next) {
  const configuredKey = process.env.FORM_WEBHOOK_API_KEY;
  if (!configuredKey) {
    logger.error('FORM_WEBHOOK_API_KEY not configured on server.');
    return res.status(500).json({ error: 'Server security misconfiguration: API key missing.' });
  }

  const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!providedKey || !timingSafeEqual(providedKey, configuredKey)) {
    logger.warn('Unauthorized access attempt on secured endpoint', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key.' });
  }

  next();
}

module.exports = {
  verifyApiKey,
  timingSafeEqual,
};
