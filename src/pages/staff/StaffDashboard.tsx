import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Send,
  MessageSquare,
  Star,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { StarRating } from '../../components/ui/StarRating';
import { ReviewStatusBadge } from '../../components/ui/StatusIndicator';
import { getFeedbackStats, getFeedback } from '../../services/feedbackService';
import type { FeedbackStats, Feedback } from '../../types/feedback';
import { formatDate, relativeTime } from '../../utils/formatters';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  accent?: string;
}

function StatCard({ label, value, icon, trend, trendLabel, accent = 'text-blue-600' }: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <span className={accent}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {trend !== undefined && (
          <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {isPositive
              ? <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
            {Math.abs(trend)}% {trendLabel ?? 'vs last month'}
          </p>
        )}
      </div>
    </Card>
  );
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [recent, setRecent] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFeedbackStats(), getFeedback()])
      .then(([s, f]) => {
        setStats(s);
        setRecent(f.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner message="Loading dashboard…" />;
  if (!stats) return null;

  const statCards: StatCardProps[] = [
    {
      label: 'Total Visits',
      value: stats.totalVisits.toLocaleString(),
      icon: <Users className="h-5 w-5" aria-hidden />,
      trend: 4.2,
      accent: 'text-blue-600',
    },
    {
      label: 'Feedback Requests Sent',
      value: stats.requestsSent.toLocaleString(),
      icon: <Send className="h-5 w-5" aria-hidden />,
      trend: 3.8,
      accent: 'text-teal-600',
    },
    {
      label: 'Responses Received',
      value: stats.responsesReceived.toLocaleString(),
      icon: <MessageSquare className="h-5 w-5" aria-hidden />,
      trend: 6.1,
      trendLabel: `(${stats.responseRate}% rate)`,
      accent: 'text-indigo-600',
    },
    {
      label: 'Google Reviews Completed',
      value: stats.googleReviewsCompleted.toLocaleString(),
      icon: <Star className="h-5 w-5" aria-hidden />,
      trend: 8.4,
      trendLabel: `(${stats.conversionRate}% conversion)`,
      accent: 'text-amber-500',
    },
    {
      label: 'Follow-ups Required',
      value: stats.followUpsRequired,
      icon: <AlertTriangle className="h-5 w-5" aria-hidden />,
      trend: -2.1,
      trendLabel: 'vs last month',
      accent: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Patient feedback activity at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Follow-up alert */}
      {stats.followUpsRequired > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {stats.followUpsRequired} patients require follow-up
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              These patients submitted low ratings. Review their feedback and reach out where appropriate.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => navigate('/staff/feedback?status=follow_up_required')}
          >
            View
          </Button>
        </div>
      )}

      {/* Recent feedback */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Feedback</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest patient submissions</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowRight className="h-4 w-4" />}
            iconPosition="right"
            onClick={() => navigate('/staff/feedback')}
          >
            View all
          </Button>
        </div>

        <ul className="divide-y divide-slate-100">
          {recent.map((fb) => (
            <li key={fb.id}>
              <button
                className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                onClick={() => navigate(`/staff/feedback/${fb.id}`)}
                aria-label={`View feedback from ${fb.patientName}`}
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold shrink-0">
                  {fb.patientName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900 truncate">{fb.patientName}</p>
                    <StarRating value={fb.rating} readonly size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {fb.originalFeedback ?? 'No text feedback provided.'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <ReviewStatusBadge status={fb.reviewStatus} />
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" aria-hidden />
                    {fb.feedbackSubmittedAt ? relativeTime(fb.feedbackSubmittedAt) : formatDate(fb.visitDate)}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {recent.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No feedback received yet.</p>
        )}
      </Card>

      {/* Integration status */}
      <Card className="bg-slate-50 border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Integration Status
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'WhatsApp', status: 'Not connected' },
            { name: 'Sarvam AI', status: 'Integration pending' },
            { name: 'Gemini AI', status: 'Integration pending' },
            { name: 'Google Reviews', status: 'Configure URL' },
          ].map(({ name, status }) => (
            <div key={name} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
              <p className="text-xs font-medium text-slate-700">{name}</p>
              <Badge variant="neutral" className="mt-1">{status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
