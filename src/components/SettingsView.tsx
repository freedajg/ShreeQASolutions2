import React, { useState, useEffect } from 'react';
import {
  Key,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Download,
  ShieldCheck,
  Zap,
  Cpu,
  HelpCircle,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { testProviderApiKey, fetchFreeOpenRouterModels } from '../services/aiService';

export function SettingsView() {
  const {
    settings,
    updateSettings,
    resetToSampleData,
    clients,
    leads,
  } = useCrm();

  const [openRouterKeyInput, setOpenRouterKeyInput] = useState(settings.openRouterApiKey || '');
  const [groqKeyInput, setGroqKeyInput] = useState(settings.groqApiKey || '');

  const [availableOpenRouterModels, setAvailableOpenRouterModels] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const [testingProvider, setTestingProvider] = useState<'openrouter' | 'groq' | null>(null);
  const [testResults, setTestResults] = useState<{
    openrouter?: { ok: boolean; message: string; latency?: number };
    groq?: { ok: boolean; message: string; latency?: number };
  }>({});

  useEffect(() => {
    fetchFreeOpenRouterModels().then(setAvailableOpenRouterModels);
  }, []);

  const handleSaveOpenRouter = () => {
    updateSettings({ openRouterApiKey: openRouterKeyInput.trim() });
  };

  const handleSaveGroq = () => {
    updateSettings({ groqApiKey: groqKeyInput.trim() });
  };

  const handleTestKey = async (provider: 'openrouter' | 'groq') => {
    setTestingProvider(provider);
    const key = provider === 'openrouter' ? openRouterKeyInput.trim() : groqKeyInput.trim();
    const t0 = performance.now();
    const result = await testProviderApiKey(provider, key);
    const latency = Math.round(performance.now() - t0);

    setTestResults((prev) => ({
      ...prev,
      [provider]: {
        ok: result.ok,
        message: result.message,
        latency,
      },
    }));
    setTestingProvider(null);

    if (result.ok) {
      if (provider === 'openrouter') {
        updateSettings({ openRouterApiKey: key });
      } else {
        updateSettings({ groqApiKey: key });
      }
    }
  };

  const handleExportBackup = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      clients,
      leads,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drishti_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9eefb]">
          Settings & AI Configuration
        </h1>
        <p className="text-xs sm:text-sm text-[#9aabcc] mt-0.5">
          Configure model providers, fallback priority, and local browser persistence.
        </p>
      </div>

      {/* AI Provider Waterfall Card */}
      <div className="bg-[#111828] border border-[rgba(148,175,235,0.18)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,175,235,0.12)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[#818cf8]">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#e9eefb]">
                AI Model Waterfall & API Keys
              </h2>
              <p className="text-xs text-[#9aabcc]">
                Drishti queries providers in waterfall order. If a provider fails or is unconfigured, it seamlessly falls back to the deterministic local rule engine.
              </p>
            </div>
          </div>
        </div>

        {/* Provider 1: OpenRouter */}
        <div className="p-4 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.12)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#818cf8]/20 text-[#818cf8] border border-[#818cf8]/30 uppercase">
                Primary Tier 1
              </span>
              <h3 className="font-bold text-sm text-[#e9eefb]">OpenRouter</h3>
            </div>
            <span className="text-[11px] text-[#6d7c9c]">Multi-model gateway</span>
          </div>

          <div className="space-y-2 text-xs">
            <label className="text-[#6d7c9c] uppercase font-semibold text-[10px] block">
              OpenRouter API Key (`sk-or-v1-...`)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={openRouterKeyInput}
                onChange={(e) => setOpenRouterKeyInput(e.target.value)}
                placeholder="Paste sk-or-v1-... key"
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#111828] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] font-mono text-xs focus:outline-none focus:border-[#818cf8]"
              />
              <button
                type="button"
                onClick={handleSaveOpenRouter}
                className="px-3 py-2 rounded-xl bg-[#18213a] text-[#e9eefb] font-semibold hover:bg-indigo-500/20 text-xs border border-[rgba(148,175,235,0.15)]"
              >
                Save
              </button>
              <button
                type="button"
                disabled={testingProvider === 'openrouter'}
                onClick={() => handleTestKey('openrouter')}
                className="px-3.5 py-2 rounded-xl bg-[#818cf8] text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {testingProvider === 'openrouter' ? 'Testing...' : 'Test Key'}
              </button>
            </div>

            {/* Model picker */}
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[#6d7c9c] text-[11px]">Primary Model:</span>
              <select
                value={settings.openRouterModels?.[0] || 'meta-llama/llama-3.3-70b-instruct:free'}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSettings({
                    openRouterModels: [val, ...(settings.openRouterModels || []).filter((m) => m !== val)].slice(0, 3),
                  });
                }}
                className="px-2.5 py-1 rounded-lg bg-[#18213a] text-xs text-[#e9eefb] border border-[rgba(148,175,235,0.16)]"
              >
                {availableOpenRouterModels.length > 0 ? (
                  availableOpenRouterModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="meta-llama/llama-3.3-70b-instruct:free">
                      meta-llama/llama-3.3-70b-instruct (Free)
                    </option>
                    <option value="google/gemini-2.0-flash-exp:free">
                      google/gemini-2.0-flash-exp (Free via OpenRouter)
                    </option>
                    <option value="mistralai/mistral-7b-instruct:free">
                      mistralai/mistral-7b-instruct (Free)
                    </option>
                  </>
                )}
              </select>
            </div>

            {/* Test result banner */}
            {testResults.openrouter && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResults.openrouter.ok
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-[#fb7185]/10 text-[#fb7185] border border-[#fb7185]/20'
                }`}
              >
                {testResults.openrouter.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>
                  {testResults.openrouter.message}{' '}
                  {testResults.openrouter.latency && `(${testResults.openrouter.latency}ms)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Provider 2: Groq */}
        <div className="p-4 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.12)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#22d3ee]/20 text-[#22d3ee] border border-[#22d3ee]/30 uppercase">
                Secondary Tier 2
              </span>
              <h3 className="font-bold text-sm text-[#e9eefb]">Groq Cloud</h3>
            </div>
            <span className="text-[11px] text-[#6d7c9c]">Ultra-fast LPUs</span>
          </div>

          <div className="space-y-2 text-xs">
            <label className="text-[#6d7c9c] uppercase font-semibold text-[10px] block">
              Groq API Key (`gsk_...`)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={groqKeyInput}
                onChange={(e) => setGroqKeyInput(e.target.value)}
                placeholder="Paste gsk_... key"
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#111828] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] font-mono text-xs focus:outline-none focus:border-[#818cf8]"
              />
              <button
                type="button"
                onClick={handleSaveGroq}
                className="px-3 py-2 rounded-xl bg-[#18213a] text-[#e9eefb] font-semibold hover:bg-indigo-500/20 text-xs border border-[rgba(148,175,235,0.15)]"
              >
                Save
              </button>
              <button
                type="button"
                disabled={testingProvider === 'groq'}
                onClick={() => handleTestKey('groq')}
                className="px-3.5 py-2 rounded-xl bg-[#22d3ee] text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {testingProvider === 'groq' ? 'Testing...' : 'Test Key'}
              </button>
            </div>

            {/* Model picker */}
            <div className="pt-2 flex items-center gap-2">
              <span className="text-[#6d7c9c] text-[11px]">Selected Model:</span>
              <select
                value={settings.groqModel || 'llama-3.3-70b-versatile'}
                onChange={(e) => updateSettings({ groqModel: e.target.value })}
                className="px-2.5 py-1 rounded-lg bg-[#18213a] text-xs text-[#e9eefb] border border-[rgba(148,175,235,0.16)]"
              >
                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
              </select>
            </div>

            {/* Test result banner */}
            {testResults.groq && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResults.groq.ok
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-[#fb7185]/10 text-[#fb7185] border border-[#fb7185]/20'
                }`}
              >
                {testResults.groq.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>
                  {testResults.groq.message}{' '}
                  {testResults.groq.latency && `(${testResults.groq.latency}ms)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tier 3: Built-in Local Engine */}
        <div className="p-4 rounded-xl bg-[#080c16] border border-emerald-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                Tier 3 (Zero Latency)
              </span>
              <h3 className="font-bold text-sm text-[#e9eefb]">Local Consulting Rule Engine</h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold">Always Active & Free</span>
          </div>
          <p className="text-xs text-[#9aabcc] leading-relaxed">
            Built-in deterministic logic specifically calibrated for Indian CMMI and ISO renewal timelines, pipeline summaries, and first-person follow-up email drafting. Works completely offline without any API keys or network connection.
          </p>
        </div>
      </div>

      {/* Local Storage & Data Management */}
      <div className="bg-[#111828] border border-[rgba(148,175,235,0.18)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,175,235,0.12)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#e9eefb]">
                Local Storage & Backup
              </h2>
              <p className="text-xs text-[#9aabcc]">
                All data is persisted in your browser’s localStorage (`drishti_crm_v1_store`).
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.1)] space-y-2">
            <span className="text-xs font-bold text-[#e9eefb] block">Export Backup JSON</span>
            <p className="text-[#9aabcc]">
              Save a local snapshot containing all {clients.length} certified clients and {leads.length} pipeline deals.
            </p>
            <button
              onClick={handleExportBackup}
              className="mt-2 px-3.5 py-2 rounded-xl bg-[#18213a] hover:bg-indigo-500/20 text-[#818cf8] font-bold text-xs border border-[rgba(148,175,235,0.16)] flex items-center gap-1.5 transition-colors"
            >
              <Download size={14} />
              <span>Download JSON Backup</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.1)] space-y-2">
            <span className="text-xs font-bold text-[#e9eefb] block">
              Reset to Sample Consulting Firm Data
            </span>
            <p className="text-[#9aabcc]">
              Restore the pristine demo dataset featuring Ramesh, Pramila, Mahesh, and Sunita’s CMMI & ISO roster.
            </p>
            <button
              onClick={() => {
                if (window.confirm('Reset all clients and leads back to the sample consulting dataset?')) {
                  resetToSampleData();
                }
              }}
              className="mt-2 px-3.5 py-2 rounded-xl bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 text-[#fbbf24] font-bold text-xs border border-[#fbbf24]/30 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} />
              <span>Reset to Sample Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
