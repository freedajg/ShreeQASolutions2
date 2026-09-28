import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Kanban,
  Table as TableIcon,
  Search,
  User,
  AlertCircle,
  Clock,
  Mail,
  X,
  Check,
  Building,
  Phone,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { Lead, Stage, ServiceKind } from '../types';
import { formatINR } from '../utils/currency';
import { formatStandardDate, getDaysAgo } from '../utils/dateUtils';

const STAGES: Stage[] = [
  'New',
  'Contacted',
  'Demo scheduled',
  'Demo done',
  'Proposal sent',
  'Won',
  'Lost',
];

interface SortableLeadCardProps {
  lead: Lead;
  onOpenDetails: (lead: Lead) => void;
}

function LeadCardItem({ lead, onOpenDetails }: SortableLeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { lead } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const daysQuiet = getDaysAgo(lead.lastContactDate);
  const isQuiet = lead.stage !== 'Won' && lead.stage !== 'Lost' && daysQuiet >= 7;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenDetails(lead)}
      className={`bg-[#18213a] border rounded-xl p-3.5 shadow-md cursor-grab active:cursor-grabbing select-none transition-all duration-150 space-y-2.5 ${
        isDragging
          ? 'opacity-40 border-[#818cf8]'
          : 'border-[rgba(148,175,235,0.18)] hover:border-[rgba(148,175,235,0.35)] hover:shadow-lg'
      }`}
    >
      {/* Top row: Company name (15px semibold wrapping to 2 lines) & Value */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-semibold text-[#e9eefb] leading-tight line-clamp-2 min-w-0 flex-1">
          {lead.company}
        </h4>
        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#111828] text-[#818cf8] border border-[#818cf8]/20 shrink-0">
          {lead.serviceInterest || 'ISO'}
        </span>
      </div>

      {/* Value */}
      <div className="text-sm font-bold font-mono text-[#22d3ee] tabular-nums">
        {formatINR(lead.value)}
      </div>

      {/* Bottom row: Owner avatar, contact name, status pill ONLY when in trouble */}
      <div className="pt-2 border-t border-[rgba(148,175,235,0.1)] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-[#111828] border border-[rgba(148,175,235,0.25)] flex items-center justify-center text-[10px] font-bold text-[#e9eefb] shrink-0">
            {lead.owner[0]}
          </div>
          <span className="text-[#9aabcc] text-[11px] truncate">{lead.contactName}</span>
        </div>

        {/* Status pill ONLY when quiet > 7 days */}
        {isQuiet && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30 shrink-0 flex items-center gap-1">
            <Clock size={10} />
            <span>{daysQuiet}d quiet</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function PipelineView() {
  const {
    leads,
    setLeadStage,
    addLead,
    updateLead,
    addLeadActivityNote,
    openDraftModal,
    activeUser,
  } = useCrm();

  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [lostPromptLeadId, setLostPromptLeadId] = useState<string | null>(null);
  const [lostReasonInput, setLostReasonInput] = useState('');
  const [newNoteText, setNewNoteText] = useState('');

  // Sensors for dnd-kit
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Filter leads
  const filteredLeads = leads.filter(
    (l) =>
      l.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Needs-attention leads: quiet leads (>7 days)
  const quietLeads = leads
    .filter((l) => l.stage !== 'Won' && l.stage !== 'Lost' && getDaysAgo(l.lastContactDate) >= 7)
    .sort((a, b) => getDaysAgo(b.lastContactDate) - getDaysAgo(a.lastContactDate));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column container or another card in that stage
    let targetStage: Stage | undefined;

    if (STAGES.includes(overId as Stage)) {
      targetStage = overId as Stage;
    } else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) {
        targetStage = overLead.stage;
      }
    }

    if (targetStage) {
      const draggedLead = leads.find((l) => l.id === leadId);
      if (draggedLead && draggedLead.stage !== targetStage) {
        if (targetStage === 'Lost') {
          // Prompt for reason
          setLostPromptLeadId(leadId);
          setLostReasonInput('');
        } else {
          setLeadStage(leadId, targetStage);
        }
      }
    }
  };

  const handleConfirmLost = () => {
    if (!lostPromptLeadId) return;
    setLeadStage(lostPromptLeadId, 'Lost', lostReasonInput || 'No specific reason given');
    setLostPromptLeadId(null);
    setLostReasonInput('');
  };

  const handleAddNoteToSelectedLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newNoteText.trim()) return;
    addLeadActivityNote(selectedLead.id, newNoteText);
    setNewNoteText('');
    // Refresh selected lead state
    const refreshed = leads.find((l) => l.id === selectedLead.id);
    if (refreshed) {
      setSelectedLead(refreshed);
    }
  };

  // Keep selected lead state in sync with context updates
  const currentSelectedLead = selectedLead
    ? leads.find((l) => l.id === selectedLead.id) || selectedLead
    : null;

  const activeDraggingLead = activeDragId ? leads.find((l) => l.id === activeDragId) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Pipeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9eefb]">
              Sales Pipeline
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-[#818cf8] border border-indigo-500/30">
              {leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost').length} Open Deals
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#9aabcc] mt-0.5">
            Stage progression and follow-up rhythm for process certification prospects.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Toggle View */}
          <div className="flex items-center bg-[#111828] p-1 rounded-xl border border-[rgba(148,175,235,0.16)]">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'board'
                  ? 'bg-[#18213a] text-[#e9eefb] font-semibold'
                  : 'text-[#6d7c9c] hover:text-[#e9eefb]'
              }`}
            >
              <Kanban size={14} />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#18213a] text-[#e9eefb] font-semibold'
                  : 'text-[#6d7c9c] hover:text-[#e9eefb]'
              }`}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          {/* Add Lead Button */}
          <button
            onClick={() => setIsAddLeadOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] hover:from-[#a78bfa] hover:to-[#22d3ee] text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Needs-Attention Chips (Single row reading Company · 11d scrolling sideways) */}
      {quietLeads.length > 0 && (
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl p-3 flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#fbbf24] shrink-0 pl-1">
            <AlertCircle size={15} />
            <span>Needs Attention:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {quietLeads.map((l) => {
              const days = getDaysAgo(l.lastContactDate);
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLead(l)}
                  className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-[#18213a] hover:bg-[#fbbf24]/10 text-[#e9eefb] border border-[#fbbf24]/30 hover:border-[#fbbf24] transition-colors flex items-center gap-1.5"
                >
                  <span className="font-semibold">{l.company}</span>
                  <span className="text-[#fbbf24] font-mono">· {days}d quiet</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d7c9c]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter pipeline by company, contact, or owner..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#111828] border border-[rgba(148,175,235,0.16)] text-sm text-[#e9eefb] placeholder-[#6d7c9c] focus:outline-none focus:border-[#818cf8]"
        />
      </div>

      {/* VIEW 1: KANBAN BOARD */}
      {viewMode === 'board' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-6">
            <div className="flex items-start gap-4 min-w-max pb-2">
              {STAGES.map((stage) => {
                const stageLeads = filteredLeads.filter((l) => l.stage === stage);
                const stageTotal = stageLeads.reduce((s, l) => s + l.value, 0);

                return (
                  <div
                    key={stage}
                    id={`column-${stage}`}
                    className="w-[300px] flex-shrink-0 bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl flex flex-col max-h-[75vh]"
                  >
                    {/* Column Header */}
                    <div className="p-3.5 border-b border-[rgba(148,175,235,0.12)] bg-[#18213a]/50 rounded-t-2xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#e9eefb]">{stage}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#18213a] text-[#9aabcc]">
                            {stageLeads.length}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#6d7c9c] tabular-nums">
                          {formatINR(stageTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Column Body Cards List */}
                    <SortableContext
                      id={stage}
                      items={stageLeads.map((l) => l.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-[140px]">
                        {stageLeads.length === 0 ? (
                          <div className="h-24 flex items-center justify-center border-2 border-dashed border-[rgba(148,175,235,0.08)] rounded-xl text-xs text-[#6d7c9c]">
                            Drag deals here
                          </div>
                        ) : (
                          stageLeads.map((lead) => (
                            <LeadCardItem
                              key={lead.id}
                              lead={lead}
                              onOpenDetails={(l) => setSelectedLead(l)}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
            </div>
          </div>

          <DragOverlay>
            {activeDraggingLead ? (
              <div className="w-[280px] bg-[#18213a] border-2 border-[#818cf8] rounded-xl p-3.5 shadow-2xl space-y-2">
                <h4 className="text-[15px] font-semibold text-[#e9eefb] line-clamp-2">
                  {activeDraggingLead.company}
                </h4>
                <div className="text-sm font-bold font-mono text-[#22d3ee]">
                  {formatINR(activeDraggingLead.value)}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* VIEW 2: TABLE VIEW FOR EXCEL USERS */}
      {viewMode === 'table' && (
        <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18213a] text-[#9aabcc] uppercase text-[10px] tracking-wider border-b border-[rgba(148,175,235,0.12)]">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Standard</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Last Contact</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(148,175,235,0.08)] text-[#e9eefb]">
                {filteredLeads.map((lead) => {
                  const daysQuiet = getDaysAgo(lead.lastContactDate);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="hover:bg-[#18213a]/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-sm">{lead.company}</td>
                      <td className="px-4 py-3 text-[#9aabcc]">
                        <div>{lead.contactName}</div>
                        <div className="text-[10px] text-[#6d7c9c]">{lead.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-[#18213a] text-[#818cf8] font-mono">
                          {lead.serviceInterest || 'ISO'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            lead.stage === 'Won'
                              ? 'bg-[#2dd4bf]/15 text-[#2dd4bf]'
                              : lead.stage === 'Lost'
                              ? 'bg-[#fb7185]/15 text-[#fb7185]'
                              : 'bg-[#18213a] text-[#9aabcc]'
                          }`}
                        >
                          {lead.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[#22d3ee] tabular-nums">
                        {formatINR(lead.value)}
                      </td>
                      <td className="px-4 py-3 text-[#9aabcc]">{lead.owner}</td>
                      <td className="px-4 py-3 text-[#6d7c9c]">
                        {formatStandardDate(lead.lastContactDate)} ({daysQuiet}d ago)
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDraftModal({ type: 'lead', entity: lead });
                          }}
                          className="px-2.5 py-1 rounded bg-[#18213a] hover:bg-indigo-500/20 text-[#818cf8] font-semibold text-[11px] border border-[rgba(148,175,235,0.15)] inline-flex items-center gap-1"
                        >
                          <Mail size={12} />
                          <span>Draft</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEAD DETAILS DRAWER / MODAL */}
      {currentSelectedLead && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-[#111828] border border-[rgba(148,175,235,0.22)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-[rgba(148,175,235,0.14)] bg-[#18213a]/60 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-[#e9eefb]">
                    {currentSelectedLead.company}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#18213a] text-[#818cf8] border border-[#818cf8]/20">
                    {currentSelectedLead.serviceInterest || 'ISO'}
                  </span>
                </div>
                <p className="text-xs text-[#9aabcc] mt-0.5">
                  Source: {currentSelectedLead.source} · Owner: {currentSelectedLead.owner}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    openDraftModal({ type: 'lead', entity: currentSelectedLead })
                  }
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Mail size={13} />
                  <span>Draft Follow-Up</span>
                </button>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1.5 rounded-lg text-[#6d7c9c] hover:text-white bg-[#18213a]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Core Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#080c16] p-3.5 rounded-xl border border-[rgba(148,175,235,0.1)]">
                <div>
                  <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                    Contact Person
                  </span>
                  <span className="text-[#e9eefb] font-medium text-xs">
                    {currentSelectedLead.contactName}
                  </span>
                </div>
                <div>
                  <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                    Deal Value
                  </span>
                  <span className="text-[#22d3ee] font-bold font-mono text-xs">
                    {formatINR(currentSelectedLead.value)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                    Current Stage
                  </span>
                  <select
                    value={currentSelectedLead.stage}
                    onChange={(e) => {
                      const newStage = e.target.value as Stage;
                      if (newStage === 'Lost') {
                        setLostPromptLeadId(currentSelectedLead.id);
                      } else {
                        setLeadStage(currentSelectedLead.id, newStage);
                      }
                    }}
                    className="mt-0.5 px-2 py-1 rounded bg-[#18213a] text-[#e9eefb] border border-[rgba(148,175,235,0.15)] text-xs font-semibold focus:outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                    Last Contact
                  </span>
                  <span className="text-[#e9eefb] font-mono text-xs">
                    {formatStandardDate(currentSelectedLead.lastContactDate)}
                  </span>
                </div>
              </div>

              {/* Internal Meeting Context (3rd person internal note) */}
              <div className="bg-[#18213a]/50 p-3.5 rounded-xl border border-[rgba(148,175,235,0.12)] space-y-1">
                <span className="text-[11px] font-bold text-[#818cf8] uppercase tracking-wider block">
                  Internal Meeting Context (3rd Person CRM Note):
                </span>
                <p className="text-[#e9eefb] leading-relaxed italic">
                  "{currentSelectedLead.meetingContext}"
                </p>
                <p className="text-[10px] text-[#6d7c9c] pt-1">
                  *When generating emails, Drishti automatically converts this internal note into a courteous first-person message for {currentSelectedLead.owner}.
                </p>
              </div>

              {/* Activity Trail & Add Note */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-[#e9eefb] uppercase tracking-wider">
                  Activity Trail ({currentSelectedLead.activity?.length || 0})
                </h4>

                {/* Add Note Input */}
                <form onSubmit={handleAddNoteToSelectedLead} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Log a call note, meeting takeaway, or next step..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.15)] text-xs text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
                  />
                  <button
                    type="submit"
                    disabled={!newNoteText.trim()}
                    className="px-3.5 py-2 rounded-xl bg-[#18213a] hover:bg-indigo-500/20 text-[#818cf8] font-bold text-xs border border-[rgba(148,175,235,0.15)] disabled:opacity-40"
                  >
                    Add Note
                  </button>
                </form>

                {/* Trail list */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {currentSelectedLead.activity && currentSelectedLead.activity.length > 0 ? (
                    currentSelectedLead.activity.map((act, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-[#080c16] border border-[rgba(148,175,235,0.08)] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#6d7c9c]">
                          <span className="font-semibold text-[#818cf8]">{act.author || 'System'}</span>
                          <span>{formatStandardDate(act.at)}</span>
                        </div>
                        <p className="text-xs text-[#9aabcc]">{act.note}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-3 text-[#6d7c9c] text-xs italic">
                      No activity recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOST REASON PROMPT MODAL */}
      {lostPromptLeadId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#111828] border border-[#fb7185]/40 rounded-2xl p-5 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-2 text-[#fb7185] font-bold text-sm">
              <AlertCircle size={18} />
              <span>Mark Deal as Lost</span>
            </div>
            <p className="text-xs text-[#9aabcc]">
              Please record why this prospect did not convert so the firm can analyze objections and pricing friction.
            </p>
            <textarea
              rows={3}
              value={lostReasonInput}
              onChange={(e) => setLostReasonInput(e.target.value)}
              placeholder="e.g. Chose competitor on price, postponed budget to next FY, internal restructuring..."
              className="w-full p-3 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-xs text-[#e9eefb] focus:outline-none focus:border-[#fb7185]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setLostPromptLeadId(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-[#9aabcc] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLost}
                className="px-4 py-2 rounded-xl bg-[#fb7185] text-slate-950 font-bold text-xs shadow-md"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {isAddLeadOpen && (
        <AddLeadModal
          onClose={() => setIsAddLeadOpen(false)}
          onAdd={(leadData) => {
            addLead(leadData);
            setIsAddLeadOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddLeadModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (lead: Omit<Lead, 'id'>) => void;
}) {
  const { activeUser } = useCrm();
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('External Marketing');
  const [stage, setStage] = useState<Stage>('New');
  const [value, setValue] = useState(500000);
  const [owner, setOwner] = useState(activeUser.name);
  const [serviceInterest, setServiceInterest] = useState<ServiceKind>('ISO');
  const [meetingContext, setMeetingContext] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !contactName.trim()) return;

    onAdd({
      company: company.trim(),
      contactName: contactName.trim(),
      email: email.trim() || 'contact@' + company.toLowerCase().replace(/\s+/g, '') + '.in',
      phone: phone.trim() || '+91 98000 00000',
      source,
      stage,
      value: Number(value) || 500000,
      owner,
      serviceInterest,
      lastContactDate: new Date().toISOString().split('T')[0],
      nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      meetingContext:
        meetingContext.trim() ||
        `${owner} connected with ${contactName} regarding ${serviceInterest} certification.`,
      activity: [
        {
          at: new Date().toISOString(),
          note: `Lead created by ${owner}`,
          author: owner,
        },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111828] border border-[rgba(148,175,235,0.22)] rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,175,235,0.12)]">
          <h3 className="font-bold text-base text-[#e9eefb]">Add New Prospect / Lead</h3>
          <button onClick={onClose} className="text-[#6d7c9c] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Company Name *
              </label>
              <input
                required
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Param Solutions Pvt Ltd"
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
              />
            </div>
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Contact Person *
              </label>
              <input
                required
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Rameshwar Gupta"
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Standard
              </label>
              <select
                value={serviceInterest}
                onChange={(e) => setServiceInterest(e.target.value as ServiceKind)}
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
              >
                <option value="ISO">ISO</option>
                <option value="CMMI">CMMI</option>
                <option value="IPA">IPA</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Deal Value (₹)
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] font-mono focus:outline-none focus:border-[#818cf8]"
              />
            </div>
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Owner
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
              >
                <option value="Ramesh">Ramesh</option>
                <option value="Pramila">Pramila</option>
                <option value="Mahesh">Mahesh</option>
                <option value="Sunita">Sunita</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
              Internal Meeting Context (3rd Person Note)
            </label>
            <textarea
              rows={2}
              value={meetingContext}
              onChange={(e) => setMeetingContext(e.target.value)}
              placeholder="e.g. Mahesh spoke with Ananya; they discussed ISMS audit scope for Bangalore DC."
              className="w-full p-2.5 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(148,175,235,0.1)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#9aabcc] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] text-slate-950 font-bold text-xs shadow-md"
            >
              Create Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
