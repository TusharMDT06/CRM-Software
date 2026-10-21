import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Plus,
  Search,
  Filter as FilterIcon,
  Video,
  ExternalLink,
  Clock,
  Building2,
  Trash2,
  Eye,
  CheckCircle2,
  X,
  List as ListIcon,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { useToast } from '../context/ToastContext.js';
import { MeetingItem, MeetingStatus, MeetingLocationType } from '../types/index.js';

function formatDateTime(dateStr?: string, allDay?: boolean): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (allDay) {
    return `${day}/${month}/${year}`;
  }

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');

  return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
}

export const MeetingsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Filters & State
  const [activeView, setActiveView] = useState<'all' | 'upcoming' | 'today' | 'completed' | 'my'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [activeMeeting, setActiveMeeting] = useState<MeetingItem | null>(null);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    from: new Date().toISOString().slice(0, 16),
    to: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    allDay: false,
    status: 'scheduled' as MeetingStatus,
    locationType: 'google_meet' as MeetingLocationType,
    locationDetails: '',
    meetingUrl: '',
    contactName: '',
    contactEmail: '',
    relatedEntityType: 'none' as 'deal' | 'account' | 'lead' | 'contact' | 'none',
    relatedEntityId: '',
    relatedEntityName: '',
    agenda: '',
    outcome: '',
    reminderMinutes: 15,
  });

  // Query CRM records for linking (Deals & Accounts)
  const { data: deals = [] } = useQuery({
    queryKey: ['deals-for-meetings'],
    queryFn: async () => {
      const res = await api.get('/deals?limit=50');
      return res.data?.deals || res.data || [];
    },
    enabled: createModalOpen,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-for-meetings'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=50');
      return res.data?.accounts || res.data || [];
    },
    enabled: createModalOpen,
  });

  // Fetch Meetings
  const { data, isLoading } = useQuery<{
    meetings: MeetingItem[];
    stats: { totalMeetings: number; upcomingCount: number; todayCount: number; completedCount: number };
  }>({
    queryKey: ['meetings', activeView, searchQuery, locationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeView !== 'all') params.append('view', activeView);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const res = await api.get(`/meetings?${params.toString()}`);
      return res.data;
    },
  });

  const allMeetings = data?.meetings || [];
  const filteredMeetings = allMeetings.filter((m) => {
    if (locationFilter !== 'all' && m.locationType !== locationFilter) return false;
    return true;
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/meetings', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      showToast('Meeting scheduled successfully', 'success');
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to create meeting', 'error');
    },
  });

  // Update Status / Outcome Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await api.put(`/meetings/${id}`, updates);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      showToast('Meeting updated successfully', 'success');
      if (activeMeeting && activeMeeting._id === updated._id) {
        setActiveMeeting(updated);
      }
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || 'Failed to update meeting', 'error');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/meetings/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      showToast('Meeting deleted successfully', 'success');
      setDetailModalOpen(false);
      setActiveMeeting(null);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      from: new Date().toISOString().slice(0, 16),
      to: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
      allDay: false,
      status: 'scheduled',
      locationType: 'google_meet',
      locationDetails: '',
      meetingUrl: '',
      contactName: '',
      contactEmail: '',
      relatedEntityType: 'none',
      relatedEntityId: '',
      relatedEntityName: '',
      agenda: '',
      outcome: '',
      reminderMinutes: 15,
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Meeting title is required', 'error');
      return;
    }

    createMutation.mutate({
      title: formData.title.trim(),
      from: new Date(formData.from).toISOString(),
      to: new Date(formData.to).toISOString(),
      allDay: formData.allDay,
      status: formData.status,
      locationType: formData.locationType,
      locationDetails: formData.locationDetails,
      meetingUrl:
        formData.meetingUrl.trim() ||
        (formData.locationType === 'google_meet'
          ? `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`
          : ''),
      relatedTo: {
        entityType: formData.relatedEntityType,
        entityId: formData.relatedEntityId || undefined,
        entityName: formData.relatedEntityName || undefined,
      },
      contactName: formData.contactName.trim(),
      contactEmail: formData.contactEmail.trim(),
      agenda: formData.agenda.trim(),
      reminderMinutes: formData.reminderMinutes,
    });
  };

  const toggleSelectMeeting = (id: string) => {
    setSelectedMeetingIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMeetingIds.length === filteredMeetings.length) {
      setSelectedMeetingIds([]);
    } else {
      setSelectedMeetingIds(filteredMeetings.map((m) => m._id));
    }
  };

  // Calendar Helpers
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header (Zoho CRM Meetings Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F07B2A]/10 text-[#F07B2A]">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Meetings</h1>
              {/* View selection dropdown (Zoho style) */}
              <select
                value={activeView}
                onChange={(e) => setActiveView(e.target.value as any)}
                className="text-xs font-semibold bg-muted/20 border border-border rounded-xl px-2.5 py-1 text-foreground focus:outline-none"
              >
                <option value="all">All Meetings</option>
                <option value="upcoming">Upcoming Meetings</option>
                <option value="today">Today's Meetings</option>
                <option value="completed">Completed Meetings</option>
                <option value="my">My Meetings</option>
              </select>
            </div>
            <p className="text-xs text-muted">
              Schedule demos, customer syncs, webinars, and conference events (Zoho CRM style)
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              resetForm();
              setCreateModalOpen(true);
            }}
            className="bg-[#F07B2A] hover:bg-[#d96b20] text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Meeting</span>
          </Button>
        </div>
      </div>

      {/* 2. Toolbar & View Options */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Toggle Left Filter */}
          <button
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              showFilterDrawer
                ? 'bg-[#F07B2A]/10 border-[#F07B2A]/30 text-[#F07B2A]'
                : 'bg-muted/20 border-border text-foreground hover:bg-muted/30'
            }`}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>

          {/* Quick search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Search meetings by title, contact, account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-muted/20 border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-[#F07B2A] w-64"
            />
          </div>
        </div>

        {/* View Switchers (Table vs Calendar) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/20 border border-border rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted hover:text-foreground'
              }`}
              title="Table View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted hover:text-foreground'
              }`}
              title="Calendar Grid View"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Layout: Left Filter Panel + Right Content (Zoho CRM Layout) */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Left Filter Panel (Exact Zoho CRM style from screenshot) */}
        {showFilterDrawer && (
          <div className="w-full lg:w-60 bg-card border border-border rounded-2xl p-4 shadow-2xs shrink-0 space-y-4">
            <div>
              <span className="text-xs font-bold text-foreground block mb-2">
                Filter Meetings by
              </span>
              <div className="relative mb-3">
                <Search className="w-3 h-3 absolute left-2.5 top-2 text-muted" />
                <input
                  type="text"
                  placeholder="Search filters..."
                  className="w-full pl-7 pr-2 py-1 text-[11px] bg-muted/20 border border-border rounded-lg text-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* System Defined Filters */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                System Defined Filters
              </span>
              {[
                { id: 'all', label: 'All Meetings' },
                { id: 'today', label: "Today's Meetings" },
                { id: 'upcoming', label: 'Upcoming Meetings' },
                { id: 'completed', label: 'Completed Meetings' },
                { id: 'my', label: 'My Meetings' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveView(f.id as any)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeView === f.id
                      ? 'bg-[#F07B2A]/10 text-[#F07B2A] font-semibold'
                      : 'text-muted hover:text-foreground hover:bg-muted/20'
                  }`}
                >
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Platform / Location Filter */}
            <div className="pt-2 border-t border-border space-y-1.5">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                Platform / Location
              </span>
              {[
                { id: 'all', label: 'All Platforms' },
                { id: 'google_meet', label: 'Google Meet' },
                { id: 'zoom', label: 'Zoom' },
                { id: 'teams', label: 'MS Teams' },
                { id: 'in_person', label: 'In-Person' },
              ].map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setLocationFilter(loc.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    locationFilter === loc.id
                      ? 'bg-[#F07B2A]/10 text-[#F07B2A] font-semibold'
                      : 'text-muted hover:text-foreground hover:bg-muted/20'
                  }`}
                >
                  <span>{loc.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right Content View: Table or Calendar */}
        <div className="flex-1 w-full min-w-0 bg-card border border-border rounded-2xl shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted">Loading meetings...</div>
          ) : viewMode === 'table' ? (
            /* ================= EXACT ZOHO TABLE FROM SCREENSHOT ================= */
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted font-medium bg-muted/10">
                    <tr>
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            selectedMeetingIds.length > 0 &&
                            selectedMeetingIds.length === filteredMeetings.length
                          }
                          onChange={toggleSelectAll}
                          className="rounded text-[#F07B2A] focus:ring-[#F07B2A]"
                        />
                      </th>
                      <th className="py-3 px-3">Title</th>
                      <th className="py-3 px-3">From</th>
                      <th className="py-3 px-3">To</th>
                      <th className="py-3 px-3">Related To</th>
                      <th className="py-3 px-3">Contact Name</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Host</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {filteredMeetings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-xs text-muted">
                          No meetings found matching the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredMeetings.map((m) => (
                        <tr key={m._id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedMeetingIds.includes(m._id)}
                              onChange={() => toggleSelectMeeting(m._id)}
                              className="rounded text-[#F07B2A] focus:ring-[#F07B2A]"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                onClick={() => {
                                  setActiveMeeting(m);
                                  setDetailModalOpen(true);
                                }}
                                className="font-bold text-foreground hover:text-[#F07B2A] cursor-pointer transition-colors"
                              >
                                {m.title}
                              </span>
                              {m.allDay && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-muted/30 text-muted">
                                  All Day
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-muted whitespace-nowrap">
                            {formatDateTime(m.from, m.allDay)}
                          </td>
                          <td className="py-3 px-3 text-muted whitespace-nowrap">
                            {formatDateTime(m.to, m.allDay)}
                          </td>
                          <td className="py-3 px-3 text-muted">
                            {m.relatedTo && m.relatedTo.entityType !== 'none' ? (
                              <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                <Building2 className="w-3.5 h-3.5 text-muted shrink-0" />
                                <span className="truncate">{m.relatedTo.entityName}</span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted truncate max-w-[130px]">
                            {m.contactName || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                m.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : m.status === 'in_progress'
                                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                  : m.status === 'cancelled'
                                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              }`}
                            >
                              {m.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted truncate max-w-[110px]">
                            {m.host?.name || 'User'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {m.meetingUrl && (
                                <a
                                  href={m.meetingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-[#F07B2A]/10 text-[#F07B2A] hover:bg-[#F07B2A]/20 transition-colors"
                                  title="Join Meeting"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => {
                                  setActiveMeeting(m);
                                  setDetailModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted/20"
                                title="Details & MOM"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete meeting "${m.title}"?`)) {
                                    deleteMutation.mutate(m._id);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-muted hover:text-rose-600 hover:bg-rose-500/10"
                                title="Delete"
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

              {/* Bottom count footer */}
              <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted">
                <span>Total Records: {filteredMeetings.length}</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          ) : (
            /* ================= INTERACTIVE CALENDAR VIEW ================= */
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setCalendarMonth(new Date(year, month - 1, 1))
                    }
                    className="p-1.5 rounded-lg border border-border hover:bg-muted/20 text-muted"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCalendarMonth(new Date())}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border hover:bg-muted/20 text-foreground"
                  >
                    Today
                  </button>
                  <button
                    onClick={() =>
                      setCalendarMonth(new Date(year, month + 1, 1))
                    }
                    className="p-1.5 rounded-lg border border-border hover:bg-muted/20 text-muted"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 border border-border rounded-xl p-2 bg-muted/10 text-xs">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="p-2 font-bold text-center text-muted">
                    {d}
                  </div>
                ))}

                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[85px] p-1.5 opacity-20" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayMeetings = filteredMeetings.filter((m) => {
                    const md = new Date(m.from);
                    return (
                      md.getFullYear() === year &&
                      md.getMonth() === month &&
                      md.getDate() === dayNum
                    );
                  });

                  const isToday =
                    new Date().getFullYear() === year &&
                    new Date().getMonth() === month &&
                    new Date().getDate() === dayNum;

                  return (
                    <div
                      key={`day-${dayNum}`}
                      className={`min-h-[85px] p-1.5 border border-border/50 rounded-lg flex flex-col justify-between transition-colors ${
                        isToday ? 'bg-[#F07B2A]/5 border-[#F07B2A]/30' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[11px] font-bold ${
                            isToday
                              ? 'w-5 h-5 rounded-full bg-[#F07B2A] text-white flex items-center justify-center text-[10px]'
                              : 'text-muted'
                          }`}
                        >
                          {dayNum}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {dayMeetings.slice(0, 2).map((m) => (
                          <div
                            key={m._id}
                            onClick={() => {
                              setActiveMeeting(m);
                              setDetailModalOpen(true);
                            }}
                            className="text-[10px] p-1 rounded bg-[#F07B2A]/15 text-[#F07B2A] font-semibold truncate cursor-pointer hover:opacity-80"
                          >
                            {m.title}
                          </div>
                        ))}
                        {dayMeetings.length > 2 && (
                          <span className="text-[9px] text-muted font-bold block">
                            +{dayMeetings.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= CREATE MEETING MODAL (Zoho CRM style) ================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#F07B2A]">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Create Meeting</h3>
                  <p className="text-xs text-muted">Schedule meeting, demo, or conference</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">
                  Meeting Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Product Demo & Architecture Walkthrough"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                />
              </div>

              {/* Dates & All Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">From</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.from}
                    onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">To</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.to}
                    onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDayCheckbox"
                  checked={formData.allDay}
                  onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                  className="rounded text-[#F07B2A] focus:ring-[#F07B2A]"
                />
                <label htmlFor="allDayCheckbox" className="text-xs text-foreground font-medium cursor-pointer">
                  All day event (e.g. TradeShow / Conference)
                </label>
              </div>

              {/* Platform & Meeting URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Platform</label>
                  <select
                    value={formData.locationType}
                    onChange={(e) =>
                      setFormData({ ...formData, locationType: e.target.value as MeetingLocationType })
                    }
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  >
                    <option value="google_meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                    <option value="teams">Microsoft Teams</option>
                    <option value="in_person">In-Person / Office</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Meeting Link</label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={formData.meetingUrl}
                    onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
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

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Ambani"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="e.g. rajesh@reliance.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                  />
                </div>
              </div>

              {/* Agenda */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Agenda / Overview</label>
                <textarea
                  rows={2}
                  placeholder="Meeting agenda items..."
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#F07B2A] text-white hover:bg-[#d96b20]"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Scheduling...' : 'Save & Schedule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MEETING DETAIL & MOM DRAWER ================= */}
      {detailModalOpen && activeMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F07B2A]/10 text-[#F07B2A] uppercase">
                    {activeMeeting.locationType.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted/30 text-muted capitalize">
                    {activeMeeting.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mt-1">{activeMeeting.title}</h3>
                <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatDateTime(activeMeeting.from, activeMeeting.allDay)} -{' '}
                    {formatDateTime(activeMeeting.to, activeMeeting.allDay)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {activeMeeting.meetingUrl && (
                <a
                  href={activeMeeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-xl bg-[#F07B2A] text-white font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-[#d96b20] transition-colors"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Meeting Online</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {activeMeeting.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateMutation.mutate({
                      id: activeMeeting._id,
                      updates: { status: 'completed' },
                    })
                  }
                  className="text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Mark Completed
                </Button>
              )}
            </div>

            {/* Related Entity */}
            {activeMeeting.relatedTo && activeMeeting.relatedTo.entityType !== 'none' && (
              <div className="p-3 rounded-xl bg-muted/15 border border-border text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted" />
                  <span className="text-muted">Linked Record:</span>
                  <span className="font-bold text-foreground">
                    {activeMeeting.relatedTo.entityName}
                  </span>
                </div>
                {activeMeeting.relatedTo.entityType === 'deal' && (
                  <Link
                    to={`/deals/${activeMeeting.relatedTo.entityId}`}
                    className="text-[#F07B2A] hover:underline font-semibold"
                  >
                    Open Deal →
                  </Link>
                )}
              </div>
            )}

            {/* Agenda */}
            {activeMeeting.agenda && (
              <div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                  Agenda
                </span>
                <p className="text-xs text-muted bg-muted/10 p-3 rounded-xl border border-border">
                  {activeMeeting.agenda}
                </p>
              </div>
            )}

            {/* Minutes of Meeting (MOM) / Outcome */}
            <div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">
                Minutes of Meeting (MOM) / Outcome Notes
              </span>
              <textarea
                rows={3}
                defaultValue={activeMeeting.outcome || ''}
                placeholder="Log discussion points, action items, or agreed terms..."
                onBlur={(e) =>
                  updateMutation.mutate({
                    id: activeMeeting._id,
                    updates: { outcome: e.target.value.trim() },
                  })
                }
                className="w-full px-3 py-2 text-xs bg-muted/20 border border-border rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[#F07B2A]"
              />
              <span className="text-[10px] text-muted">Auto-saves on blur</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <button
                onClick={() => {
                  if (confirm(`Delete meeting "${activeMeeting.title}"?`)) {
                    deleteMutation.mutate(activeMeeting._id);
                  }
                }}
                className="text-xs text-rose-600 hover:underline font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Meeting</span>
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailModalOpen(false)}
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

export default MeetingsPage;
