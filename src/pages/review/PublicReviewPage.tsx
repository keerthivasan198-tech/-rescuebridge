import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Star,
  Building2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Send,
  HeartHandshake,
} from 'lucide-react';
import { db } from '../../services/db';
import { Visit } from '../../types/database';

export default function PublicReviewPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('visit_id') || 'token-citycare-kavitha-001';

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isLowRating, setIsLowRating] = useState(false);

  useEffect(() => {
    async function loadVisit() {
      setLoading(true);
      try {
        const found = await db.getVisitByToken(token);
        if (found) {
          setVisit(found);
          if (found.review_request?.rating) {
            setRating(found.review_request.rating);
            setFeedbackText(found.review_request.feedback_text || '');
            if (found.review_request.rating >= 4) {
              const placeId = found.hospital?.google_place_id || 'ChIJN1t_tDeuEmsRUsoyG83frY4';
              setRedirectUrl(`https://search.google.com/local/writereview?placeid=${placeId}`);
            } else {
              setIsLowRating(true);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load visit for review:', err);
      } finally {
        setLoading(false);
      }
    }
    loadVisit();
  }, [token]);

  const handleStarClick = async (starValue: number) => {
    setRating(starValue);
    if (starValue >= 4) {
      // 4-5 stars: Save immediately and prepare Google redirect
      setSubmitting(true);
      try {
        const result = await db.submitReview({
          tokenOrId: token,
          rating: starValue,
        });
        setSubmitting(false);
        setSubmitted(true);
        if (result.redirectUrl) {
          setRedirectUrl(result.redirectUrl);
          // Redirect after brief celebration
          setTimeout(() => {
            window.location.href = result.redirectUrl!;
          }, 1800);
        }
      } catch (err) {
        console.error(err);
        setSubmitting(false);
      }
    } else {
      // 1-3 stars: Show private feedback box
      setIsLowRating(true);
    }
  };

  const handlePrivateFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await db.submitReview({
        tokenOrId: token,
        rating,
        feedbackText,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading your review session...</p>
        </div>
      </div>
    );
  }

  const hospitalName = visit?.hospital?.name || 'Hospital Care Partner';
  const hospitalLogo = visit?.hospital?.logo;
  const patientName = visit?.patient?.name || 'Valued Patient';
  const doctorName = visit?.doctor || 'your consulting physician';
  const department = visit?.department || 'Outpatient Services';

  const starLabels: Record<number, string> = {
    1: 'Poor Experience',
    2: 'Needs Improvement',
    3: 'Average / Fair',
    4: 'Very Good Experience',
    5: 'Excellent 5-Star Care!',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-white to-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-md mx-auto">
        {/* Header / Branding */}
        <div className="text-center mb-8">
          {hospitalLogo ? (
            <img
              src={hospitalLogo}
              alt={hospitalName}
              className="w-16 h-16 rounded-2xl mx-auto mb-3 object-cover shadow-sm border border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
              <Building2 className="w-8 h-8" />
            </div>
          )}

          <h1 className="text-2xl font-bold text-slate-900">{hospitalName}</h1>
          <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Patient Review
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
          {/* Patient visit summary */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Consultation Details
            </p>
            <p className="text-base font-bold text-slate-800 mt-1">Hello, {patientName}</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Consultation with <span className="font-medium text-slate-900">{doctorName}</span> ({department})
            </p>
          </div>

          {!submitted ? (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">
                  How would you rate your visit?
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Your feedback helps us continuously improve our patient care.
                </p>
              </div>

              {/* Star selector */}
              <div className="flex justify-center items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => handleStarClick(star)}
                      className="p-1 sm:p-2 transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          active
                            ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Rating Description Label */}
              <div className="h-6 text-center mb-6">
                {(hoverRating || rating) > 0 ? (
                  <span className="text-sm font-semibold text-slate-800 animate-fade-in">
                    {starLabels[hoverRating || rating]}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Tap a star to rate</span>
                )}
              </div>

              {/* 1-3 Stars: Private feedback box */}
              {isLowRating && rating > 0 && rating <= 3 && (
                <form onSubmit={handlePrivateFeedbackSubmit} className="space-y-4 pt-4 border-t border-slate-100 animate-slide-up">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 leading-relaxed">
                      We are truly sorry your visit did not meet your expectations. Please share details below so our hospital management can personally investigate and resolve this.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Private feedback for hospital director
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Please tell us what went wrong (waiting time, nursing, billing, doctor consultation, etc.)..."
                      className="w-full text-sm rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !feedbackText.trim()}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {submitting ? (
                      'Sending to Hospital Management...'
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Private Feedback
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            // Submitted Confirmation View
            <div className="text-center py-4 space-y-4 animate-slide-up">
              {rating >= 4 ? (
                <>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Thank you for the {rating}★ review!
                  </h2>
                  <p className="text-sm text-slate-600">
                    We are redirecting you to Google Reviews so others can learn about your experience with <span className="font-semibold">{hospitalName}</span>.
                  </p>

                  {redirectUrl && (
                    <div className="pt-2">
                      <a
                        href={redirectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-6 rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Google Reviews Now
                      </a>
                      <p className="text-[11px] text-slate-400 mt-2">
                        If not redirected automatically, tap the button above.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                    <HeartHandshake className="w-9 h-9" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Feedback Received
                  </h2>
                  <p className="text-sm text-slate-600">
                    Thank you, {patientName}. Your concerns have been privately forwarded to the Hospital Admin and Patient Relations Director. We will follow up to ensure your experience is made right.
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    Confidential Report ID: <span className="font-mono">{visit?.sheet_row_id || visit?.id.slice(0, 8)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by RescueBridge Hospital Patient Feedback Infrastructure
        </p>
      </div>
    </div>
  );
}
