import React, { useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  Mail,
  X,
  Trash2,
  Clock,
  ShieldAlert,
  CheckCircle,
  Calendar,
  Phone,
  User,
  Edit2,
  FileText,
} from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { Client, ServiceKind } from '../types';
import { formatINR } from '../utils/currency';
import {
  getDaysUntilRenewal,
  getRenewalDate,
  formatStandardDate,
  getRenewalCycleYears,
} from '../utils/dateUtils';

export function ClientsView() {
  const {
    clients,
    addClient,
    updateClient,
    deleteClient,
    addClientActivityNote,
    openDraftModal,
    activeUser,
  } = useCrm();

  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editCompany, setEditCompany] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editService, setEditService] = useState<ServiceKind>('ISO');
  const [editLevel, setEditLevel] = useState('');
  const [editValue, setEditValue] = useState(0);
  const [editAppraisalDate, setEditAppraisalDate] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const now = new Date();

  // Filter clients
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.level || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = serviceFilter === 'ALL' || c.service === serviceFilter;
    const matchesOwner =
      ownerFilter === 'ALL' || c.owner.toLowerCase() === ownerFilter.toLowerCase();
    return matchesSearch && matchesService && matchesOwner;
  });

  const handleOpenClient = (client: Client) => {
    setSelectedClient(client);
    setIsEditing(false);
    setEditCompany(client.company);
    setEditContact(client.contactName);
    setEditEmail(client.email);
    setEditPhone(client.phone);
    setEditService(client.service);
    setEditLevel(client.level || '');
    setEditValue(client.contractValue);
    setEditAppraisalDate(client.lastAppraisalDate);
    setEditOwner(client.owner);
    setEditNotes(client.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    updateClient(selectedClient.id, {
      company: editCompany.trim(),
      contactName: editContact.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      service: editService,
      level: editLevel.trim() || undefined,
      contractValue: Number(editValue) || 500000,
      lastAppraisalDate: editAppraisalDate,
      owner: editOwner,
      notes: editNotes.trim(),
    });

    setIsEditing(false);
    const refreshed = clients.find((c) => c.id === selectedClient.id);
    if (refreshed) setSelectedClient(refreshed);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newNoteText.trim()) return;
    addClientActivityNote(selectedClient.id, newNoteText);
    setNewNoteText('');
    const refreshed = clients.find((c) => c.id === selectedClient.id);
    if (refreshed) setSelectedClient(refreshed);
  };

  // Sync selectedClient with global state
  const currentSelectedClient = selectedClient
    ? clients.find((c) => c.id === selectedClient.id) || selectedClient
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9eefb]">
              Certified Clients
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#18213a] text-[#818cf8] border border-[rgba(148,175,235,0.18)]">
              {clients.length} Active Accounts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#9aabcc] mt-0.5">
            Master record of certified organizations, appraisal dates, and contract values.
          </p>
        </div>

        <button
          onClick={() => setIsAddClientOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] hover:from-[#a78bfa] hover:to-[#22d3ee] text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Add Client</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#111828] p-3 rounded-2xl border border-[rgba(148,175,235,0.16)]">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d7c9c]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clients by name, contact, level, or audit notes..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.14)] text-sm text-[#e9eefb] placeholder-[#6d7c9c] focus:outline-none focus:border-[#818cf8]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.14)] text-xs text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
          >
            <option value="ALL">All Standards</option>
            <option value="CMMI">CMMI (3 Years)</option>
            <option value="ISO">ISO (1 Year)</option>
            <option value="IPA">IPA (1 Year)</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.14)] text-xs text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
          >
            <option value="ALL">All Owners</option>
            <option value="Ramesh">Ramesh</option>
            <option value="Pramila">Pramila</option>
            <option value="Mahesh">Mahesh</option>
            <option value="Sunita">Sunita</option>
          </select>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-[#111828] border border-[rgba(148,175,235,0.16)] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#18213a] text-[#9aabcc] uppercase text-[10px] tracking-wider border-b border-[rgba(148,175,235,0.12)]">
              <tr>
                <th className="px-4 py-3">Client Company</th>
                <th className="px-4 py-3">Standard / Level</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Last Appraisal</th>
                <th className="px-4 py-3">Renewal Status</th>
                <th className="px-4 py-3">Contract Value</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(148,175,235,0.08)] text-[#e9eefb]">
              {filteredClients.map((client) => {
                const days = getDaysUntilRenewal(client, now);
                const renewalDate = getRenewalDate(client);

                return (
                  <tr
                    key={client.id}
                    onClick={() => handleOpenClient(client)}
                    className="hover:bg-[#18213a]/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-[#e9eefb]">{client.company}</div>
                      <div className="text-[11px] text-[#6d7c9c] truncate max-w-xs">
                        {client.notes}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#18213a] text-[#818cf8] border border-[#818cf8]/20">
                        {client.service} {client.level || ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#9aabcc]">
                      <div>{client.contactName}</div>
                      <div className="text-[10px] text-[#6d7c9c]">{client.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#9aabcc]">
                      {formatStandardDate(client.lastAppraisalDate)}
                    </td>
                    <td className="px-4 py-3">
                      {days < 0 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#fb7185]/15 text-[#fb7185] border border-[#fb7185]/30">
                          {Math.abs(days)}d Overdue
                        </span>
                      ) : days <= 90 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30">
                          Due in {days}d
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400">
                          Valid ({days}d)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-[#e9eefb] tabular-nums">
                      {formatINR(client.contractValue)}
                    </td>
                    <td className="px-4 py-3 text-[#9aabcc]">{client.owner}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDraftModal({ type: 'client', entity: client });
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

      {/* CLIENT DETAILS DRAWER / MODAL */}
      {currentSelectedClient && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedClient(null)}
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
                    {currentSelectedClient.company}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#18213a] text-[#818cf8] border border-[#818cf8]/20">
                    {currentSelectedClient.service} {currentSelectedClient.level || ''}
                  </span>
                </div>
                <p className="text-xs text-[#9aabcc] mt-0.5">
                  Owner: {currentSelectedClient.owner} · Contact:{' '}
                  {currentSelectedClient.contactName}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3 py-1.5 rounded-xl bg-[#18213a] hover:bg-indigo-500/20 text-[#818cf8] font-bold text-xs border border-[rgba(148,175,235,0.15)] flex items-center gap-1.5"
                >
                  <Edit2 size={13} />
                  <span>{isEditing ? 'Cancel Edit' : 'Edit'}</span>
                </button>
                <button
                  onClick={() => openDraftModal({ type: 'client', entity: currentSelectedClient })}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#818cf8] to-[#2dd4bf] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Mail size={13} />
                  <span>Draft Renewal</span>
                </button>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1.5 rounded-lg text-[#6d7c9c] hover:text-white bg-[#18213a]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {isEditing ? (
                /* EDIT FORM */
                <form onSubmit={handleSaveEdit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={editContact}
                        onChange={(e) => setEditContact(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                        Standard
                      </label>
                      <select
                        value={editService}
                        onChange={(e) => setEditService(e.target.value as ServiceKind)}
                        className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb]"
                      >
                        <option value="CMMI">CMMI (3-Year Cycle)</option>
                        <option value="ISO">ISO (1-Year Cycle)</option>
                        <option value="IPA">IPA (1-Year Cycle)</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                        Level / Detail
                      </label>
                      <input
                        type="text"
                        value={editLevel}
                        onChange={(e) => setEditLevel(e.target.value)}
                        placeholder="e.g. DEV ML5"
                        className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                        Contract Value (₹)
                      </label>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb] font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                        Last Appraisal Date (YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        value={editAppraisalDate}
                        onChange={(e) => setEditAppraisalDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                        Assigned Owner
                      </label>
                      <select
                        value={editOwner}
                        onChange={(e) => setEditOwner(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb]"
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
                      Auditor Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.18)] text-[#e9eefb]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 rounded-xl text-[#9aabcc]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#2dd4bf] text-slate-950 font-bold text-xs"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                /* READ ONLY DISPLAY */
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#080c16] p-3.5 rounded-xl border border-[rgba(148,175,235,0.1)]">
                    <div>
                      <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                        Contract Value
                      </span>
                      <span className="text-[#e9eefb] font-bold font-mono text-xs">
                        {formatINR(currentSelectedClient.contractValue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                        Last Appraisal
                      </span>
                      <span className="text-[#e9eefb] font-mono text-xs">
                        {formatStandardDate(currentSelectedClient.lastAppraisalDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                        Renewal Due
                      </span>
                      <span className="text-[#2dd4bf] font-mono font-bold text-xs">
                        {formatStandardDate(getRenewalDate(currentSelectedClient))}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6d7c9c] block text-[10px] uppercase font-semibold">
                        Cycle Length
                      </span>
                      <span className="text-[#818cf8] font-semibold text-xs">
                        {getRenewalCycleYears(currentSelectedClient.service)} Years
                      </span>
                    </div>
                  </div>

                  {currentSelectedClient.notes && (
                    <div className="p-3.5 rounded-xl bg-[#18213a]/50 border border-[rgba(148,175,235,0.12)]">
                      <span className="text-[10px] font-bold text-[#6d7c9c] uppercase block mb-1">
                        Auditor Notes & Observations:
                      </span>
                      <p className="text-[#e9eefb] leading-relaxed">
                        {currentSelectedClient.notes}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Activity Trail */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-[#e9eefb] uppercase tracking-wider">
                  Audit Activity Trail ({currentSelectedClient.activity?.length || 0})
                </h4>

                <form onSubmit={handleAddNote} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Log audit review note, client call, or certificate status..."
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

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {currentSelectedClient.activity && currentSelectedClient.activity.length > 0 ? (
                    currentSelectedClient.activity.map((act, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-[#080c16] border border-[rgba(148,175,235,0.08)] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#6d7c9c]">
                          <span className="font-semibold text-[#818cf8]">
                            {act.author || 'Auditor'}
                          </span>
                          <span>{formatStandardDate(act.at)}</span>
                        </div>
                        <p className="text-xs text-[#9aabcc]">{act.note}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-3 text-[#6d7c9c] text-xs italic">
                      No notes recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone: Delete Client */}
              <div className="pt-4 border-t border-[rgba(148,175,235,0.1)] flex items-center justify-between">
                <span className="text-[11px] text-[#6d7c9c]">
                  Remove this organization from active roster
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to delete ${currentSelectedClient.company}?`,
                      )
                    ) {
                      deleteClient(currentSelectedClient.id);
                      setSelectedClient(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#fb7185]/10 hover:bg-[#fb7185]/20 text-[#fb7185] font-semibold text-xs border border-[#fb7185]/20 flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Delete Client</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CLIENT MODAL */}
      {isAddClientOpen && (
        <AddClientModal
          onClose={() => setIsAddClientOpen(false)}
          onAdd={(c) => {
            addClient(c);
            setIsAddClientOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddClientModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (client: Omit<Client, 'id'>) => void;
}) {
  const { activeUser } = useCrm();
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState<ServiceKind>('CMMI');
  const [level, setLevel] = useState('DEV ML3');
  const [contractValue, setContractValue] = useState(1200000);
  const [lastAppraisalDate, setLastAppraisalDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [owner, setOwner] = useState(activeUser.name);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !contactName.trim()) return;

    onAdd({
      company: company.trim(),
      contactName: contactName.trim(),
      email: email.trim() || 'contact@' + company.toLowerCase().replace(/\s+/g, '') + '.in',
      phone: phone.trim() || '+91 98000 00000',
      service,
      level: level.trim() || undefined,
      contractValue: Number(contractValue) || 1000000,
      lastAppraisalDate,
      owner,
      notes: notes.trim(),
      activity: [
        {
          at: new Date().toISOString(),
          note: `Client account created by ${owner}`,
          author: owner,
        },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111828] border border-[rgba(148,175,235,0.22)] rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(148,175,235,0.12)]">
          <h3 className="font-bold text-base text-[#e9eefb]">Add Certified Client</h3>
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
                placeholder="e.g. Infosys Process Lab"
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
                placeholder="e.g. S. Venkatraman"
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
                value={service}
                onChange={(e) => setService(e.target.value as ServiceKind)}
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
              >
                <option value="CMMI">CMMI (3-Year Cycle)</option>
                <option value="ISO">ISO (1-Year Cycle)</option>
                <option value="IPA">IPA (1-Year Cycle)</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Level / Detail
              </label>
              <input
                type="text"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. DEV ML5"
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] focus:outline-none focus:border-[#818cf8]"
              />
            </div>
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Contract Value (₹)
              </label>
              <input
                type="number"
                value={contractValue}
                onChange={(e) => setContractValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#080c16] border border-[rgba(148,175,235,0.16)] text-[#e9eefb] font-mono focus:outline-none focus:border-[#818cf8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#6d7c9c] uppercase font-semibold text-[10px] mb-1">
                Last Appraisal Date
              </label>
              <input
                type="date"
                value={lastAppraisalDate}
                onChange={(e) => setLastAppraisalDate(e.target.value)}
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
              Auditor Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Scope includes 2 development centers in Pune and Chennai."
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
              Create Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
