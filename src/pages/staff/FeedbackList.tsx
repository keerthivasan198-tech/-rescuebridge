import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, MessageSquare } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { ReviewStatusBadge, FollowUpBadge } from '../../components/ui/StatusIndicator';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { getFeedback } from '../../services/feedbackService';
import type { Feedback } from '../../types/feedback';
import { formatDate } from '../../utils/formatters';

const ratingOptions = [
  { value: 'all', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'review_ready', label: 'Review Ready' },
  { value: 'redirected', label: 'Redirected' },
  { value: 'completed', label: 'Completed' },
  { value: 'follow_up_required', label: 'Follow-up Required' },
];

export default function FeedbackList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('all');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getFeedback({
      search: search || undefined,
      rating: rating !== 'all' ? parseInt(rating, 10) : null,
      status: status !== 'all' ? status : undefined,
    })
      .then(setFeedbackList)
      .finally(() => setLoading(false));
  }, [search, rating, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Feedback</h1>
        <p className="text-sm text-slate-500 mt-0.5">All patient feedback submissions.</p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by patient name or visit ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              aria-label="Search feedback"
            />
          </div>
          <div className="flex gap-3">
            <Select
              options={ratingOptions}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              aria-label="Filter by rating"
            />
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            />
          </div>
        </div>
      </Card>

      {/* Results */}
      <Card padding="none">
        {loading ? (
          <PageSpinner message="Loading feedback…" />
        ) : feedbackList.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-10 w-10" />}
            title="No feedback found"
            description="Try adjusting your filters or check back after patients submit feedback."
          />
        ) : (
          <>
            {/* Desktop header */}
            <div
              className="hidden lg:grid gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-t-xl"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr 1fr auto' }}
            >
              <span>Patient</span>
              <span>Visit Date</span>
              <span>Rating</span>
              <span>Feedback</span>
              <span>Channel</span>
              <span>Review Status</span>
              <span>Follow-up</span>
              <span />
            </div>

            <ul className="divide-y divide-slate-100">
              {feedbackList.map((fb) => (
                <li key={fb.id}>
                  {/* Desktop row */}
                  <div
                    className="hidden lg:grid gap-4 items-center px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr 1fr auto' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                        {fb.patientName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{fb.patientName}</p>
                        <p className="text-xs text-slate-400 truncate">{fb.maskedPhone}</p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600">{formatDate(fb.visitDate)}</p>

                    <StarRating value={fb.rating} readonly size="sm" />

                    <p className="text-sm text-slate-500 truncate italic">
                      {fb.originalFeedback ?? 'No text feedback'}
                    </p>

                    <Badge variant={fb.channel === 'whatsapp' ? 'info' : 'neutral'}>
                      {fb.channel === 'whatsapp' ? 'WhatsApp' : 'Web'}
                    </Badge>

                    <ReviewStatusBadge status={fb.reviewStatus} />

                    <FollowUpBadge status={fb.followUpStatus} />

                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronRight className="h-4 w-4" />}
                      onClick={() => navigate(`/staff/feedback/${fb.id}`)}
                      aria-label={`View details for ${fb.patientName}`}
                    />
                  </div>

                  {/* Mobile card */}
                  <button
                    className="lg:hidden w-full flex items-start gap-4 px-4 py-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    onClick={() => navigate(`/staff/feedback/${fb.id}`)}
                    aria-label={`View feedback from ${fb.patientName}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                      {fb.patientName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{fb.patientName}</p>
                        <StarRating value={fb.rating} readonly size="sm" />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {fb.originalFeedback ?? 'No text feedback provided.'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <ReviewStatusBadge status={fb.reviewStatus} />
                        {fb.followUpStatus !== 'none' && <FollowUpBadge status={fb.followUpStatus} />}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <p className="text-xs text-slate-400">
                {feedbackList.length} record{feedbackList.length !== 1 ? 's' : ''} shown
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
