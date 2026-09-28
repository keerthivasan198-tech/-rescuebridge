// RescueBridge Google Forms Integration Service
// Extracts fields, parses Google Form URLs, and synchronizes submissions into Supabase & UI

export interface GoogleFormFieldConfig {
  name: string;
  label: string;
  entryId?: string;
  required: boolean;
}

export interface GoogleFormSubmission {
  patient_name: string;
  phone: string;
  doctor: string;
  visit_date: string;
  department?: string; // ISSUE DETAIL
  notes?: string;
  hospital_id?: string;
}

export const DEFAULT_RESCUEBRIDGE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSexV2QSLHOODrJpbAjsyXCJKfL1VPNW2ek9WAsBOZnGIvythg/viewform?usp=publish-editor';

export const RESCUEBRIDGE_FORM_FIELDS: GoogleFormFieldConfig[] = [
  { name: 'patient_name', label: 'PATIENT NAME', entryId: 'entry.1870727040', required: true },
  { name: 'phone', label: 'PHONE NUMBER:', entryId: 'entry.860089159', required: true },
  { name: 'doctor', label: 'DOCTOR NAME', entryId: 'entry.252675850', required: true },
  { name: 'visit_date', label: 'APPOINTEMENT DATE', entryId: 'entry.2132932397', required: true },
  { name: 'department', label: 'ISSUE DETAIL', entryId: 'entry.909604390', required: false },
];

/**
 * Parses Google Form URL and extracts Form ID and normalized URLs
 */
export function parseGoogleFormUrl(url: string): {
  isValid: boolean;
  formId: string;
  viewUrl: string;
  responseUrl: string;
} {
  const trimmed = (url || '').trim();
  if (!trimmed.includes('docs.google.com/forms')) {
    return { isValid: false, formId: '', viewUrl: trimmed, responseUrl: '' };
  }

  // Extract ID between /d/e/ and / or between /d/ and /
  const matchE = trimmed.match(/\/forms\/d\/e\/([a-zA-Z0-9-_]+)/);
  const matchD = trimmed.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/);

  const formId = matchE ? matchE[1] : matchD ? matchD[1] : '';
  const isE = Boolean(matchE);

  if (!formId) {
    return { isValid: false, formId: '', viewUrl: trimmed, responseUrl: '' };
  }

  const basePrefix = isE
    ? `https://docs.google.com/forms/d/e/${formId}`
    : `https://docs.google.com/forms/d/${formId}`;

  return {
    isValid: true,
    formId,
    viewUrl: `${basePrefix}/viewform`,
    responseUrl: `${basePrefix}/formResponse`,
  };
}

/**
 * Generates ready-to-paste Google Apps Script snippet for real-time form submission webhook
 */
export function generateAppsScriptSnippet(hospitalId: string, apiEndpoint?: string): string {
  const endpoint = apiEndpoint || `${window.location.origin}/api/google-form-response`;
  return `/**
 * RescueBridge Real-Time Google Form Webhook
 * 1. In your Google Form, click the ⋮ menu at top right -> Extensions / Script editor.
 * 2. Paste this entire code and save.
 * 3. Click "Triggers" (alarm clock icon on left) -> "Add Trigger":
 *    - Choose which function to run: onFormSubmit
 *    - Event source: From form
 *    - Event type: On form submit
 * 4. Save and authorize. Every new patient response will now instantly appear in RescueBridge!
 */
function onFormSubmit(e) {
  var itemResponses = e.response.getItemResponses();
  var payload = {
    hospital_id: "${hospitalId}",
    submitted_at: new Date().toISOString()
  };

  for (var i = 0; i < itemResponses.length; i++) {
    var title = itemResponses[i].getItem().getTitle().toUpperCase().trim();
    var response = itemResponses[i].getResponse();

    if (title.indexOf("PATIENT NAME") !== -1 || title.indexOf("NAME") !== -1) {
      payload.patient_name = response;
    } else if (title.indexOf("PHONE") !== -1 || title.indexOf("MOBILE") !== -1 || title.indexOf("CONTACT") !== -1) {
      payload.phone = response;
    } else if (title.indexOf("DOCTOR") !== -1) {
      payload.doctor = response;
    } else if (title.indexOf("DATE") !== -1 || title.indexOf("APPOINTEMENT") !== -1) {
      payload.visit_date = response;
    } else if (title.indexOf("ISSUE") !== -1 || title.indexOf("DETAIL") !== -1 || title.indexOf("DEPT") !== -1) {
      payload.department = response;
    }
  }

  try {
    UrlFetchApp.fetch("${endpoint}", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log("RescueBridge webhook dispatch error: " + err);
  }
}`;
}

/**
 * Submits form data directly to the Google Form public endpoint
 */
export async function submitToGoogleFormPublic(
  formId: string,
  data: GoogleFormSubmission
): Promise<{ success: boolean; error?: string }> {
  try {
    const postUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
    const formData = new URLSearchParams();

    // Map known fields to entry IDs
    formData.append('entry.1870727040', data.patient_name || '');
    formData.append('entry.860089159', data.phone || '');
    formData.append('entry.252675850', data.doctor || '');
    formData.append('entry.2132932397', data.visit_date || '');
    formData.append('entry.909604390', data.department || '');

    // Submit with no-cors to prevent browser CORS block while still reaching Google's servers
    await fetch(postUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Google Form direct POST note:', err);
    return { success: false, error: err?.message };
  }
}
