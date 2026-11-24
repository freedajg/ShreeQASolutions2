import React, { useState } from 'react';
import { CheckCircle2, Plus, Send, X } from 'lucide-react';
import { Client, Engagement, InvoiceRecord } from '../types/crm';
import { formatDateDDMMMYYYY, formatINR } from '../utils/formatters';

interface InvoicingViewProps {
  clientsById: Record<string, Client>;
  engagements: Engagement[];
  invoices: InvoiceRecord[];
  onCreateInvoice: (
    engagementId: string,
    amountINR: number,
    provider: 'Tally Prime' | 'Zoho Books',
    invoiceNo: string,
  ) => void;
  onSetInvoiceStatus: (
    invoiceId: string,
    status: 'Sent' | 'Paid' | 'Partially Paid' | 'Overdue',
  ) => void;
}

// Invoices are kept in Drishti and update Payment Status (Col Z). The Tally / Zoho connection
// is phase 2 (the client hasn't chosen yet), so nothing is synced and the screen says so.

export const InvoicingView: React.FC<InvoicingViewProps> = ({
  clientsById,
  engagements,
  invoices,
  onCreateInvoice,
  onSetInvoiceStatus,
}) => {
  const billable = engagements.filter(
    (e) => !e.archived && e.status !== 'Lead' && e.status !== 'Closed',
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [engId, setEngId] = useState(billable[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [provider, setProvider] = useState<'Tally Prime' | 'Zoho Books'>('Tally Prime');

  const totalPaid = invoices
    .filter((i) => i.status === 'Paid')
    .reduce((s, i) => s + i.amountINR + i.gstAmountINR, 0);
  const totalOverdue = invoices
    .filter((i) => i.status === 'Overdue')
    .reduce((s, i) => s + i.amountINR + i.gstAmountINR, 0);
  const totalOpen = invoices
    .filter((i) => i.status === 'Sent' || i.status === 'Partially Paid')
    .reduce((s, i) => s + i.amountINR + i.gstAmountINR, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">Invoicing</h2>
          <p className="mt-0.5 text-sm text-muted">
            GST invoices per engagement; marking one paid updates Payment Status (Col Z). Tally /
            Zoho sync comes in phase 2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong hover:bg-primary-strong px-3.5 py-1.5 text-xs font-medium text-on-primary whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New GST Invoice</span>
          </button>
        </div>
      </div>

      {/* Unified Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border rounded-xl border border-border bg-surface">
        <div className="p-4">
          <div className="text-xs text-muted">Collected (incl. 18% GST)</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-success tabular-nums">
            {formatINR(totalPaid)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted">Open / Partially Paid</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-text tabular-nums">
            {formatINR(totalOpen)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted">Overdue Receivables</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-danger tabular-nums">
            {formatINR(totalOverdue)}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium text-muted">
              <th className="py-3 px-4">Invoice No.</th>
              <th className="py-3 px-4">Client & Engagement</th>
              <th className="py-3 px-4">Issued / Due</th>
              <th className="py-3 px-4">Accounting Ledger</th>
              <th className="py-3 px-4 text-right">Total (incl. GST)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((inv) => {
              const c = clientsById[inv.clientId];
              const e = engagements.find((x) => x.id === inv.engagementId);
              return (
                <tr key={inv.id} className="hover:bg-bg/70">
                  <td className="py-3.5 px-4 font-mono font-medium text-text">{inv.invoiceNo}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-text">{c?.name}</div>
                    <div className="text-muted">{e?.service}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-text-secondary tabular-nums">
                    <div>{formatDateDDMMMYYYY(inv.issuedDate)}</div>
                    <div className="text-[11px]">Due {formatDateDDMMMYYYY(inv.dueDate)}</div>
                  </td>
                  <td className="py-3.5 px-4 text-text-secondary">
                    <div>{inv.syncProvider}</div>
                    <div
                      className={`text-[11px] ${inv.syncStatus === 'Synced' ? 'text-success' : 'text-muted'}`}
                    >
                      {inv.syncStatus}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-text tabular-nums">
                    {formatINR(inv.amountINR + inv.gstAmountINR)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`font-medium ${
                        inv.status === 'Paid'
                          ? 'text-success'
                          : inv.status === 'Overdue'
                            ? 'text-danger'
                            : 'text-warning'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex gap-1.5">
                      {inv.status === 'Draft' && (
                        <button
                          type="button"
                          onClick={() => onSetInvoiceStatus(inv.id, 'Sent')}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg"
                        >
                          <Send className="h-3.5 w-3.5 text-primary" />
                          <span>Mark Sent</span>
                        </button>
                      )}
                      {inv.status !== 'Paid' && (
                        <button
                          type="button"
                          onClick={() => onSetInvoiceStatus(inv.id, 'Paid')}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          <span>Mark Paid</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-raised"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-display text-lg font-semibold text-text">New GST Invoice</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = Number(amount);
                if (!engId || !invoiceNo.trim() || !Number.isFinite(value) || value <= 0) return;
                onCreateInvoice(engId, value, provider, invoiceNo);
                setModalOpen(false);
                setAmount('');
                setInvoiceNo('');
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-text-secondary mb-1">Engagement</label>
                <select
                  value={engId}
                  onChange={(e) => setEngId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                >
                  {billable.map((e) => (
                    <option key={e.id} value={e.id}>
                      {clientsById[e.clientId]?.name} — {e.service}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">Invoice No.</label>
                <input
                  type="text"
                  required
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="e.g. SQAS/26-27/104"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Taxable Amount (₹, +18% GST auto-calculated)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Accounting tool (for the future sync)
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'Tally Prime' | 'Zoho Books')}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                >
                  <option value="Tally Prime">Tally Prime</option>
                  <option value="Zoho Books">Zoho Books</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-border px-3.5 py-2 font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-strong text-on-primary px-4 py-2 font-medium"
                >
                  Save Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
