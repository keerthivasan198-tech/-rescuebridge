// ==============================================================
// Logger Utility with PII and Secret Masking (Security Checklist #8)
// ==============================================================

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `+***${digits.slice(-4)}`;
}

function maskName(name) {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (trimmed.length <= 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}***${trimmed[trimmed.length - 1]}`;
}

function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return '';
  if (secret.length <= 6) return '******';
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`;
}

const logger = {
  info: (msg, meta = {}) => {
    const safeMeta = sanitizeMeta(meta);
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(safeMeta).length ? safeMeta : '');
  },
  warn: (msg, meta = {}) => {
    const safeMeta = sanitizeMeta(meta);
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, Object.keys(safeMeta).length ? safeMeta : '');
  },
  error: (msg, err = null) => {
    const errMsg = err ? (err.message || String(err)) : '';
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg} ${errMsg}`);
  },
  maskPhone,
  maskName,
  maskSecret,
};

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const copy = { ...meta };
  if (copy.phone) copy.phone = maskPhone(copy.phone);
  if (copy.patient_name) copy.patient_name = maskName(copy.patient_name);
  if (copy.name) copy.name = maskName(copy.name);
  if (copy.apiKey) copy.apiKey = maskSecret(copy.apiKey);
  if (copy.token) copy.token = maskSecret(copy.token);
  return copy;
}

module.exports = logger;
