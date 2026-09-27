import React, { useState } from 'react';
import { Building2, Star, MessageSquare, Cpu, Info, CheckCircle } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ToastContainer } from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
        <span className="p-2 bg-blue-50 rounded-lg text-blue-600">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Integration status row
// ---------------------------------------------------------------------------
function IntegrationRow({
  name,
  description,
  status,
}: {
  name: string;
  description: string;
  status: 'connected' | 'pending' | 'not_connected';
}) {
  const variant =
    status === 'connected' ? 'success' : status === 'pending' ? 'warning' : 'neutral';
  const label =
    status === 'connected' ? 'Connected' : status === 'pending' ? 'Integration pending' : 'Not connected';

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <Badge variant={variant} dot>{label}</Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Settings() {
  const { toasts, addToast, removeToast } = useToast();

  const [clinicName, setClinicName] = useState(
    import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare'
  );
  const [reviewUrl, setReviewUrl] = useState(
    import.meta.env.VITE_GOOGLE_REVIEW_URL || ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Mock save delay — replace with api.post('/settings', {...}) later
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    addToast('Settings saved successfully', 'success');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure your clinic details and integration endpoints.
        </p>
      </div>

      {/* Clinic Information */}
      <Section
        icon={<Building2 className="h-4 w-4" />}
        title="Clinic Information"
        subtitle="Displayed across the patient-facing experience"
      >
        <div className="space-y-4">
          <Input
            label="Clinic Name"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="ABC Healthcare"
          />
          <Input
            label="Clinic Phone Number"
            type="tel"
            placeholder="+91 99999 00000"
            hint="Displayed in patient communications."
          />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Clinic Logo</p>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <p className="text-sm text-slate-400">Logo upload — coming soon</p>
              <p className="text-xs text-slate-300 mt-1">PNG or SVG, max 1 MB</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Google Review */}
      <Section
        icon={<Star className="h-4 w-4" />}
        title="Google Review"
        subtitle="Where patients are redirected after positive feedback"
      >
        <Input
          label="Google Review URL"
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="https://search.google.com/local/writereview?placeid=…"
          hint="Obtain this URL from your Google Business Profile."
        />
        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-amber-700">
            This URL is used only in the patient review flow. It is never exposed as an API key. Add your real Place ID to VITE_GOOGLE_REVIEW_URL in your .env file for production.
          </p>
        </div>
      </Section>

      {/* Messaging */}
      <Section
        icon={<MessageSquare className="h-4 w-4" />}
        title="Messaging"
        subtitle="WhatsApp Business API configuration"
      >
        <div className="space-y-1">
          <IntegrationRow
            name="WhatsApp Business API"
            description="Meta Cloud API / Interakt / AiSensy"
            status="not_connected"
          />
          <div className="pt-2">
            <Input
              label="Sender Number"
              type="tel"
              placeholder="+91 99999 00000"
              disabled
              hint="Configure after WhatsApp Business API is connected."
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          WhatsApp integration is scheduled for a future phase. The frontend is structured to receive patient feedback via backend webhook once connected.
        </p>
      </Section>

      {/* AI */}
      <Section
        icon={<Cpu className="h-4 w-4" />}
        title="AI Services"
        subtitle="Voice transcription and review cleanup"
      >
        <div className="space-y-1">
          <IntegrationRow
            name="Sarvam AI"
            description="Voice note transcription — handles Indian languages"
            status="pending"
          />
          <IntegrationRow
            name="Gemini API"
            description="AI review cleanup and text optimisation"
            status="pending"
          />
        </div>
        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-blue-700">
            API keys for Sarvam and Gemini are stored securely on the backend only. They are never exposed to the frontend.
          </p>
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          icon={saving ? undefined : <CheckCircle className="h-4 w-4" />}
          loading={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
