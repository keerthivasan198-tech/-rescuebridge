/**
 * feedbackService.ts
 *
 * Mock implementation of the feedback API client.
 * All functions are structured as real async API calls so they can be
 * swapped out for `return api.post('/feedback', payload)` etc. later.
 *
 * Integration boundary:
 *   Frontend → feedbackService → (later) FastAPI / Node.js backend
 */

import type {
  Feedback,
  FeedbackResponse,
  FeedbackStats,
  FollowUpStatus,
  SubmitFeedbackPayload,
} from '../types/feedback';
import { mockFeedbackList, mockStats, mockAiTransformations } from '../data/mockData';

// Simulate network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory store so mutations persist within a session
let feedbackStore: Feedback[] = [...mockFeedbackList];

// ---------------------------------------------------------------------------
// Submit new feedback from the patient
// ---------------------------------------------------------------------------
export async function submitFeedback(
  payload: SubmitFeedbackPayload
): Promise<FeedbackResponse> {
  await delay(1200);

  const isPositive = payload.rating >= 4;
  const id = `fb-${Date.now()}`;

  const rawText =
    payload.originalFeedback ?? payload.voiceTranscript ?? '';

  // Mock AI cleanup for positive ratings
  const cleanedReview = isPositive
    ? payload.rating === 5
      ? mockAiTransformations.star5
      : mockAiTransformations.star4
    : undefined;

  const newRecord: Feedback = {
    id,
    patientName: 'Demo Patient',
    maskedPhone: '+91 ******0000',
    visitDate: new Date().toISOString().slice(0, 10),
    visitId: `VIS-DEMO-${Date.now()}`,
    rating: payload.rating,
    originalFeedback: rawText || undefined,
    cleanedReview,
    feedbackType: payload.feedbackType,
    transcriptionStatus:
      payload.feedbackType === 'voice' ? 'completed' : 'not_required',
    reviewStatus: isPositive ? 'review_ready' : 'follow_up_required',
    followUpStatus: isPositive ? 'none' : 'required',
    channel: 'web',
    feedbackSubmittedAt: new Date().toISOString(),
    whatsappSentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  feedbackStore = [newRecord, ...feedbackStore];

  return {
    success: true,
    feedbackId: id,
    reviewStatus: newRecord.reviewStatus,
    cleanedReview,
    message: isPositive
      ? "Thank you! We've prepared your feedback for a quick review."
      : 'Thank you for your feedback. Our team will review this and get back to you if needed.',
  };
}

// ---------------------------------------------------------------------------
// Get paginated / filtered feedback list (staff)
// ---------------------------------------------------------------------------
export async function getFeedback(params?: {
  search?: string;
  rating?: number | null;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Feedback[]> {
  await delay(400);

  let results = [...feedbackStore];

  if (params?.search) {
    const q = params.search.toLowerCase();
    results = results.filter(
      (f) =>
        f.patientName.toLowerCase().includes(q) ||
        f.visitId.toLowerCase().includes(q)
    );
  }

  if (params?.rating != null) {
    results = results.filter((f) => f.rating === params.rating);
  }

  if (params?.status && params.status !== 'all') {
    results = results.filter((f) => f.reviewStatus === params.status);
  }

  if (params?.dateFrom) {
    results = results.filter((f) => f.visitDate >= params.dateFrom!);
  }

  if (params?.dateTo) {
    results = results.filter((f) => f.visitDate <= params.dateTo!);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Get a single feedback record by ID
// ---------------------------------------------------------------------------
export async function getFeedbackById(id: string): Promise<Feedback | null> {
  await delay(300);
  return feedbackStore.find((f) => f.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Update the follow-up status (staff action)
// ---------------------------------------------------------------------------
export async function updateFollowUpStatus(
  id: string,
  status: FollowUpStatus
): Promise<boolean> {
  await delay(500);
  const idx = feedbackStore.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  feedbackStore[idx] = { ...feedbackStore[idx], followUpStatus: status };
  return true;
}

// ---------------------------------------------------------------------------
// Record that the patient opened the review link
// ---------------------------------------------------------------------------
export async function markReviewOpened(id: string): Promise<boolean> {
  await delay(200);
  const idx = feedbackStore.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  feedbackStore[idx] = {
    ...feedbackStore[idx],
    reviewStatus: 'redirected',
    reviewOpenedAt: new Date().toISOString(),
  };
  return true;
}

// ---------------------------------------------------------------------------
// Record that the patient completed the Google review
// ---------------------------------------------------------------------------
export async function markReviewCompleted(id: string): Promise<boolean> {
  await delay(200);
  const idx = feedbackStore.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  feedbackStore[idx] = {
    ...feedbackStore[idx],
    reviewStatus: 'completed',
    reviewCompletedAt: new Date().toISOString(),
  };
  return true;
}

// ---------------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------------
export async function getFeedbackStats(): Promise<FeedbackStats> {
  await delay(300);
  return { ...mockStats };
}
