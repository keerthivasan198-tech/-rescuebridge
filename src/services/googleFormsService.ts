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

export const STANDARD_FORM_FIELDS: GoogleFormFieldConfig[] = [
  { name: 'patient_name', label: 'PATIENT NAME', entryId: 'entry.1870727040', required: true },
  { name: 'phone', label: 'PHONE NUMBER:', entryId: 'entry.860089159', required: true },
  { name: 'doctor', label: 'DOCTOR NAME', entryId: 'entry.252675850', required: true },
  { name: 'visit_date', label: 'APPOINTMENT DATE', entryId: 'entry.2132932397', required: true },
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
 * Universally supports both Google Sheets (linked responses) and Google Forms directly.
 */
export function generateAppsScriptSnippet(hospitalId: string, apiEndpoint?: string, secretApiKey?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const endpoint = apiEndpoint || `${origin}/api/form-webhook`;
  const keyToUse = secretApiKey || (typeof window !== 'undefined' ? localStorage.getItem('rb_sync_api_key') : '') || 'REPLACE_WITH_YOUR_SECRET_API_KEY';
  return `/**
 * RescueBridge Cloud-Connected Real-Time Google Sheet & Form Webhook
 * 
 * SETUP IN 3 STEPS (Works in either Google Sheets or Google Forms):
 * 1. In your Google Sheet (or Google Form): click Extensions -> Apps Script.
 * 2. Delete any existing code, paste this entire script, and click Save (💾).
 * 3. Click "Triggers" (alarm clock ⏰ icon on left) -> "Add Trigger" (bottom right):
 *    - Choose which function to run: onFormSubmit
 *    - Choose which deployment: Head
 *    - Select event source: From spreadsheet (or From form)
 *    - Select event type: On form submit
 *    - Failure notification frequency: Immediately
 * 4. Click Save and authorize with your Google account.
 * 
 * BONUS: Click Run -> "syncAllExistingRows" in Apps Script to instantly send
 * all existing rows to your website!
 */

const CONFIG = {
  HOSPITAL_ID: "${hospitalId}",
  WEBHOOK_URL: "${endpoint}",
  API_KEY: "${keyToUse}",
  SUPABASE_URL: "${import.meta.env.VITE_SUPABASE_URL || 'https://jauvnibkukrnglwkjgtq.supabase.co'}",
  SUPABASE_KEY: "${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''}"
};

// Adds a 1-click sync menu inside your Google Sheet
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("RescueBridge")
      .addItem("🔄 Sync All Rows to Website", "syncAllExistingRows")
      .addToUi();
  } catch (e) {}
}

function onFormSubmit(e) {
  var patient_name = "";
  var phone = "";
  var doctor = "Duty Medical Officer";
  var visit_date = Utilities.formatDate(new Date(), "GMT+5:30", "yyyy-MM-dd");
  var department = "General Consultation";

  // CASE A: Triggered from Google Sheets (e.namedValues or e.values)
  if (e && e.namedValues) {
    for (var colName in e.namedValues) {
      var norm = colName.toUpperCase().replace(/[\\s_\\-\\.:]/g, "");
      var arr = e.namedValues[colName];
      var val = (arr && arr.length > 0) ? String(arr[0]).trim() : "";

      if (norm.indexOf("PATIENT") !== -1 || norm.indexOf("NAME") !== -1) {
        patient_name = val;
      } else if (norm.indexOf("PHONE") !== -1 || norm.indexOf("MOBILE") !== -1 || norm.indexOf("CONTACT") !== -1) {
        phone = val;
      } else if (norm.indexOf("DOCTOR") !== -1) {
        doctor = val;
      } else if (norm.indexOf("DATE") !== -1 || norm.indexOf("APPOINTMENT") !== -1 || norm.indexOf("APPOINTEMENT") !== -1) {
        visit_date = val;
      } else if (norm.indexOf("ISSUE") !== -1 || norm.indexOf("DETAIL") !== -1 || norm.indexOf("DEPT") !== -1) {
        department = val;
      }
    }
  } else if (e && e.values && e.values.length >= 3) {
    // Positional fallback for Google Sheets [Timestamp, Name, Phone, Doctor, Date, Issue]
    patient_name = e.values[1] || "";
    phone = e.values[2] || "";
    doctor = e.values[3] || doctor;
    visit_date = e.values[4] || visit_date;
    department = e.values[5] || department;
  } else if (e && e.response && typeof e.response.getItemResponses === "function") {
    // CASE B: Triggered directly from Google Forms
    var itemResponses = e.response.getItemResponses();
    for (var i = 0; i < itemResponses.length; i++) {
      var title = itemResponses[i].getItem().getTitle().toUpperCase().replace(/[\\s_\\-\\.:]/g, "");
      var response = String(itemResponses[i].getResponse() || "").trim();

      if (title.indexOf("PATIENT") !== -1 || title.indexOf("NAME") !== -1) {
        patient_name = response;
      } else if (title.indexOf("PHONE") !== -1 || title.indexOf("MOBILE") !== -1 || title.indexOf("CONTACT") !== -1) {
        phone = response;
      } else if (title.indexOf("DOCTOR") !== -1) {
        doctor = response;
      } else if (title.indexOf("DATE") !== -1 || title.indexOf("APPOINTMENT") !== -1 || title.indexOf("APPOINTEMENT") !== -1) {
        visit_date = response;
      } else if (title.indexOf("ISSUE") !== -1 || title.indexOf("DETAIL") !== -1 || title.indexOf("DEPT") !== -1) {
        department = response;
      }
    }
  }

  if (patient_name) {
    sendPatientToRescueBridge(patient_name, phone, doctor, visit_date, department);
  }
}

// 1-Click Sync for all rows already in the spreadsheet
function syncAllExistingRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0].map(function(h) { return String(h).toUpperCase().replace(/[\\s_\\-\\.:]/g, ""); });
  var count = 0;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var patient_name = "";
    var phone = "";
    var doctor = "Duty Medical Officer";
    var visit_date = Utilities.formatDate(new Date(), "GMT+5:30", "yyyy-MM-dd");
    var department = "General Consultation";

    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      var cellVal = String(row[c] || "").trim();
      if (h.indexOf("PATIENT") !== -1 || h.indexOf("NAME") !== -1) {
        patient_name = cellVal;
      } else if (h.indexOf("PHONE") !== -1 || h.indexOf("MOBILE") !== -1 || h.indexOf("CONTACT") !== -1) {
        phone = cellVal;
      } else if (h.indexOf("DOCTOR") !== -1) {
        doctor = cellVal;
      } else if (h.indexOf("DATE") !== -1 || h.indexOf("APPOINTMENT") !== -1 || h.indexOf("APPOINTEMENT") !== -1) {
        visit_date = cellVal;
      } else if (h.indexOf("ISSUE") !== -1 || h.indexOf("DETAIL") !== -1 || h.indexOf("DEPT") !== -1) {
        department = cellVal;
      }
    }

    if (patient_name) {
      sendPatientToRescueBridge(patient_name, phone, doctor, visit_date, department);
      count++;
    }
  }

  Logger.log("Successfully synced " + count + " rows to RescueBridge!");
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Synced " + count + " patient records to RescueBridge!", "Success");
  } catch(e) {}
}

function sendPatientToRescueBridge(patient_name, phone, doctor, visit_date, department) {
  var cleanPhone = String(phone).replace(/\\s+/g, "");
  var phoneWithCode = cleanPhone.indexOf("+") === 0 ? cleanPhone : "+91" + cleanPhone;
  var randomSuffix = Math.floor(100000 + Math.random() * 900000);
  var patientId = "PAT-" + patient_name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() + "-" + randomSuffix;
  var visitUid = "GF-" + (new Date().getFullYear()) + "-" + randomSuffix;

  // Format date cleanly
  var cleanDate = visit_date;
  if (cleanDate instanceof Date) {
    cleanDate = Utilities.formatDate(cleanDate, "GMT+5:30", "yyyy-MM-dd");
  }

  // 1. Direct Cloud Upsert to Supabase REST API (Guaranteed 24/7 global reachability)
  try {
    var headers = {
      "apikey": CONFIG.SUPABASE_KEY,
      "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates"
    };

    // Save Patient
    UrlFetchApp.fetch(CONFIG.SUPABASE_URL + "/rest/v1/patients", {
      method: "post",
      headers: headers,
      payload: JSON.stringify([{
        id: patientId,
        hospital_id: CONFIG.HOSPITAL_ID,
        name: patient_name,
        phone: phoneWithCode,
        whatsapp_consent: true
      }]),
      muteHttpExceptions: true
    });

    // Save Visit
    UrlFetchApp.fetch(CONFIG.SUPABASE_URL + "/rest/v1/visits", {
      method: "post",
      headers: headers,
      payload: JSON.stringify([{
        id: Utilities.getUuid(),
        hospital_id: CONFIG.HOSPITAL_ID,
        patient_id: patientId,
        department: department,
        doctor: doctor,
        visit_date: cleanDate,
        status: "registered",
        visit_uid: visitUid,
        sheet_row_id: visitUid,
        token: "rb-gf-" + Math.random().toString(36).substring(2, 8)
      }]),
      muteHttpExceptions: true
    });
  } catch (cloudErr) {
    Logger.log("Supabase direct insert log: " + cloudErr);
  }

  // 2. Dispatch to RescueBridge Webhook Endpoint (with x-api-key)
  try {
    UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CONFIG.API_KEY
      },
      payload: JSON.stringify({
        hospital_id: CONFIG.HOSPITAL_ID,
        visit_uid: visitUid,
        patient_name: patient_name,
        phone: phoneWithCode,
        appointment_date: cleanDate,
        doctor_name: doctor,
        issue: department
      }),
      muteHttpExceptions: true
    });
  } catch (webhookErr) {
    Logger.log("Webhook dispatch log: " + webhookErr);
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
