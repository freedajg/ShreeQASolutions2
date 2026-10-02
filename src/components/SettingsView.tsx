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
  const { settings, updateSettings, resetToSampleData, clients, leads } = useCrm();

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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
          Settings & AI Configuration
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
          Configure model providers, fallback priority, and local browser persistence.
        </p>
      </div>

      {/* AI Provider Waterfall Card */}
      <div className="bg-surface border border-line/18 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-line/12">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-tint/20 border border-primary-tint/30 flex items-center justify-center text-primary">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text">
                AI Model Waterfall & API Keys
              </h2>
              <p className="text-xs text-text-secondary">
                Drishti queries providers in waterfall order. If a provider fails or is
                unconfigured, it seamlessly falls back to the deterministic local rule engine.
              </p>
            </div>
          </div>
        </div>

        {/* Provider 1: OpenRouter */}
        <div className="p-4 rounded-xl bg-bg border border-line/12 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-primary/20 text-primary border border-primary/30 uppercase">
                Primary Tier 1
              </span>
              <h3 className="font-bold text-sm text-text">OpenRouter</h3>
            </div>
            <span className="text-[11px] text-muted">Multi-model gateway</span>
          </div>

          <div className="space-y-2 text-xs">
            <label className="text-muted uppercase font-semibold text-[10px] block">
              OpenRouter API Key (`sk-or-v1-...`)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={openRouterKeyInput}
                onChange={(e) => setOpenRouterKeyInput(e.target.value)}
                placeholder="Paste sk-or-v1-... key"
                className="flex-1 px-3.5 py-2 rounded-xl bg-surface border border-line/16 text-text font-mono text-xs focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleSaveOpenRouter}
                className="px-3 py-2 rounded-xl bg-raised text-text font-semibold hover:bg-primary-tint/20 text-xs border border-line/15"
              >
                Save
              </button>
              <button
                type="button"
                disabled={testingProvider === 'openrouter'}
                onClick={() => handleTestKey('openrouter')}
                className="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs disabled:opacity-50"
              >
                {testingProvider === 'openrouter' ? 'Testing...' : 'Test Key'}
              </button>
            </div>

            {/* Model picker */}
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-muted text-[11px]">Primary Model:</span>
              <select
                value={settings.openRouterModels?.[0] || 'meta-llama/llama-3.3-70b-instruct:free'}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSettings({
                    openRouterModels: [
                      val,
                      ...(settings.openRouterModels || []).filter((m) => m !== val),
                    ].slice(0, 3),
                  });
                }}
                className="px-2.5 py-1 rounded-lg bg-raised text-xs text-text border border-line/16"
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
                    ? 'bg-success-strong/10 text-success border border-success-strong/20'
                    : 'bg-danger/10 text-danger border border-danger/20'
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
        <div className="p-4 rounded-xl bg-bg border border-line/12 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-info/20 text-info border border-info/30 uppercase">
                Secondary Tier 2
              </span>
              <h3 className="font-bold text-sm text-text">Groq Cloud</h3>
            </div>
            <span className="text-[11px] text-muted">Ultra-fast LPUs</span>
          </div>

          <div className="space-y-2 text-xs">
            <label className="text-muted uppercase font-semibold text-[10px] block">
              Groq API Key (`gsk_...`)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={groqKeyInput}
                onChange={(e) => setGroqKeyInput(e.target.value)}
                placeholder="Paste gsk_... key"
                className="flex-1 px-3.5 py-2 rounded-xl bg-surface border border-line/16 text-text font-mono text-xs focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleSaveGroq}
                className="px-3 py-2 rounded-xl bg-raised text-text font-semibold hover:bg-primary-tint/20 text-xs border border-line/15"
              >
                Save
              </button>
              <button
                type="button"
                disabled={testingProvider === 'groq'}
                onClick={() => handleTestKey('groq')}
                className="px-3.5 py-2 rounded-xl bg-info text-on-primary font-bold text-xs disabled:opacity-50"
              >
                {testingProvider === 'groq' ? 'Testing...' : 'Test Key'}
              </button>
            </div>

            {/* Model picker */}
            <div className="pt-2 flex items-center gap-2">
              <span className="text-muted text-[11px]">Selected Model:</span>
              <select
                value={settings.groqModel || 'llama-3.3-70b-versatile'}
                onChange={(e) => updateSettings({ groqModel: e.target.value })}
                className="px-2.5 py-1 rounded-lg bg-raised text-xs text-text border border-line/16"
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
                    ? 'bg-success-strong/10 text-success border border-success-strong/20'
                    : 'bg-danger/10 text-danger border border-danger/20'
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
        <div className="p-4 rounded-xl bg-bg border border-success-strong/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-success-strong/20 text-success border border-success-strong/30 uppercase">
                Tier 3 (Zero Latency)
              </span>
              <h3 className="font-bold text-sm text-text">Local Consulting Rule Engine</h3>
            </div>
            <span className="text-[11px] text-success font-semibold">Always Active & Free</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Built-in deterministic logic specifically calibrated for Indian CMMI and ISO renewal
            timelines, pipeline summaries, and first-person follow-up email drafting. Works
            completely offline without any API keys or network connection.
          </p>
        </div>
      </div>

      {/* Local Storage & Data Management */}
      <div className="bg-surface border border-line/18 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-line/12">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-success-strong/20 border border-success-strong/30 flex items-center justify-center text-success">
              <Cpu size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text">Local Storage & Backup</h2>
              <p className="text-xs text-text-secondary">
                All data is persisted in your browser’s localStorage (`drishti_crm_v1_store`).
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-bg border border-line/10 space-y-2">
            <span className="text-xs font-bold text-text block">Export Backup JSON</span>
            <p className="text-text-secondary">
              Save a local snapshot containing all {clients.length} certified clients and{' '}
              {leads.length} pipeline deals.
            </p>
            <button
              onClick={handleExportBackup}
              className="mt-2 px-3.5 py-2 rounded-xl bg-raised hover:bg-primary-tint/20 text-primary font-bold text-xs border border-line/16 flex items-center gap-1.5 transition-colors"
            >
              <Download size={14} />
              <span>Download JSON Backup</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-bg border border-line/10 space-y-2">
            <span className="text-xs font-bold text-text block">
              Reset to Sample Consulting Firm Data
            </span>
            <p className="text-text-secondary">
              Restore the pristine demo dataset featuring Ramesh, Pramila, Mahesh, and Sunita’s CMMI
              & ISO roster.
            </p>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Reset all clients and leads back to the sample consulting dataset?',
                  )
                ) {
                  resetToSampleData();
                }
              }}
              className="mt-2 px-3.5 py-2 rounded-xl bg-warning/10 hover:bg-warning/20 text-warning font-bold text-xs border border-warning/30 flex items-center gap-1.5 transition-colors"
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
