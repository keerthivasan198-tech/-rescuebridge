// ==============================================================
// Google Forms & Hospital Webhook Routes (Security Checklist #1, #3, #4)
// ==============================================================

const express = require('express');
const router = express.Router();
const { verifyApiKey } = require('../middleware/auth');
const { strictWebhookLimiter } = require('../middleware/rateLimiter');
const { sanitizeString, sanitizePhone } = require('../utils/inputValidator');
const { supabaseRequest } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

// In-memory FIFO queue for instant webhook responses (no unsafe unencrypted disk files)
const MAX_QUEUE_SIZE = 500;
let formQueue = [];

// -------------------------------------------------------------
// POST /api/form-webhook
// Authenticated webhook endpoint called by Google Apps Script
// -------------------------------------------------------------
router.post('/form-webhook', strictWebhookLimiter, verifyApiKey, async (req, res) => {
  try {
    const { hospital_id, visit_uid, patient_name, phone, appointment_date, doctor_name, issue } = req.body || {};

    if (!hospital_id || !patient_name || !phone) {
      return res.status(400).json({ error: 'Missing required fields: hospital_id, patient_name, phone.' });
    }

    const cleanHospitalId = sanitizeString(hospital_id, 64);
    const cleanName = sanitizeString(patient_name, 100);
    const formattedPhone = sanitizePhone(phone);
    const cleanDigits = formattedPhone.replace(/\D/g, '');

    const cleanDoctor = sanitizeString(doctor_name || 'Duty Medical Officer', 100);
    const cleanIssue = sanitizeString(issue || 'General Consultation', 200);
    const cleanDate = appointment_date ? sanitizeString(appointment_date, 30) : new Date().toISOString().split('T')[0];

    const cleanSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
    const patientId = `PAT-${cleanSlug}-${cleanDigits.slice(-6)}`;
    const effectiveVisitUid = visit_uid ? sanitizeString(visit_uid, 50) : `GF-${cleanSlug}-${Date.now().toString().slice(-6)}`;

    // 1. Upsert Patient
    await supabaseRequest('patients', {
      method: 'POST',
      body: {
        id: patientId,
        hospital_id: cleanHospitalId,
        name: cleanName,
        phone: formattedPhone,
        whatsapp_consent: true,
      },
      headers: { Prefer: 'resolution=merge-duplicates' },
    });

    // 2. Upsert Visit
    const visitId = `visit-${cleanHospitalId.slice(0, 8)}-${cleanSlug}-${cleanDigits.slice(-4)}-${cleanDate.replace(/-/g, '')}`;
    const token = `rb-gf-${cleanSlug}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;

    await supabaseRequest('visits', {
      method: 'POST',
      body: {
        id: visitId,
        hospital_id: cleanHospitalId,
        patient_id: patientId,
        department: cleanIssue,
        doctor: cleanDoctor,
        visit_date: cleanDate,
        status: 'registered',
        visit_uid: effectiveVisitUid,
        sheet_row_id: effectiveVisitUid,
        token: token,
        historical: false,
        review_requested: false,
      },
      headers: { Prefer: 'resolution=merge-duplicates' },
    });

    logger.info('Webhook visit recorded successfully', {
      hospital_id: cleanHospitalId,
      patient_name: cleanName,
      phone: formattedPhone,
    });

    return res.status(200).json({
      success: true,
      message: 'Visit created successfully',
      visit_id: visitId,
    });
  } catch (err) {
    logger.error('Error processing form webhook', err);
    return res.status(500).json({ error: 'Internal server error while processing webhook.' });
  }
});

// -------------------------------------------------------------
// POST /api/google-form-response
// Ingestion receiver for public and embedded form submissions
// -------------------------------------------------------------
router.post('/google-form-response', strictWebhookLimiter, (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON payload.' });
    }

    const submission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      received_at: new Date().toISOString(),
      ...data,
    };

    formQueue.push(submission);
    if (formQueue.length > MAX_QUEUE_SIZE) {
      formQueue.shift(); // Evict oldest
    }

    logger.info('Google Form submission queued', {
      name: data.patient_name || data.name,
      phone: data.phone || data.mobile,
    });

    return res.status(200).json({ success: true, message: 'Response received', submission });
  } catch (err) {
    logger.error('Error queuing form response', err);
    return res.status(500).json({ error: 'Failed to process form submission.' });
  }
});

// -------------------------------------------------------------
// GET /api/google-form-responses
// Polling endpoint for frontend client
// -------------------------------------------------------------
router.get('/google-form-responses', (req, res) => {
  return res.status(200).json({ queue: formQueue });
});

// -------------------------------------------------------------
// POST /api/google-form-responses/clear
// Acknowledges and clears processed queue items
// -------------------------------------------------------------
router.post('/google-form-responses/clear', (req, res) => {
  try {
    const { ids } = req.body || {};
    if (Array.isArray(ids) && ids.length > 0) {
      formQueue = formQueue.filter((item) => !ids.includes(item.id));
    } else {
      formQueue = [];
    }
    return res.status(200).json({ success: true, countRemaining: formQueue.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear processed queue.' });
  }
});

module.exports = router;
