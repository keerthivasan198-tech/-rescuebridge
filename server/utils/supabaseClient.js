// ==============================================================
// Secured Server-side Supabase Client (Security Checklist #1, #4)
// ==============================================================

const https = require('https');
const logger = require('./logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  logger.warn('SUPABASE_URL or SUPABASE_KEY environment variables are missing.');
}

function supabaseRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return reject(new Error('Supabase configuration missing in server environment.'));
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: 10000, // 10s timeout
    };

    const req = https.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(body ? JSON.parse(body) : null);
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`Supabase API error (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Supabase request timed out after 10s.'));
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

module.exports = {
  supabaseRequest,
  SUPABASE_URL,
  SUPABASE_KEY,
};
