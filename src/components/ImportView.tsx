import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { Client, Lead, ServiceKind, Stage } from '../types';
import { formatINR } from '../utils/currency';

export function ImportView() {
  const { clients, leads, addClient, addLead } = useCrm();

  const [importTarget, setImportTarget] = useState<'clients' | 'leads'>('clients');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client expected schema
  const clientFields = [
    { key: 'company', label: 'Company Name', required: true },
    { key: 'contactName', label: 'Contact Person', required: true },
    { key: 'email', label: 'Email Address' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'service', label: 'Standard (CMMI, ISO, IPA)', required: true },
    { key: 'level', label: 'Level / Scope' },
    { key: 'contractValue', label: 'Contract Value (INR)', required: true },
    { key: 'lastAppraisalDate', label: 'Last Appraisal Date (YYYY-MM-DD)', required: true },
    { key: 'owner', label: 'Owner (Ramesh, Pramila, Mahesh, Sunita)' },
    { key: 'notes', label: 'Auditor Notes' },
  ];

  // Lead expected schema
  const leadFields = [
    { key: 'company', label: 'Company Name', required: true },
    { key: 'contactName', label: 'Contact Person', required: true },
    { key: 'email', label: 'Email Address' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'source', label: 'Lead Source' },
    { key: 'serviceInterest', label: 'Standard Interest (CMMI, ISO, IPA)' },
    { key: 'stage', label: 'Stage (New, Contacted, Demo, Proposal, Won, Lost)' },
    { key: 'value', label: 'Deal Value (INR)', required: true },
    { key: 'owner', label: 'Owner' },
    { key: 'meetingContext', label: 'Meeting Context / Notes' },
  ];

  const targetFields = importTarget === 'clients' ? clientFields : leadFields;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSuccessMessage(null);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawData.length === 0) {
          setErrorMessage('The selected file contains no data rows.');
          return;
        }

        const headers = Object.keys(rawData[0]);
        setColumnHeaders(headers);
        setParsedRows(rawData);

        // Auto guess mappings
        const initialMapping: Record<string, string> = {};
        targetFields.forEach((field) => {
          const match = headers.find(
            (h) =>
              h.toLowerCase().replace(/[^a-z0-9]/g, '') ===
                field.key.toLowerCase().replace(/[^a-z0-9]/g, '') ||
              h.toLowerCase().includes(field.label.toLowerCase().slice(0, 4))
          );
          if (match) {
            initialMapping[field.key] = match;
          }
        });
        setColumnMapping(initialMapping);
      } catch (err: any) {
        setErrorMessage(`Failed to parse file: ${err.message || 'Invalid format'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;

    let importedCount = 0;

    if (importTarget === 'clients') {
      parsedRows.forEach((row) => {
        const company = String(row[columnMapping.company] || '').trim();
        if (!company) return;

        const contactName = String(row[columnMapping.contactName] || 'Lead Auditor').trim();
        const email = String(row[columnMapping.email] || `contact@${company.toLowerCase().replace(/\s+/g, '')}.in`).trim();
        const phone = String(row[columnMapping.phone] || '+91 98000 00000').trim();
        
        let service: ServiceKind = 'ISO';
        const rawService = String(row[columnMapping.service] || '').toUpperCase();
        if (rawService.includes('CMMI')) service = 'CMMI';
        else if (rawService.includes('IPA')) service = 'IPA';
        else if (rawService.includes('ISO')) service = 'ISO';

        const level = String(row[columnMapping.level] || '').trim() || undefined;
        const valRaw = String(row[columnMapping.contractValue] || '').replace(/[^0-9.]/g, '');
        const contractValue = Number(valRaw) || 800000;

        let lastAppraisalDate = String(row[columnMapping.lastAppraisalDate] || '').trim();
        if (!lastAppraisalDate || isNaN(new Date(lastAppraisalDate).getTime())) {
          lastAppraisalDate = new Date().toISOString().split('T')[0];
        } else {
          lastAppraisalDate = new Date(lastAppraisalDate).toISOString().split('T')[0];
        }

        const owner = String(row[columnMapping.owner] || 'Ramesh').trim();
        const notes = String(row[columnMapping.notes] || 'Imported from spreadsheet').trim();

        addClient({
          company,
          contactName,
          email,
          phone,
          service,
          level,
          contractValue,
          lastAppraisalDate,
          owner,
          notes,
          activity: [
            {
              at: new Date().toISOString(),
              note: `Imported via spreadsheet`,
              author: owner,
            },
          ],
        });
        importedCount++;
      });
    } else {
      // Leads
      parsedRows.forEach((row) => {
        const company = String(row[columnMapping.company] || '').trim();
        if (!company) return;

        const contactName = String(row[columnMapping.contactName] || 'Contact').trim();
        const email = String(row[columnMapping.email] || `contact@${company.toLowerCase().replace(/\s+/g, '')}.in`).trim();
        const phone = String(row[columnMapping.phone] || '+91 98000 00000').trim();
        const source = String(row[columnMapping.source] || 'Excel Import').trim();
        
        let serviceInterest: ServiceKind = 'ISO';
        const rawService = String(row[columnMapping.serviceInterest] || '').toUpperCase();
        if (rawService.includes('CMMI')) serviceInterest = 'CMMI';
        else if (rawService.includes('IPA')) serviceInterest = 'IPA';

        let stage: Stage = 'New';
        const rawStage = String(row[columnMapping.stage] || '').trim();
        if (['New', 'Contacted', 'Demo scheduled', 'Demo done', 'Proposal sent', 'Won', 'Lost'].includes(rawStage)) {
          stage = rawStage as Stage;
        }

        const valRaw = String(row[columnMapping.value] || '').replace(/[^0-9.]/g, '');
        const value = Number(valRaw) || 600000;
        const owner = String(row[columnMapping.owner] || 'Pramila').trim();
        const meetingContext = String(row[columnMapping.meetingContext] || 'Imported lead from spreadsheet').trim();

        addLead({
          company,
          contactName,
          email,
          phone,
          source,
          serviceInterest,
          stage,
          value,
          owner,
          lastContactDate: new Date().toISOString().split('T')[0],
          nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
          meetingContext,
          activity: [
            {
              at: new Date().toISOString(),
              note: `Imported via spreadsheet`,
              author: owner,
            },
          ],
        });
        importedCount++;
      });
    }

    setSuccessMessage(`Successfully imported ${importedCount} ${importTarget} into Drishti CRM.`);
    setParsedRows([]);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const isClient = importTarget === 'clients';
    const sampleData = isClient
      ? [
          {
            'Company Name': 'Acme Process Labs',
            'Contact Person': 'Rajesh Sharma',
            'Email Address': 'rajesh@acme.in',
            'Phone Number': '+91 98234 56789',
            'Standard': 'CMMI',
            'Level': 'DEV ML3',
            'Contract Value': 1400000,
            'Last Appraisal Date': '2023-04-15',
            'Owner': 'Ramesh',
            'Notes': 'Scope includes Bangalore and Hyderabad units.',
          },
        ]
      : [
          {
            'Company Name': 'TechNext Infotech',
            'Contact Person': 'Ananya Rao',
            'Email Address': 'ananya@technext.in',
            'Phone Number': '+91 98450 11223',
            'Standard Interest': 'ISO',
            'Stage': 'Contacted',
            'Deal Value': 650000,
            'Owner': 'Pramila',
            'Meeting Context': 'Discussed ISO 27001 ISMS scope for cloud infrastructure.',
          },
        ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isClient ? 'ClientsTemplate' : 'LeadsTemplate');
    XLSX.writeFile(wb, `Drishti_${importTarget}_template.xlsx`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9eefb]">
            Import Excel & CSV
          </h1>
          <p className="text-xs sm:text-sm text-[#9aabcc] mt-0.5">
            Migrate from your existing consulting Excel workbook directly into browser local storage.
          </p>
        </div>

        <button
          onClick={downloadTemplate}
          className="px-3.5 py-2 rounded-xl bg-[#18213a] hover:bg-indigo-500/20 text-[#818cf8] hover:text-[#e9eefb] border border-[rgba(148,175,235,0.18)] text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
        >
          <Download size={14} />
          <span>Download Sample Excel Template</span>
        </button>
      </div>

      {/* Target Selector Card */}
      <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-4">
          <div className="space-y-1 flex-1">
            <label className="text-xs font-bold text-[#e9eefb] uppercase tracking-wider block">
              1. Choose Import Target
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setImportTarget('clients');
                  setParsedRows([]);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  importTarget === 'clients'
                    ? 'bg-indigo-500/20 text-[#818cf8] border-indigo-500/40'
                    : 'bg-[#080c16] text-[#9aabcc] border-[rgba(148,175,235,0.12)]'
                }`}
              >
                Certified Clients Register ({clients.length} current)
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportTarget('leads');
                  setParsedRows([]);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  importTarget === 'leads'
                    ? 'bg-indigo-500/20 text-[#818cf8] border-indigo-500/40'
                    : 'bg-[#080c16] text-[#9aabcc] border-[rgba(148,175,235,0.12)]'
                }`}
              >
                Pipeline Prospects / Leads ({leads.length} current)
              </button>
            </div>
          </div>
        </div>

        {/* Drag and Drop / File Input Box */}
        <div className="pt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-file-input"
          />
          <label
            htmlFor="excel-file-input"
            className="border-2 border-dashed border-[rgba(148,175,235,0.22)] hover:border-[#818cf8] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-[#080c16]/50 hover:bg-[#18213a]/30"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[#818cf8] mb-3">
              <FileSpreadsheet size={24} />
            </div>
            <span className="text-sm font-bold text-[#e9eefb]">
              {fileName ? fileName : 'Click to select or drop an Excel (.xlsx) / CSV file'}
            </span>
            <span className="text-xs text-[#6d7c9c] mt-1">
              Supports multi-sheet workbooks, standard ISO/CMMI date strings, and Indian Rupee values.
            </span>
          </label>
        </div>

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#fb7185]/10 border border-[#fb7185]/20 text-[#fb7185] text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Interactive Column Mapping */}
      {parsedRows.length > 0 && (
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.18)] rounded-2xl p-5 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,175,235,0.12)]">
            <div>
              <h3 className="font-bold text-sm text-[#e9eefb]">
                2. Map File Columns to Drishti CRM Fields
              </h3>
              <p className="text-xs text-[#9aabcc]">
                Found {columnHeaders.length} columns and {parsedRows.length} rows in {fileName}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {targetFields.map((field) => (
              <div key={field.key} className="p-3 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.12)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#e9eefb]">
                    {field.label} {field.required && <strong className="text-[#fb7185]">*</strong>}
                  </span>
                </div>

                <select
                  value={columnMapping[field.key] || ''}
                  onChange={(e) =>
                    setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#18213a] text-xs text-[#e9eefb] border border-[rgba(148,175,235,0.18)] focus:outline-none focus:border-[#818cf8]"
                >
                  <option value="">— Ignore / Not in file —</option>
                  {columnHeaders.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* 5-Row Preview Table */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-[#6d7c9c] uppercase tracking-wider">
              Preview (First {Math.min(5, parsedRows.length)} rows)
            </h4>
            <div className="overflow-x-auto border border-[rgba(148,175,235,0.12)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#18213a] text-[#9aabcc] text-[10px] uppercase">
                  <tr>
                    {targetFields.slice(0, 5).map((f) => (
                      <th key={f.key} className="px-3 py-2">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(148,175,235,0.06)] text-[#e9eefb]">
                  {parsedRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#18213a]/30">
                      {targetFields.slice(0, 5).map((f) => (
                        <td key={f.key} className="px-3 py-2 text-[#9aabcc]">
                          {columnMapping[f.key] ? String(row[columnMapping[f.key]] || '—') : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(148,175,235,0.12)]">
            <button
              type="button"
              onClick={() => {
                setParsedRows([]);
                setFileName(null);
              }}
              className="px-4 py-2 rounded-xl text-xs text-[#9aabcc] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] hover:from-[#a78bfa] hover:to-[#22d3ee] text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center gap-2"
            >
              <CheckCircle size={15} />
              <span>Import {parsedRows.length} Records</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
