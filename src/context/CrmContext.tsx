import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  Client,
  Lead,
  ChatMessage,
  AppSettings,
  ToolProposal,
  UserProfile,
  Stage,
  TabKey,
} from '../types';
import { getInitialClients, getInitialLeads, TEAM_MEMBERS } from '../utils/seedData';
import {
  askDrishti,
  isModelDenylisted,
  TESTED_DEFAULT_MODELS,
  registerInFlightListener,
} from '../services/aiService';
import { LANDING_SCREEN, isFeatureEnabled, resolveScreen } from '../lib/screens';

const STORAGE_KEY = 'drishti_crm_v1_store';

interface DraftModalTarget {
  type: 'lead' | 'client';
  entity: Lead | Client;
}

interface CrmContextType {
  hydrated: boolean;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  activeUser: UserProfile;
  setActiveUser: (user: UserProfile) => void;
  clients: Client[];
  leads: Lead[];
  chatHistory: ChatMessage[];
  settings: AppSettings;
  isAiLoading: boolean;
  selectedDraftTarget: DraftModalTarget | null;
  openDraftModal: (target: DraftModalTarget) => void;
  closeDraftModal: () => void;
  // Mutations
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (id: string, updates: Partial<Client>, note?: string) => void;
  deleteClient: (id: string) => void;
  addLead: (lead: Omit<Lead, 'id'>) => void;
  updateLead: (id: string, updates: Partial<Lead>, note?: string) => void;
  deleteLead: (id: string) => void;
  setLeadStage: (id: string, stage: Stage, reason?: string) => void;
  addClientActivityNote: (clientId: string, note: string) => void;
  addLeadActivityNote: (leadId: string, note: string) => void;
  logEmailSent: (
    target: { type: 'lead' | 'client'; id: string },
    subject: string,
    recipientEmail: string,
  ) => void;
  // Chat & AI
  sendUserMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  applyProposal: (messageId: string, proposal: ToolProposal) => void;
  discardProposal: (messageId: string) => void;
  // Settings
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetToSampleData: () => void;
  importRecords: (newClients: Client[], newLeads: Lead[], mode: 'merge' | 'replace') => void;
}

const defaultSettings: AppSettings = {
  openRouterApiKey: '',
  groqApiKey: '',
  openRouterModels: [...TESTED_DEFAULT_MODELS],
  groqModel: 'llama-3.3-70b-versatile',
  activeUserId: 'pramila',
};

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTabState] = useState<TabKey>(LANDING_SCREEN);
  const [activeUser, setActiveUserState] = useState<UserProfile>(TEAM_MEMBERS[0]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedDraftTarget, setSelectedDraftTarget] = useState<DraftModalTarget | null>(null);

  // 1. Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.clients && parsed.clients.length > 0) {
          setClients(parsed.clients);
        } else {
          setClients(getInitialClients());
        }

        if (parsed.leads && parsed.leads.length > 0) {
          setLeads(parsed.leads);
        } else {
          setLeads(getInitialLeads());
        }

        if (parsed.chatHistory) {
          setChatHistory(parsed.chatHistory);
        }

        if (parsed.settings) {
          // Migrate any stored denylisted models
          let fixedModels = parsed.settings.openRouterModels || [...TESTED_DEFAULT_MODELS];
          if (fixedModels.some((m: string) => isModelDenylisted(m))) {
            fixedModels = fixedModels.filter((m: string) => !isModelDenylisted(m));
            if (fixedModels.length === 0) fixedModels = [...TESTED_DEFAULT_MODELS];
          }
          setSettings({
            ...defaultSettings,
            ...parsed.settings,
            openRouterModels: fixedModels,
            // AI provider keys are never kept in the browser (DECISIONS 11-Oct-2026): any key
            // saved earlier is dropped here, and the next save removes it from storage.
            ...(isFeatureEnabled('aiProviders') ? {} : { openRouterApiKey: '', groqApiKey: '' }),
          });

          if (parsed.settings.activeUserId) {
            const found = TEAM_MEMBERS.find((t) => t.id === parsed.settings.activeUserId);
            if (found) setActiveUserState(found);
          }
        }
      } else {
        // First time initialization
        setClients(getInitialClients());
        setLeads(getInitialLeads());
        setSettings(defaultSettings);
      }
    } catch {
      setClients(getInitialClients());
      setLeads(getInitialLeads());
    } finally {
      setHydrated(true);
    }
  }, []);

  // 2. Persist to localStorage whenever state changes (gated strictly behind hydrated)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload = {
        clients,
        leads,
        chatHistory,
        settings: {
          ...settings,
          activeUserId: activeUser.id,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota exceeded
    }
  }, [hydrated, clients, leads, chatHistory, settings, activeUser]);

  // 3. Listen for in-flight completions
  useEffect(() => {
    const unregister = registerInFlightListener((replyMsg) => {
      setChatHistory((prev) => [...prev, replyMsg]);
      setIsAiLoading(false);
    });
    return unregister;
  }, []);

  // A hidden screen (src/lib/screens.ts) can never become the active one, whoever asks.
  const setActiveTab = useCallback((tab: TabKey) => {
    setActiveTabState(resolveScreen(tab));
  }, []);

  const setActiveUser = useCallback((user: UserProfile) => {
    setActiveUserState(user);
    setSettings((prev) => ({ ...prev, activeUserId: user.id }));
  }, []);

  const openDraftModal = useCallback((target: DraftModalTarget) => {
    setSelectedDraftTarget(target);
  }, []);

  const closeDraftModal = useCallback(() => {
    setSelectedDraftTarget(null);
  }, []);

  // Mutations
  const addClient = useCallback(
    (clientData: Omit<Client, 'id'>) => {
      const newClient: Client = {
        ...clientData,
        id: 'c-' + Date.now(),
        activity: [
          {
            at: new Date().toISOString(),
            note: `Client added to register by ${activeUser.name}.`,
            author: activeUser.name,
          },
          ...(clientData.activity || []),
        ],
      };
      setClients((prev) => [newClient, ...prev]);
    },
    [activeUser.name],
  );

  const updateClient = useCallback(
    (id: string, updates: Partial<Client>, note?: string) => {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const activityNotes = [...(c.activity || [])];

          // Auto-log key changes: appraisal date, contract value, owner, standard, level
          const autoLogs: string[] = [];
          if (updates.lastAppraisalDate && updates.lastAppraisalDate !== c.lastAppraisalDate) {
            autoLogs.push(
              `Appraisal date updated from ${c.lastAppraisalDate} to ${updates.lastAppraisalDate}`,
            );
          }
          if (updates.contractValue && updates.contractValue !== c.contractValue) {
            autoLogs.push(
              `Contract value changed from ₹${c.contractValue.toLocaleString('en-IN')} to ₹${updates.contractValue.toLocaleString('en-IN')}`,
            );
          }
          if (updates.owner && updates.owner !== c.owner) {
            autoLogs.push(`Account owner reassigned from ${c.owner} to ${updates.owner}`);
          }
          if (updates.service && updates.service !== c.service) {
            autoLogs.push(`Standard updated from ${c.service} to ${updates.service}`);
          }
          if (updates.level && updates.level !== c.level) {
            autoLogs.push(`Level updated to ${updates.level}`);
          }

          if (note) {
            activityNotes.push({
              at: new Date().toISOString(),
              note,
              author: activeUser.name,
            });
          }

          autoLogs.forEach((log) => {
            activityNotes.push({
              at: new Date().toISOString(),
              note: log,
              author: activeUser.name,
            });
          });

          return {
            ...c,
            ...updates,
            activity: activityNotes,
          };
        }),
      );
    },
    [activeUser.name],
  );

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addLead = useCallback(
    (leadData: Omit<Lead, 'id'>) => {
      const newLead: Lead = {
        ...leadData,
        id: 'l-' + Date.now(),
        activity: [
          {
            at: new Date().toISOString(),
            note: `Lead created at stage ${leadData.stage} by ${activeUser.name}.`,
            author: activeUser.name,
          },
          ...(leadData.activity || []),
        ],
      };
      setLeads((prev) => [newLead, ...prev]);
    },
    [activeUser.name],
  );

  const updateLead = useCallback(
    (id: string, updates: Partial<Lead>, note?: string) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const activityNotes = [...(l.activity || [])];

          if (updates.stage && updates.stage !== l.stage) {
            activityNotes.push({
              at: new Date().toISOString(),
              note: `Stage moved from ${l.stage} to ${updates.stage}${updates.lostReason ? ` (Reason: ${updates.lostReason})` : ''}`,
              author: activeUser.name,
            });
          }

          if (note) {
            activityNotes.push({
              at: new Date().toISOString(),
              note,
              author: activeUser.name,
            });
          }

          return {
            ...l,
            ...updates,
            activity: activityNotes,
          };
        }),
      );
    },
    [activeUser.name],
  );

  const setLeadStage = useCallback(
    (id: string, stage: Stage, reason?: string) => {
      updateLead(id, { stage, lostReason: reason });
    },
    [updateLead],
  );

  const deleteLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addClientActivityNote = useCallback(
    (clientId: string, note: string) => {
      if (!note.trim()) return;
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            activity: [
              ...(c.activity || []),
              {
                at: new Date().toISOString(),
                note: note.trim(),
                author: activeUser.name,
              },
            ],
          };
        }),
      );
    },
    [activeUser.name],
  );

  const addLeadActivityNote = useCallback(
    (leadId: string, note: string) => {
      if (!note.trim()) return;
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          return {
            ...l,
            activity: [
              ...(l.activity || []),
              {
                at: new Date().toISOString(),
                note: note.trim(),
                author: activeUser.name,
              },
            ],
          };
        }),
      );
    },
    [activeUser.name],
  );

  const logEmailSent = useCallback(
    (target: { type: 'lead' | 'client'; id: string }, subject: string, recipientEmail: string) => {
      const today = new Date().toISOString().split('T')[0];
      const nowIso = new Date().toISOString();

      if (target.type === 'lead') {
        setLeads((prev) =>
          prev.map((l) => {
            if (l.id !== target.id) return l;
            return {
              ...l,
              lastContactDate: today,
              activity: [
                ...(l.activity || []),
                {
                  at: nowIso,
                  note: `Dispatched email to ${recipientEmail} ("${subject}") via email app.`,
                  author: activeUser.name,
                },
              ],
            };
          }),
        );
      } else {
        setClients((prev) =>
          prev.map((c) => {
            if (c.id !== target.id) return c;
            return {
              ...c,
              lastContactDate: today,
              activity: [
                ...(c.activity || []),
                {
                  at: nowIso,
                  note: `Dispatched renewal email to ${recipientEmail} ("${subject}") via email app.`,
                  author: activeUser.name,
                },
              ],
            };
          }),
        );
      }
    },
    [activeUser.name],
  );

  // Chat & AI interactions
  const sendUserMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const userMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-user',
        sender: 'user',
        text: text.trim(),
        timestamp: new Date().toISOString(),
        providerStamped: activeUser.name,
      };

      setChatHistory((prev) => [...prev, userMsg]);
      setIsAiLoading(true);

      try {
        await askDrishti(text, clients, leads, settings, activeUser.name);
      } catch {
        // Handled by in-flight listener and fallback
      } finally {
        setIsAiLoading(false);
      }
    },
    [clients, leads, settings, activeUser.name],
  );

  const clearChat = useCallback(() => {
    setChatHistory([]);
  }, []);

  const applyProposal = useCallback(
    (messageId: string, proposal: ToolProposal) => {
      if (proposal.action === 'update_lead') {
        const lead = leads.find(
          (l) =>
            l.id === proposal.id || l.company.toLowerCase() === proposal.targetName.toLowerCase(),
        );
        if (lead) {
          updateLead(
            lead.id,
            proposal.changes,
            `Applied AI proposal from Drishti: ${proposal.reason}`,
          );
        }
      } else if (proposal.action === 'update_client') {
        const client = clients.find(
          (c) =>
            c.id === proposal.id || c.company.toLowerCase() === proposal.targetName.toLowerCase(),
        );
        if (client) {
          updateClient(
            client.id,
            proposal.changes,
            `Applied AI proposal from Drishti: ${proposal.reason}`,
          );
        }
      }

      // Mark proposal applied in chat history
      setChatHistory((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.proposal) {
            return {
              ...msg,
              proposal: {
                ...msg.proposal,
                applied: true,
                discarded: false,
              },
            };
          }
          return msg;
        }),
      );
    },
    [leads, clients, updateLead, updateClient],
  );

  const discardProposal = useCallback((messageId: string) => {
    setChatHistory((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.proposal) {
          return {
            ...msg,
            proposal: {
              ...msg.proposal,
              applied: false,
              discarded: true,
            },
          };
        }
        return msg;
      }),
    );
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const resetToSampleData = useCallback(() => {
    setClients(getInitialClients());
    setLeads(getInitialLeads());
    setChatHistory([]);
    setSettings(defaultSettings);
    setActiveUserState(TEAM_MEMBERS[0]);
  }, []);

  const importRecords = useCallback(
    (newClients: Client[], newLeads: Lead[], mode: 'merge' | 'replace') => {
      if (mode === 'replace') {
        if (newClients.length > 0) setClients(newClients);
        if (newLeads.length > 0) setLeads(newLeads);
      } else {
        if (newClients.length > 0) {
          setClients((prev) => [...newClients, ...prev]);
        }
        if (newLeads.length > 0) {
          setLeads((prev) => [...newLeads, ...prev]);
        }
      }
    },
    [],
  );

  return (
    <CrmContext.Provider
      value={{
        hydrated,
        activeTab,
        setActiveTab,
        activeUser,
        setActiveUser,
        clients,
        leads,
        chatHistory,
        settings,
        isAiLoading,
        selectedDraftTarget,
        openDraftModal,
        closeDraftModal,
        addClient,
        updateClient,
        deleteClient,
        addLead,
        updateLead,
        deleteLead,
        setLeadStage,
        addClientActivityNote,
        addLeadActivityNote,
        logEmailSent,
        sendUserMessage,
        clearChat,
        applyProposal,
        discardProposal,
        updateSettings,
        resetToSampleData,
        importRecords,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
}
