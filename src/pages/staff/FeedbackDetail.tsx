import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Hash,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Copy,
  ExternalLink,
  MessageSquare,
  Mic,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StarRating } from '../../components/ui/StarRating';
import { Timeline } from '../../components/ui/Timeline';
import type { TimelineStep } from '../../components/ui/Timeline';
import { ReviewStatusBadge, FollowUpBadge } from '../../components/ui/StatusIndicator';
import { PageSpinner } from '../../components/ui/Spinner';
import { ToastContainer } from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { useClipboard } from '../../hooks/useClipboard';
import { getFeedbackById, updateFollowUpStatus } from '../../services/feedbackService';
import type { Feedback, FollowUpStatus } from '../../types/feedback';
import { formatDate, formatDateTime } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Build timeline from a feedback record
// ---------------------------------------------------------------------------
function buildTimeline(fb: Feedback): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: 'Visit completed',
      timestamp: formatDate(fb.visitDate),
      status: 'completed',
    },
    {
      label: 'WhatsApp message sent',
      timestamp: fb.whatsappSentAt ? formatDateTime(fb.whatsappSentAt) : undefined,
      status: fb.whatsappSentAt ? 'completed' : 'pending',
    },
    {
      label: 'Feedback received',
      timestamp: fb.feedbackSubmittedAt ? formatDateTime(fb.feedbackSubmittedAt) : undefined,
      status: fb.feedbackSubmittedAt ? 'completed' : 'pending',
    },
  ];

  if (fb.rating >= 4) {
    steps.push({
      label: 'AI review prepared',
      status: fb.cleanedReview ? 'completed' : fb.feedbackSubmittedAt ? 'current' : 'pending',
      description: fb.cleanedReview ? 'Review text generated' : undefined,
    });
    steps.push({
      label: 'Review link opened',
      timestamp: fb.reviewOpenedAt ? formatDateTime(fb.reviewOpenedAt) : undefined,
      status: fb.reviewOpenedAt ? 'completed' : 'pending',
    });
    steps.push({
      label: 'Google review completed',
      timestamp: fb.reviewCompletedAt ? formatDateTime(fb.reviewCompletedAt) : undefined,
      status: fb.reviewCompletedAt ? 'completed' : 'pending',
    });
  } else {
    steps.push({
      label: 'Staff follow-up required',
      status: fb.feedbackSubmittedAt ? 'current' : 'pending',
      description: 'Low rating — no Google review redirection.',
    });
    steps.push({
      label: 'Follow-up resolved',
      status: fb.followUpStatus === 'resolved' ? 'completed' : 'pending',
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const { copy } = useClipboard();

  const [fb, setFb] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getFeedbackById(id)
      .then(setFb)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFollowUp = async (status: FollowUpStatus) => {
    if (!id || !fb) return;
    setUpdatingFollowUp(true);
    const ok = await updateFollowUpStatus(id, status);
    setUpdatingFollowUp(false);
    if (ok) {
      setFb({ ...fb, followUpStatus: status });
      addToast(`Follow-up marked as ${status}`, 'success');
    }
  };

  const handleCopyReview = async () => {
    if (!fb?.cleanedReview) return;
    const ok = await copy(fb.cleanedReview);
    addToast(
      ok ? 'Review text copied to clipboard' : 'Copy failed — please select the text manually',
      ok ? 'success' : 'warning'
    );
  };

  if (loading) return <PageSpinner message="Loading feedback…" />;

  if (!fb) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Feedback record not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const isLowRating = fb.rating <= 3;
  const timeline = buildTimeline(fb);

  return (
    <div className="space-y-5 max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Back + status */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <div className="flex-1" />
        <ReviewStatusBadge status={fb.reviewStatus} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Patient info */}
          <Card>
            <CardHeader title="Patient Information" className="mb-4" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { icon: <Hash className="h-4 w-4 text-slate-400" />, label: 'Visit ID', value: fb.visitId },
                { icon: <Calendar className="h-4 w-4 text-slate-400" />, label: 'Visit Date', value: formatDate(fb.visitDate) },
                { icon: <Phone className="h-4 w-4 text-slate-400" />, label: 'Phone', value: fb.maskedPhone },
                {
                  icon: <MessageSquare className="h-4 w-4 text-slate-400" />,
                  label: 'Channel',
                  value: (
                    <Badge variant={fb.channel === 'whatsapp' ? 'info' : 'neutral'}>
                      {fb.channel === 'whatsapp' ? 'WhatsApp' : 'Web'}
                    </Badge>
                  ),
                },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="mt-0.5">{icon}</span>
                  <div>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Card>

          {/* Rating + feedback */}
          <Card>
            <CardHeader title="Feedback" className="mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <StarRating value={fb.rating} readonly size="lg" />
              <span className="text-2xl font-bold text-slate-900">
                {fb.rating}
                <span className="text-base font-normal text-slate-400">/5</span>
              </span>
              {fb.feedbackType === 'voice' && (
                <Badge variant="info">
                  <Mic className="h-3 w-3 inline mr-1" aria-hidden />
                  Voice
                </Badge>
              )}
            </div>

            {fb.originalFeedback ? (
              <div className="bg-slate-50 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Original Feedback
                </p>
                <p className="text-sm text-slate-700 italic">"{fb.originalFeedback}"</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic mb-4">No text feedback provided.</p>
            )}

            {!isLowRating && fb.cleanedReview && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-teal-600" aria-hidden />
                    <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                      AI-Prepared Review
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={handleCopyReview}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-teal-900 italic">"{fb.cleanedReview}"</p>
                <p className="text-xs text-teal-600 mt-2">
                  AI-generated text should preserve the patient's original meaning. Staff or patient
                  review is recommended before publication.
                </p>
              </div>
            )}
          </Card>

          {/* Low rating follow-up */}
          {isLowRating && (
            <Card className="border-red-200 bg-red-50">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold text-red-800">Follow-up Required</h3>
                  <p className="text-sm text-red-600 mt-1">
                    Patient submitted a {fb.rating}-star rating. This feedback is handled internally
                    — no Google review redirection is shown to this patient.
                  </p>
                </div>
              </div>
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1.5">Current status</p>
                <FollowUpBadge status={fb.followUpStatus} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={updatingFollowUp}
                  disabled={fb.followUpStatus === 'contacted' || fb.followUpStatus === 'resolved'}
                  onClick={() => handleFollowUp('contacted')}
                >
                  Mark as Contacted
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  icon={<CheckCircle className="h-4 w-4" />}
                  loading={updatingFollowUp}
                  disabled={fb.followUpStatus === 'resolved'}
                  onClick={() => handleFollowUp('resolved')}
                >
                  Mark as Resolved
                </Button>
              </div>
            </Card>
          )}

          {/* Positive review actions */}
          {!isLowRating && (
            <Card>
              <CardHeader title="Review Actions" className="mb-4" />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!fb.cleanedReview}
                  onClick={handleCopyReview}
                >
                  Copy Review Text
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => navigate(`/patient/review/${fb.id}`)}
                >
                  Open Review Page
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Right column — timeline + statuses */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Journey Timeline" className="mb-5" />
            <Timeline steps={timeline} />
          </Card>

          <Card>
            <CardHeader title="Statuses" className="mb-4" />
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-slate-500 mb-1">Review Status</dt>
                <dd><ReviewStatusBadge status={fb.reviewStatus} /></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 mb-1">Follow-up Status</dt>
                <dd><FollowUpBadge status={fb.followUpStatus} /></dd>
              </div>
              {fb.feedbackSubmittedAt && (
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Submitted</dt>
                  <dd className="text-sm text-slate-700">{formatDateTime(fb.feedbackSubmittedAt)}</dd>
                </div>
              )}
              {fb.reviewCompletedAt && (
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Review completed</dt>
                  <dd className="text-sm text-slate-700">{formatDateTime(fb.reviewCompletedAt)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
