import React, { useState } from 'react';
import { Check, Code2, Globe } from 'lucide-react';
import { AppSettings, ServiceType } from '../types/crm';

interface WebLeadIntakeViewProps {
  settings: AppSettings;
  onSubmitWebLead: (payload: {
    company: string;
    contact: string;
    email: string;
    phone: string;
    city: string;
    service: ServiceType;
    notes: string;
  }) => void;
}

export const WebLeadIntakeView: React.FC<WebLeadIntakeViewProps> = ({
  settings,
  onSubmitWebLead,
}) => {
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [service, setService] = useState<ServiceType>('ISO 27001');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const embedCode = `<iframe src="https://drishti.shreeqasolutions.com/intake-embed" title="SQAS Compliance Inquiry" width="100%" height="520" frameborder="0"></iframe>`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !contact.trim()) return;
    onSubmitWebLead({
      company: company.trim(),
      contact: contact.trim(),
      email: email.trim(),
      phone: phone.trim(),
      city: city.trim(),
      service,
      notes: notes.trim(),
    });
    setCompany('');
    setContact('');
    setEmail('');
    setPhone('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-text">Website Lead-Capture Form</h2>
        <p className="mt-0.5 text-sm text-muted">
          Embeddable inquiry form for shreeqasolutions.com. Submissions create a Lead in the Sales
          Pipeline tagged under Source: Website.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Interactive Form Preview */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 rounded-xl border border-border bg-surface p-6 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-display text-sm font-semibold text-text">
              Live Form Preview (Submit to test Pipeline intake)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block font-medium text-text-secondary mb-1">Company Name</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Horizon FinTech India Pvt. Ltd."
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block font-medium text-text-secondary mb-1">Contact Person</label>
              <input
                type="text"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block font-medium text-text-secondary mb-1">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.in"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block font-medium text-text-secondary mb-1">Phone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98..."
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block font-medium text-text-secondary mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-text-secondary mb-1">
                Certification / Service Needed
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value as ServiceType)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              >
                {settings.services.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-text-secondary mb-1">
                Target Timeline / Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Need ISO 27001 certification before enterprise audit in Q1."
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="rounded-lg bg-primary-strong hover:bg-primary-strong px-5 py-2.5 text-xs font-medium text-on-primary transition-colors"
            >
              Submit Inquiry to Pipeline
            </button>
          </div>
        </form>

        {/* Embed Code & Intake Routing */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2 font-display text-sm font-semibold text-text">
            <Code2 className="h-4 w-4 text-muted" />
            <span>Website Embed & Routing Rules</span>
          </div>

          <div className="space-y-2 text-text-secondary">
            <div>
              • Automatically sets Lead Source (Col AB) to{' '}
              <span className="font-medium text-text">Website</span>
            </div>
            <div>
              • Assigns CMMI / CMMC inquiries to{' '}
              <span className="font-medium text-text">Mahesh Kulkarni</span>; ISO / GRC to{' '}
              <span className="font-medium text-text">Pramila Rao</span>
            </div>
            <div>• Schedules first follow-up check in {settings.followUpIntervalDays} days</div>
          </div>

          <div>
            <div className="font-medium text-text-secondary mb-1.5">HTML Embed Snippet</div>
            <pre className="rounded-lg border border-border bg-bg p-3 font-mono text-[11px] text-text-secondary overflow-x-auto">
              {embedCode}
            </pre>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(embedCode);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : null}
              <span>{copied ? 'Copied Snippet' : 'Copy Embed Code'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
