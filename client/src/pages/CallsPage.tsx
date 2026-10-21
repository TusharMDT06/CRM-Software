import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Calendar,
  Clock,
  Plus,
  Search,
  Trash2,
  Eye,
  X,
  Phone,
} from 'lucide-react';
import { api } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { useToast } from '../context/ToastContext.js';
import { CallItem, CallType, CallPurpose, CallResult } from '../types/index.js';

function formatDuration(seconds?: number): string {
  if (!seconds || seconds === 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function getCallTypeBadge(callType: CallType) {
  if (callType === 'inbound') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
        <PhoneIncoming className="w-3 h-3" />
        <span>Inbound</span>
      </span>
    );
  }
  if (callType === 'scheduled') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
        <Calendar className="w-3 h-3" />
        <span>Scheduled</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
      <PhoneOutgoing className="w-3 h-3" />
      <span>Outbound</span>
    </span>
  );
}

function getCallResultBadge(callResult: CallResult) {
  const resultConfig: Record<CallResult, { label: string; cls: string }> = {
    connected: {
      label: 'Connected',
      cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    callback_requested: {
      label: 'Callback Requested',
      cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    },
    interested: {
      label: 'Interested',
      cls: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    },
    left_voicemail: {
      label: 'Left Voicemail',
      cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    no_answer: {
      label: 'No Answer',
      cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    },
    busy: {
      label: 'Busy',
      cls: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    },
    wrong_number: {
      label: 'Wrong Number',
      cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    },
    not_interested: {
      label: 'Not Interested',
      cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    },
  };

  const current = resultConfig[callResult] || resultConfig.connected;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${current.cls}`}>
      {current.label}
    </span>
  );
}

export const CallsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Filters & State
  const [callTypeFilter, setCallTypeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [logModalOpen, setLogModalOpen] = useState<boolean>(false);
  const [activeCall, setActiveCall] = useState<CallItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    subject: '',
    callType: 'outbound' as CallType,
    callPurpose: 'follow_up' as CallPurpose,
    startTime: new Date().toISOString().slice(0, 16),
    durationMins: 5,
    callResult: 'connected' as CallResult,
    contactName: '',
    phoneNumber: '',
    relatedEntityType: 'none' as 'deal' | 'account' | 'lead' | 'contact' | 'none',
    relatedEntityId: '',
    relatedEntityName: '',
    notes: '',
    followUpAction: '',
  });

  // Query CRM records for linking (Deals & Accounts)
  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-calls'],
    queryFn: async () => {
      const res = await api.get('/deals?limit=50');
      return res.data?.deals || res.data || [];
    },
    enabled: logModalOpen,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-for-calls'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=50');
      return res.data?.accounts || res.data || [];
    },
    enabled: logModalOpen,
  });

  // Fetch Calls Data
  const { data, isLoading } = useQuery<{
    calls: CallItem[];
    stats: {
      totalCalls: number;
      outboundCount: number;
      inboundCount: number;
      scheduledCount: number;
      totalDurationSeconds: number;
    };
  }>({
    queryKey: ['calls', callTypeFilter, resultFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (callTypeFilter !== 'all') params.append('callType', callTypeFilter);
      if (resultFilter !== 'all') params.append('callResult', resultFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const res = await api.get(`/calls?${params.toString()}`);
      return res.data;
    },
  });

  const calls = data?.calls || [];
  const stats = data?.stats || {
    totalCalls: 0,
    outboundCount: 0,
    inboundCount: 0,
    scheduledCount: 0,
    totalDurationSeconds: 0,
  };

  // Create / Log Call Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/calls', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      showToast('Call logged successfully', 'success');
      setLogModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to log call', 'error');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/calls/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      showToast('Call deleted successfully', 'success');
      setActiveCall(null);
    },
  });

  const resetForm = () => {
    setFormData({
      subject: '',
      callType: 'outbound',
      callPurpose: 'follow_up',
      startTime: new Date().toISOString().slice(0, 16),
      durationMins: 5,
      callResult: 'connected',
      contactName: '',
      phoneNumber: '',
      relatedEntityType: 'none',
      relatedEntityId: '',
      relatedEntityName: '',
      notes: '',
      followUpAction: '',
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      showToast('Call subject is required', 'error');
      return;
    }

    createMutation.mutate({
      subject: formData.subject.trim(),
      callType: formData.callType,
      callPurpose: formData.callPurpose,
      startTime: new Date(formData.startTime).toISOString(),
      durationSeconds: Number(formData.durationMins || 0) * 60,
      callResult: formData.callResult,
      contactName: formData.contactName.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      relatedTo: {
        entityType: formData.relatedEntityType,
        entityId: formData.relatedEntityId || undefined,
        entityName: formData.relatedEntityName || undefined,
      },
      notes: formData.notes.trim(),
      followUpAction: formData.followUpAction.trim(),
    });
  };

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header (Zoho CRM Calls Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F07B2A]/10 text-[#F07B2A]">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Calls</h1>
              <select
                value={callTypeFilter}
                onChange={(e) => setCallTypeFilter(e.target.value)}
                className="text-xs font-semibold bg-muted/20 border border-border rounded-xl px-2.5 py-1 text-foreground focus:outline-none"
              >
                <option value="all">All Calls</option>
                <option value="outbound">Outbound Calls</option>
                <option value="inbound">Inbound Calls</option>
                <option value="scheduled">Scheduled Calls</option>
              </select>
            </div>
            <p className="text-xs text-muted">
              Log phone conversations, outbound pitches, incoming support and scheduled callbacks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              resetForm();
              setFormData((prev) => ({ ...prev, callType: 'scheduled', durationMins: 15 }));
              setLogModalOpen(true);
            }}
            variant="outline"
            className="text-xs font-medium border-border"
          >
            <Calendar className="w-3.5 h-3.5 mr-1 text-purple-600" />
            <span>Schedule Call</span>
          </Button>

          <Button
            onClick={() => {
              resetForm();
              setLogModalOpen(true);
            }}
            className="bg-[#F07B2A] hover:bg-[#d96b20] text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Log a Call</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-3.5 bg-card border border-border rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase">Total Calls</span>
            <div className="text-lg font-bold text-foreground mt-0.5">{stats.totalCalls}</div>
          </div>
          <div className="p-2 rounded-xl bg-muted/20 text-muted">
            <Phone className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-card border border-border rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase">Outbound</span>
            <div className="text-lg font-bold text-emerald-600 mt-0.5">{stats.outboundCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
            <PhoneOutgoing className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-card border border-border rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase">Inbound</span>
            <div className="text-lg font-bold text-blue-600 mt-0.5">{stats.inboundCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
            <PhoneIncoming className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-card border border-border rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase">Scheduled</span>
            <div className="text-lg font-bold text-purple-600 mt-0.5">{stats.scheduledCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-card border border-border rounded-2xl shadow-2xs flex items-center justify-between col-span-2 md:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-muted uppercase">Total Talk Time</span>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {formatDuration(stats.totalDurationSeconds)}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Toolbar (Search & Filter) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-2xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search calls by subject, contact, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-muted/20 border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#F07B2A] w-64"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="text-xs bg-muted/20 border border-border rounded-xl px-2.5 py-1.5 text-foreground font-medium focus:outline-none"
          >
            <option value="all">All Outcomes</option>
            <option value="connected">Connected</option>
            <option value="callback_requested">Callback Requested</option>
            <option value="left_voicemail">Left Voicemail</option>
            <option value="no_answer">No Answer</option>
          </select>
        </div>
      </div>

      {/* 4. Calls Table */}
      <div className="bg-card border border-border rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted">Loading calls log...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted font-medium bg-muted/10">
                <tr>
                  <th className="py-3 px-3">Call Subject</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Purpose</th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Result</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Related To</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-muted">
                      No calls logged yet. Click "+ Log a Call" to record phone conversations.
                    </td>
                  </tr>
                ) : (
                  calls.map((c) => (
                    <tr key={c._id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          onClick={() => setActiveCall(c)}
                          className="font-bold text-foreground hover:text-[#F07B2A] cursor-pointer transition-colors block max-w-xs truncate"
                        >
                          {c.subject}
                        </span>
                      </td>
                      <td className="py-3 px-3">{getCallTypeBadge(c.callType)}</td>
                      <td className="py-3 px-3 text-muted capitalize">{c.callPurpose}</td>
                      <td className="py-3 px-3 text-muted whitespace-nowrap">
                        {new Date(c.startTime).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 text-foreground font-semibold">
                        {formatDuration(c.durationSeconds)}
                      </td>
                      <td className="py-3 px-3">{getCallResultBadge(c.callResult)}</td>
                      <td className="py-3 px-3 text-muted">
                        <div>
                          <span className="font-semibold text-foreground block truncate max-w-[120px]">
                            {c.contactName || '—'}
                          </span>
                          {c.phoneNumber && (
                            <span className="text-[10px] text-muted block">{c.phoneNumber}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted truncate max-w-[130px]">
                        {c.relatedTo && c.relatedTo.entityType !== 'none'
                          ? c.relatedTo.entityName || c.relatedTo.entityType
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-muted truncate max-w-[100px]">
                        {c.owner?.name || 'User'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveCall(c)}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted/20"
                            title="View Call Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete call log "${c.subject}"?`)) {
                                deleteMutation.mutate(c._id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete Call"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted">
          <span>Total Records: {calls.length}</span>
          <span>Page 1 of 1</span>
        </div>
      </div>

      {/* 5. Log / Schedule Call Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#F07B2A]">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {formData.callType === 'scheduled' ? 'Schedule a Call' : 'Log a Call'}
                  </h3>
                  <p className="text-xs text-muted">Record outbound pitch, client sync, or discovery call</p>
                </div>
              </div>
              <button
                onClick={() => setLogModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Call Type & Purpose */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Call Type</label>
                  <select
                    value={formData.callType}
                    onChange={(e) => setFormData({ ...formData, callType: e.target.value as CallType })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  >
                    <option value="outbound">Outbound (Outgoing)</option>
                    <option value="inbound">Inbound (Incoming)</option>
                    <option value="scheduled">Scheduled Follow-up</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Call Purpose</label>
                  <select
                    value={formData.callPurpose}
                    onChange={(e) => setFormData({ ...formData, callPurpose: e.target.value as CallPurpose })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  >
                    <option value="discovery">Discovery / Assessment</option>
                    <option value="demo">Demo Follow-up</option>
                    <option value="negotiation">Pricing & Negotiation</option>
                    <option value="prospecting">Cold Prospecting</option>
                    <option value="follow_up">General Follow-up</option>
                    <option value="support">Customer Support</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">
                  Call Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discovery Call - Omnichannel POS Sync"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                />
              </div>

              {/* Contact & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Ambani"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98200 11223"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
              </div>

              {/* Timing & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Call Time</label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.durationMins}
                    onChange={(e) => setFormData({ ...formData, durationMins: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
              </div>

              {/* Call Result */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Call Result / Outcome</label>
                <select
                  value={formData.callResult}
                  onChange={(e) => setFormData({ ...formData, callResult: e.target.value as CallResult })}
                  className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                >
                  <option value="connected">Connected / Reached</option>
                  <option value="callback_requested">Callback Requested</option>
                  <option value="interested">Interested / Lead Qualified</option>
                  <option value="left_voicemail">Left Voicemail / Message</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Line Busy</option>
                  <option value="wrong_number">Wrong Number</option>
                  <option value="not_interested">Not Interested</option>
                </select>
              </div>

              {/* Link to CRM Record */}
              <div className="p-3 bg-muted/15 border border-border rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  Related To (CRM Record)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.relatedEntityType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        relatedEntityType: e.target.value as any,
                        relatedEntityId: '',
                        relatedEntityName: '',
                      })
                    }
                    className="px-2.5 py-1.5 text-xs bg-muted/20 border border-border rounded-lg text-foreground font-medium focus:outline-none"
                  >
                    <option value="none">No Link</option>
                    <option value="deal">Deal</option>
                    <option value="account">Account</option>
                  </select>

                  {formData.relatedEntityType === 'deal' && (
                    <select
                      value={formData.relatedEntityId}
                      onChange={(e) => {
                        const found = (deals as any[]).find((d) => d._id === e.target.value);
                        setFormData({
                          ...formData,
                          relatedEntityId: e.target.value,
                          relatedEntityName: found?.title || '',
                        });
                      }}
                      className="px-2.5 py-1.5 text-xs bg-muted/20 border border-border rounded-lg text-foreground font-medium focus:outline-none"
                    >
                      <option value="">Select Deal...</option>
                      {(deals as any[]).map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {formData.relatedEntityType === 'account' && (
                    <select
                      value={formData.relatedEntityId}
                      onChange={(e) => {
                        const found = (accounts as any[]).find((a) => a._id === e.target.value);
                        setFormData({
                          ...formData,
                          relatedEntityId: e.target.value,
                          relatedEntityName: found?.name || '',
                        });
                      }}
                      className="px-2.5 py-1.5 text-xs bg-muted/20 border border-border rounded-lg text-foreground font-medium focus:outline-none"
                    >
                      <option value="">Select Account...</option>
                      {(accounts as any[]).map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Call Notes / Discussion</label>
                <textarea
                  rows={2}
                  placeholder="Key conversation points, objections, and next steps..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLogModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#F07B2A] text-white hover:bg-[#d96b20]"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Call Log'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Call Detail Modal */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getCallTypeBadge(activeCall.callType)}
                  {getCallResultBadge(activeCall.callResult)}
                </div>
                <h3 className="text-base font-bold text-foreground">{activeCall.subject}</h3>
                <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {new Date(activeCall.startTime).toLocaleString('en-IN')} • Duration:{' '}
                    {formatDuration(activeCall.durationSeconds)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setActiveCall(null)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contact Details */}
            <div className="p-3 rounded-xl bg-muted/15 border border-border space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">Contact Person:</span>
                <span className="font-bold text-foreground">{activeCall.contactName || '—'}</span>
              </div>
              {activeCall.phoneNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Phone Number:</span>
                  <a
                    href={`tel:${activeCall.phoneNumber}`}
                    className="font-bold text-[#F07B2A] hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{activeCall.phoneNumber}</span>
                  </a>
                </div>
              )}
              {activeCall.relatedTo && activeCall.relatedTo.entityType !== 'none' && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Related Record:</span>
                  <span className="font-bold text-foreground">
                    {activeCall.relatedTo.entityName}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            {activeCall.notes && (
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                  Call Notes
                </span>
                <p className="text-xs text-muted bg-muted/10 p-3 rounded-xl border border-border">
                  {activeCall.notes}
                </p>
              </div>
            )}

            {activeCall.followUpAction && (
              <div className="p-3 rounded-xl bg-[#F07B2A]/5 border border-[#F07B2A]/20 text-xs text-muted">
                <span className="font-bold text-[#F07B2A] block mb-0.5">Follow-up Action:</span>
                <span>{activeCall.followUpAction}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                onClick={() => {
                  if (confirm(`Delete call log "${activeCall.subject}"?`)) {
                    deleteMutation.mutate(activeCall._id);
                  }
                }}
                className="text-xs text-rose-600 hover:underline font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Call</span>
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveCall(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallsPage;
