import { AppSettings, Client, Lead, ToolProposal, ChatMessage } from '../types';
import { runLocalRuleEngine } from '../utils/localAiEngine';
import { sanitizeModelOutput } from '../utils/sanitizer';

export const TESTED_DEFAULT_MODELS = [
  'poolside/laguna-xs-2.1:free',
  'inclusionai/ling-3.0-flash-fin:free',
  'poolside/laguna-s-2.1:free',
];

export const DENYLISTED_MODELS = [
  'z-ai/glm-5.2:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b',
  'liquid/lfm-2.5',
  'nvidia/nemotron-3-super-120b',
  'nvidia/nemotron-3.5-lightning',
  'nvidia/nemotron-3-ultra-550b',
  'nvidia/nemotron-3.5-content-safety:free',
  'dots-studio/dots-3-note-preview',
  'nemotron-nano-omni',
  'cohere/north-mini-code:free',
];

export function isModelDenylisted(modelId: string): boolean {
  if (!modelId) return true;
  if (modelId.startsWith('thinkingmachines/')) return true;
  return DENYLISTED_MODELS.some((denied) => modelId.includes(denied));
}

// Session provider health tracker
const sessionDisabledProviders = new Set<string>();

export function markProviderFailed(provider: 'openrouter' | 'groq') {
  sessionDisabledProviders.add(provider);
}

export function isProviderDisabled(provider: 'openrouter' | 'groq'): boolean {
  return sessionDisabledProviders.has(provider);
}

export function resetProviderSession() {
  sessionDisabledProviders.clear();
}

// In-flight request registry outside React tree
type InFlightListener = (msg: ChatMessage) => void;
const inFlightListeners = new Set<InFlightListener>();
let currentInFlightPromise: Promise<ChatMessage> | null = null;
let currentInFlightPrompt: string | null = null;

export function registerInFlightListener(listener: InFlightListener) {
  inFlightListeners.add(listener);
  return () => {
    inFlightListeners.delete(listener);
  };
}

export function isAiThinking(): boolean {
  return currentInFlightPromise !== null;
}

export function getInFlightPrompt(): string | null {
  return currentInFlightPrompt;
}

function buildSystemPrompt(clients: Client[], leads: Lead[], activeUserName: string): string {
  const clientsSummary = clients.map((c) => ({
    company: c.company,
    service: c.service,
    level: c.level,
    lastAppraisal: c.lastAppraisalDate,
    value: c.contractValue,
    owner: c.owner,
    notes: c.notes,
  }));

  const leadsSummary = leads.map((l) => ({
    company: l.company,
    contact: l.contactName,
    email: l.email,
    stage: l.stage,
    value: l.value,
    owner: l.owner,
    lastContact: l.lastContactDate,
    meetingContext: l.meetingContext,
  }));

  return `You are Drishti, the CRM partner for a 4-person CMMI and ISO consulting firm in India.
Team members: Founders Ramesh and Pramila; Auditors Mahesh and Sunita.
You are currently assisting ${activeUserName}.

Firm rules & domain knowledge:
- CMMI renewals occur every 3 years (ML3, ML5).
- ISO / IPA renewals occur every 1 year.
- Current Clients database (${clients.length} records):
${JSON.stringify(clientsSummary)}

- Current Leads database (${leads.length} records):
${JSON.stringify(leadsSummary)}

Critical Instructions:
1. EMAIL DRAFTING RULES:
   - When asked to draft an email or follow-up:
   - The stored 'meetingContext' is an INTERNAL note written in the third person about the owner (e.g. "Pramila walked Ananya through the ISMS roadmap").
   - You MUST re-express it in the FIRST PERSON ("When we spoke, I took you through the ISO 27001:2022 roadmap and sent the scope covering your Mumbai and Pune sites").
   - Never write "Pramila walked Ananya through...".
   - Structure the email:
     Hi {firstName},
     [One sentence recalling conversation in 1st person]
     [One sentence on where things stand]
     Could we connect for fifteen minutes on either:
     • [Weekday time 1 in IST, e.g. Tuesday at 11:30 AM IST]
     • [Weekday time 2 in IST, e.g. Thursday at 3:30 PM IST]
     [Short close]
     Regards,
     {Owner's Name}
   - Under 110 words. No exclamation marks. Never use "I hope this email finds you well", "just checking in", "circling back", "touching base".
   - Do NOT restate contract value unless specifically discussing commercials.
   - Render in clean text without markdown code blocks.

2. TOOL PROPOSALS FOR DATA WRITES:
   - All mutations are PROPOSALS only. Never say "Updated" or "Done". Say "Proposed update".
   - If the user asks to change a lead stage or client record, output a proposal JSON at the end:
   \`\`\`json
   {
     "action": "update_lead" | "update_client",
     "id": "target_id",
     "targetName": "Company Name",
     "changes": { "stage": "Demo done" },
     "reason": "Moving lead to Demo done as requested"
   }
   \`\`\`

3. OFFERS TO ACT:
   - Always end replies with 1 or at most 2 specific offers naming a real company:
     e.g., "Shall I draft the follow-up to Kavach Embedded Labs?"
`;
}

function extractToolProposal(rawText: string, clients: Client[], leads: Lead[]): { cleanText: string; proposal?: ToolProposal } {
  let cleanText = rawText;
  let proposal: ToolProposal | undefined;

  const jsonMatch = rawText.match(/```json\s*(\{[\s\S]*?\})\s*```/i) || rawText.match(/(\{[\s\S]*?"action"\s*:\s*"(?:update_lead|update_client|create_lead|create_client)"[\s\S]*?\})/i);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.action && parsed.targetName) {
        // Resolve ID if missing
        if (!parsed.id) {
          const lead = leads.find((l) => l.company.toLowerCase() === parsed.targetName.toLowerCase());
          const client = clients.find((c) => c.company.toLowerCase() === parsed.targetName.toLowerCase());
          parsed.id = lead?.id || client?.id || '';
        }
        proposal = {
          action: parsed.action,
          id: parsed.id,
          targetName: parsed.targetName,
          changes: parsed.changes || {},
          reason: parsed.reason || 'Requested change',
        };
        // Remove the json block from text
        cleanText = rawText.replace(jsonMatch[0], '').trim();
      }
    } catch {
      // Ignore JSON parse error
    }
  }

  return { cleanText: cleanText.trim(), proposal };
}

function extractCompanyDraftButtons(
  text: string,
  clients: Client[],
  leads: Lead[]
): Array<{ id: string; company: string; contactName: string; type: 'lead' | 'client'; email: string }> {
  const results: Array<{ id: string; company: string; contactName: string; type: 'lead' | 'client'; email: string }> = [];
  const lower = text.toLowerCase();

  for (const lead of leads) {
    if (lower.includes(lead.company.toLowerCase()) || lower.includes(lead.contactName.toLowerCase())) {
      if (!results.some((r) => r.id === lead.id)) {
        results.push({
          id: lead.id,
          company: lead.company,
          contactName: lead.contactName,
          type: 'lead',
          email: lead.email,
        });
      }
    }
  }

  for (const client of clients) {
    if (lower.includes(client.company.toLowerCase()) || lower.includes(client.contactName.toLowerCase())) {
      if (!results.some((r) => r.id === client.id)) {
        results.push({
          id: client.id,
          company: client.company,
          contactName: client.contactName,
          type: 'client',
          email: client.email,
        });
      }
    }
  }

  return results.slice(0, 3);
}

export async function askDrishti(
  prompt: string,
  clients: Client[],
  leads: Lead[],
  settings: AppSettings,
  activeUserName: string
): Promise<ChatMessage> {
  currentInFlightPrompt = prompt;

  const promise = (async (): Promise<ChatMessage> => {
    const systemPrompt = buildSystemPrompt(clients, leads, activeUserName);
    const id = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const timestamp = new Date().toISOString();

    // 1. TRY OPENROUTER
    if (settings.openRouterApiKey && !isProviderDisabled('openrouter')) {
      try {
        // Cap models array strictly at 3 items
        const MAX_FALLBACK_MODELS = 3;
        let selectedModels = (settings.openRouterModels || []).filter((m) => !isModelDenylisted(m));
        if (selectedModels.length === 0) {
          selectedModels = [...TESTED_DEFAULT_MODELS];
        }
        const modelsArray = selectedModels.slice(0, MAX_FALLBACK_MODELS);

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.openRouterApiKey.trim()}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Drishti CRM',
          },
          body: JSON.stringify({
            models: modelsArray,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawContent = data.choices?.[0]?.message?.content || '';
          const usedModel = data.model || modelsArray[0];
          const sanitized = sanitizeModelOutput(rawContent);
          const { cleanText, proposal } = extractToolProposal(sanitized, clients, leads);
          const suggestedDrafts = extractCompanyDraftButtons(cleanText, clients, leads);

          return {
            id,
            sender: 'assistant',
            text: cleanText,
            timestamp,
            providerStamped: `via OpenRouter (${usedModel})`,
            proposal,
            suggestedDrafts,
          };
        }

        // On 400, 401, 403 -> disable provider for session
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          markProviderFailed('openrouter');
        }
        // If 429 or 5xx, fall through to Groq or offline
      } catch {
        // Fall through
      }
    }

    // 2. TRY GROQ
    if (settings.groqApiKey && !isProviderDisabled('groq')) {
      try {
        const groqModel = settings.groqModel || 'llama-3.3-70b-versatile';
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.groqApiKey.trim()}`,
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawContent = data.choices?.[0]?.message?.content || '';
          const sanitized = sanitizeModelOutput(rawContent);
          const { cleanText, proposal } = extractToolProposal(sanitized, clients, leads);
          const suggestedDrafts = extractCompanyDraftButtons(cleanText, clients, leads);

          return {
            id,
            sender: 'assistant',
            text: cleanText,
            timestamp,
            providerStamped: `via Groq (${groqModel})`,
            proposal,
            suggestedDrafts,
          };
        }

        if (res.status === 400 || res.status === 401 || res.status === 403) {
          markProviderFailed('groq');
        }
      } catch {
        // Fall through
      }
    }

    // 3. FALLBACK TO LOCAL OFFLINE RULE ENGINE
    const localResult = runLocalRuleEngine(prompt, clients, leads, activeUserName);
    const suggestedDrafts = localResult.suggestedDrafts || extractCompanyDraftButtons(localResult.replyText, clients, leads);

    return {
      id,
      sender: 'assistant',
      text: localResult.replyText,
      timestamp,
      providerStamped: 'via Local Rule Engine',
      isOffline: true,
      proposal: localResult.proposal,
      suggestedDrafts,
    };
  })();

  currentInFlightPromise = promise;

  try {
    const result = await promise;
    inFlightListeners.forEach((listener) => listener(result));
    return result;
  } finally {
    currentInFlightPromise = null;
    currentInFlightPrompt = null;
  }
}

/**
 * Tests API connection for OpenRouter or Groq
 */
export async function testProviderApiKey(
  provider: 'openrouter' | 'groq',
  apiKey: string,
  model?: string
): Promise<{ ok: boolean; status: number; message: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, status: 0, message: 'Please enter an API key first' };
  }

  try {
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        credentials: 'omit',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      const bodyText = await res.text();
      if (res.ok) {
        return { ok: true, status: res.status, message: 'OpenRouter Key Valid and Active' };
      }
      return {
        ok: false,
        status: res.status,
        message: `HTTP ${res.status}: ${bodyText.slice(0, 120)}`,
      };
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        credentials: 'omit',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      const bodyText = await res.text();
      if (res.ok) {
        return { ok: true, status: res.status, message: 'Groq Key Valid and Active' };
      }
      return {
        ok: false,
        status: res.status,
        message: `HTTP ${res.status}: ${bodyText.slice(0, 120)}`,
      };
    }
  } catch (err: any) {
    return { ok: false, status: 0, message: err.message || 'Network error connecting to provider' };
  }
}

/**
 * Fetches free models from OpenRouter endpoint
 */
export async function fetchFreeOpenRouterModels(): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      credentials: 'omit',
    });
    if (!res.ok) {
      return TESTED_DEFAULT_MODELS.map((m) => ({ id: m, name: m }));
    }
    const data = await res.json();
    const allModels: Array<{ id: string; name: string }> = data.data || [];
    // Must end with :free and not be denylisted
    const freeModels = allModels
      .filter((m) => m.id.endsWith(':free') && !isModelDenylisted(m.id))
      .map((m) => ({ id: m.id, name: m.name || m.id }));

    // Put tested-good ones first
    const sorted = [
      ...TESTED_DEFAULT_MODELS.filter((id) => freeModels.some((f) => f.id === id)).map((id) => ({
        id,
        name: id,
      })),
      ...freeModels.filter((f) => !TESTED_DEFAULT_MODELS.includes(f.id)),
    ];

    return sorted.length > 0 ? sorted : TESTED_DEFAULT_MODELS.map((m) => ({ id: m, name: m }));
  } catch {
    return TESTED_DEFAULT_MODELS.map((m) => ({ id: m, name: m }));
  }
}
