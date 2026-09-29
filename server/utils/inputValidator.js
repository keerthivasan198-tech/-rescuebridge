// ==============================================================
// Input Validation & SSRF Prevention (Security Checklist #4)
// ==============================================================

/**
 * Validates that an outbound sheet URL strictly belongs to official Google Spreadsheets.
 * Blocks all internal IPs (127.0.0.1, 169.254.x.x, 10.x, etc.) and non-Google domains (SSRF Guard).
 */
function validateGoogleSheetUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('Invalid URL provided.');
  }

  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch (err) {
    throw new Error('Malformed URL.');
  }

  // Must use HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error('Only secure HTTPS URLs are allowed.');
  }

  // Domain must strictly be docs.google.com
  const allowedHostnames = ['docs.google.com'];
  if (!allowedHostnames.includes(parsed.hostname.toLowerCase())) {
    throw new Error('SSRF Protection: Only docs.google.com is permitted.');
  }

  // Path must be a spreadsheet path
  const sheetMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetMatch || !sheetMatch[1]) {
    throw new Error('Invalid Google Spreadsheet URL format.');
  }

  return {
    sheetId: sheetMatch[1],
    cleanUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}`,
  };
}

/**
 * Sanitizes and validates a patient phone number.
 */
function sanitizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new Error('Phone number must contain between 10 and 15 digits.');
  }
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

/**
 * Sanitizes generic string inputs (prevent control character injection).
 */
function sanitizeString(input, maxLength = 255) {
  if (input === null || input === undefined) return '';
  const cleaned = String(input)
    .replace(/[\x00-\x1F\x7F]/g, '') // remove ASCII control characters
    .trim();
  return cleaned.slice(0, maxLength);
}

/**
 * Validates UUID format for database safety.
 */
function isValidUUID(uuidStr) {
  if (!uuidStr || typeof uuidStr !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuidStr);
}

module.exports = {
  validateGoogleSheetUrl,
  sanitizePhone,
  sanitizeString,
  isValidUUID,
};
