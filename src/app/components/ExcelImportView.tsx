import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { AppSettings, Client, ImportBatchRecord, TeamMember } from '../types/crm';
import { formatTimestampIST } from '../utils/formatters';
import { flagText } from '../data/importFlags';
import type { ImportPreview, MappingNeeded } from '../data/importExcel';
import { EXPECTED_HEADERS } from '../../lib/import/seed-rules';

interface ExcelImportViewProps {
  currentUser: TeamMember;
  importHistory: ImportBatchRecord[];
  team: TeamMember[];
  existingClients: Client[];
  settings: AppSettings;
  onCommitImport: (
    fileName: string,
    rows: unknown[],
    counts: ImportPreview['counts'],
    flags: unknown[],
  ) => Promise<boolean>;
}

// PRD FR-3: her exact 30-column template, a preview with every flag before anything is saved,
// and a record of each import. Nothing is invented: a missing or bad value stays empty and is
// flagged (same rules as the seed). Owners only (the database refuses anyone else).
export const ExcelImportView: React.FC<ExcelImportViewProps> = ({
  importHistory,
  team,
  existingClients,
  onCommitImport,
}) => {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [skipExampleRow, setSkipExampleRow] = useState(true);
  // Column mapping for files that aren't the exact template (PLAN Phase 3: Upload → Map → Preview).
  const [pending, setPending] = useState<{
    file: File;
    need: MappingNeeded;
    mapping: number[];
  } | null>(null);

  const handleFile = async (file: File | undefined, mapping?: number[]) => {
    if (!file) return;
    setProblem(null);
    setPreview(null);
    setBusy(true);
    // The Excel reader is loaded only now, so it doesn't slow down the first page load.
    const { previewImport } = await import('../data/importExcel');
    const result = await previewImport(file, team, existingClients, { skipExampleRow, mapping });
    setBusy(false);
    if (typeof result === 'string') setProblem(result);
    else if ('needsMapping' in result)
      setPending({ file, need: result, mapping: result.suggested });
    else {
      setPending(null);
      setPreview(result);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setBusy(true);
    const ok = await onCommitImport(
      preview.fileName,
      preview.rows,
      preview.counts,
      preview.flags.map((f) => ({
        row: f.row,
        client_code: f.clientCode,
        field: f.column,
        reason: flagText(f),
        level: f.level,
      })),
    );
    setBusy(false);
    if (ok) setPreview(null);
  };

  const shownFlags = preview?.flags.filter((f) => showInfo || f.level === 'flag') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-text">Excel Import</h2>
        <p className="mt-0.5 text-sm text-muted">
          Import the 30-column SQAS client database. Every gap is flagged, never guessed: missing
          emails, dates or owners stay empty.
        </p>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface p-8 text-center cursor-pointer hover:bg-bg">
        <Upload className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium text-text">
          {busy ? 'Reading…' : 'Choose an Excel (.xlsx) or CSV file'}
        </span>
        <span className="text-xs text-muted">
          Columns A–AD in the template order. Rows sharing a Client ID become one client.
        </span>
        <input
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={skipExampleRow}
          onChange={(e) => setSkipExampleRow(e.target.checked)}
        />
        Row 2 is the template&apos;s example row: skip it
      </label>

      {pending && (
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 text-xs">
            <div className="font-semibold text-text">Match the columns of {pending.file.name}</div>
            <div className="text-muted">
              This file isn&apos;t in the 30-column template. Choose which of its columns holds each
              field; leave a field on &ldquo;Not in this file&rdquo; to keep it empty.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 p-4 text-xs max-h-96 overflow-y-auto">
            {EXPECTED_HEADERS.map((h, i) => (
              <label key={h} className="flex items-center justify-between gap-2">
                <span className="text-text-secondary">{i === 1 ? <strong>{h}</strong> : h}</span>
                <select
                  value={pending.mapping[i]}
                  onChange={(e) => {
                    const next = [...pending.mapping];
                    next[i] = Number(e.target.value);
                    setPending({ ...pending, mapping: next });
                  }}
                  className="w-48 rounded-lg border border-border bg-bg px-2 py-1 text-text"
                >
                  <option value={-1}>Not in this file</option>
                  {pending.need.fileHeaders.map((fh, c) => (
                    <option key={c} value={c}>
                      {fh || `Column ${c + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || pending.mapping[1] < 0}
              title={pending.mapping[1] < 0 ? 'Client Name must be mapped' : undefined}
              onClick={() => void handleFile(pending.file, pending.mapping)}
              className="rounded-lg bg-primary-strong px-4 py-2 text-xs font-medium text-on-primary disabled:opacity-60"
            >
              Preview with this mapping
            </button>
          </div>
        </div>
      )}

      {problem && (
        <div
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-wash p-4 text-sm text-danger"
        >
          {problem}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-border rounded-xl border border-border bg-surface">
            {[
              { label: 'Rows read', value: preview.counts.total, tone: 'text-text' },
              { label: 'Accepted', value: preview.counts.accepted, tone: 'text-success' },
              { label: 'Flagged', value: preview.counts.flagged, tone: 'text-warning' },
              {
                label: 'Possible duplicates',
                value: preview.counts.duplicates,
                tone: 'text-warning',
              },
              { label: 'Rejected', value: preview.counts.rejected, tone: 'text-danger' },
            ].map((k) => (
              <div key={k.label} className="p-4">
                <div className="text-xs text-muted">{k.label}</div>
                <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${k.tone}`}>
                  {k.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-text">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                {preview.fileName} · {preview.newClients} new client(s), {preview.existingClients}{' '}
                already in Drishti
              </span>
              <label className="flex items-center gap-1.5 text-muted">
                <input
                  type="checkbox"
                  checked={showInfo}
                  onChange={(e) => setShowInfo(e.target.checked)}
                />
                Show notes (e.g. no contract value)
              </label>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-[11px] text-muted">
                    <th className="py-2 px-4">Row</th>
                    <th className="py-2 px-4">Client ID</th>
                    <th className="py-2 px-4">Column</th>
                    <th className="py-2 px-4">As typed</th>
                    <th className="py-2 px-4">Problem</th>
                    <th className="py-2 px-4">Saved as</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shownFlags.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 px-4 text-success">
                        <CheckCircle2 className="inline h-4 w-4 mr-1" /> No problems found.
                      </td>
                    </tr>
                  ) : (
                    shownFlags.map((f, i) => (
                      <tr key={`${f.row}-${f.column}-${i}`}>
                        <td className="py-2 px-4 font-mono text-muted">{f.row}</td>
                        <td className="py-2 px-4 font-mono text-text-secondary">
                          {f.clientCode ?? '—'}
                        </td>
                        <td className="py-2 px-4 text-text-secondary">{f.column}</td>
                        <td className="py-2 px-4 font-mono text-text-secondary">{f.raw ?? '—'}</td>
                        <td
                          className={`py-2 px-4 ${f.code === 'ROW_SKIPPED' ? 'text-danger' : f.level === 'flag' ? 'text-warning' : 'text-muted'}`}
                        >
                          {f.code === 'ROW_SKIPPED' ? (
                            <XCircle className="inline h-3.5 w-3.5 mr-1" />
                          ) : (
                            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                          )}
                          {flagText(f)}
                        </td>
                        <td className="py-2 px-4 text-muted">{f.seededAs}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || preview.rows.length === 0}
                onClick={() => void handleCommit()}
                className="rounded-lg bg-primary-strong px-4 py-2 text-xs font-medium text-on-primary disabled:opacity-60"
              >
                {busy ? 'Importing…' : `Import ${preview.rows.length} row(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 text-xs font-semibold text-text">
          Import History
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted">
              <th className="py-2 px-4">When</th>
              <th className="py-2 px-4">File</th>
              <th className="py-2 px-4">By</th>
              <th className="py-2 px-4 text-right">Rows</th>
              <th className="py-2 px-4 text-right">Accepted</th>
              <th className="py-2 px-4 text-right">Flagged</th>
              <th className="py-2 px-4 text-right">Duplicates</th>
              <th className="py-2 px-4 text-right">Rejected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {importHistory.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 px-4 text-muted">
                  No imports yet.
                </td>
              </tr>
            ) : (
              importHistory.map((b) => (
                <tr key={b.id}>
                  <td className="py-2 px-4 font-mono text-text-secondary">
                    {formatTimestampIST(b.importedAt)}
                  </td>
                  <td className="py-2 px-4 text-text">{b.fileName}</td>
                  <td className="py-2 px-4 text-text-secondary">{b.importedByName}</td>
                  <td className="py-2 px-4 text-right font-mono">{b.totalRows}</td>
                  <td className="py-2 px-4 text-right font-mono text-success">{b.acceptedCount}</td>
                  <td className="py-2 px-4 text-right font-mono text-warning">{b.flaggedCount}</td>
                  <td className="py-2 px-4 text-right font-mono text-warning">
                    {b.duplicateCount}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-danger">{b.rejectedCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
