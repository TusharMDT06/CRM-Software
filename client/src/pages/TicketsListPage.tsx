import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy,
  Plus,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings,
  MessageSquare,
  Copy,
  User,
  Check,
  Building,
} from 'lucide-react';
import {
  fetchTickets,
  createTicket,
  fetchSlaPolicy,
  fetchCannedResponses,
  createCannedResponse,
  deleteCannedResponse,
} from '../api/tickets.js';
import { Ticket, TicketPriority, TicketStatus } from '../types/index.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { Drawer } from '../components/ui/Drawer.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Reveal } from '../components/motion/Motion.js';
import { api } from '../api/client.js';

export const TicketsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { isAdmin, isManager, tenant } = useAuth();
  const queryClient = useQueryClient();

  // Filter States
  const [activeView, setActiveView] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals & Drawers
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isSlaPolicyOpen, setIsSlaPolicyOpen] = useState(false);
  const [isCannedResponsesOpen, setIsCannedResponsesOpen] = useState(false);

  // New Ticket Form State
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');
  const [newChannel, setNewChannel] = useState<'manual' | 'email' | 'portal' | 'whatsapp'>('manual');
  const [newContactId, setNewContactId] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newTags, setNewTags] = useState('');

  // Fetch Available Users for Assignee
  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
  });

  // Fetch Contacts for Picker
  const { data: contactsData = [] } = useQuery<any[]>({
    queryKey: ['contacts-dropdown'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=100');
      return Array.isArray(res.data)
        ? res.data
        : (res.data?.data || res.data?.contacts || []);
    },
  });

  // Fetch Accounts for Picker
  const { data: accountsData = [] } = useQuery<any[]>({
    queryKey: ['accounts-dropdown'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=100');
      return Array.isArray(res.data)
        ? res.data
        : (res.data?.data || res.data?.accounts || []);
    },
  });

  // Fetch SLA Policy
  const { data: slaPolicyData } = useQuery({
    queryKey: ['sla-policy'],
    queryFn: fetchSlaPolicy,
    enabled: isSlaPolicyOpen,
  });

  // Fetch Canned Responses
  const { data: cannedResponsesData } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: fetchCannedResponses,
    enabled: isCannedResponsesOpen,
  });

  // Main Tickets Query
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', activeView, searchTerm, statusFilter, priorityFilter],
    queryFn: () =>
      fetchTickets({
        view: activeView === 'all' ? undefined : activeView,
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        q: searchTerm || undefined,
      }),
  });

  // Create Ticket Mutation
  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      success(`Ticket ${created.number} created successfully`);
      setIsNewTicketOpen(false);
      resetNewTicketForm();
      navigate(`/tickets/${created._id}`);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to create ticket');
    },
  });

  // Canned Response Creation
  const [cannedShortcut, setCannedShortcut] = useState('');
  const [cannedTitle, setCannedTitle] = useState('');
  const [cannedBody, setCannedBody] = useState('');
  const cannedCategory = 'General';

  const createCannedMutation = useMutation({
    mutationFn: createCannedResponse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      success('Canned response added');
      setCannedShortcut('');
      setCannedTitle('');
      setCannedBody('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to add response');
    },
  });

  const deleteCannedMutation = useMutation({
    mutationFn: deleteCannedResponse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      success('Canned response removed');
    },
  });

  const resetNewTicketForm = () => {
    setNewSubject('');
    setNewDescription('');
    setNewPriority('medium');
    setNewChannel('manual');
    setNewContactId('');
    setNewAccountId('');
    setNewAssigneeId('');
    setNewTags('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) {
      error('Please provide a subject');
      return;
    }
    const tagsArray = newTags
      ? newTags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    createMutation.mutate({
      subject: newSubject.trim(),
      description: newDescription.trim() || newSubject.trim(),
      priority: newPriority,
      channel: newChannel,
      contact: newContactId || null,
      account: newAccountId || null,
      assignee: newAssigneeId || null,
      tags: tagsArray,
    } as any);
  };

  const handleCopyPortalLink = () => {
    const slug = tenant?.slug || 'flowdesk';
    const link = `${window.location.origin}/support/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    success('Public support portal link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Helper for status badge
  const renderStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'new':
        return <Badge variant="info">New</Badge>;
      case 'open':
        return <Badge variant="success">Open</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'resolved':
        return <Badge variant="purple">Resolved</Badge>;
      case 'closed':
        return <Badge variant="neutral">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Helper for priority badge
  const renderPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="danger">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'medium':
        return <Badge variant="info">Medium</Badge>;
      case 'low':
        return <Badge variant="neutral">Low</Badge>;
      default:
        return <Badge variant="neutral">{priority}</Badge>;
    }
  };

  // Helper for SLA status indicator
  const renderSlaIndicator = (ticket: Ticket) => {
    const now = new Date();
    const isBreached = ticket.slaBreached?.firstResponse || ticket.slaBreached?.resolution;

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {isBreached ? 'Resolved (SLA Breached)' : 'Resolved (On Time)'}
        </span>
      );
    }

    if (isBreached) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" />
          Breached
        </span>
      );
    }

    // Check first response due
    if (!ticket.firstResponseAt && ticket.slaFirstResponseDue) {
      const diffMs = new Date(ticket.slaFirstResponseDue).getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const isUrgent = diffHours <= 2;

      return (
        <span
          className={`flex items-center gap-1 text-xs ${
            isUrgent ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Response: {diffHours > 0 ? `${diffHours}h left` : 'Overdue'}
        </span>
      );
    }

    // Check resolution due
    if (ticket.slaResolutionDue) {
      const diffMs = new Date(ticket.slaResolutionDue).getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const isUrgent = diffHours <= 4;

      return (
        <span
          className={`flex items-center gap-1 text-xs ${
            isUrgent ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Resolution: {diffHours > 0 ? `${diffHours}h left` : 'Overdue'}
        </span>
      );
    }

    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const quickViews = [
    { id: 'all', label: 'All Tickets' },
    { id: 'my_open', label: 'Assigned to Me' },
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'breaching_soon', label: 'Breaching Soon (<4h)' },
    { id: 'breached', label: 'Breached' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <Reveal>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold shadow-sm">
                <LifeBuoy className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Support Tickets
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage customer inquiries, SLA targets, and support interactions
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPortalLink}
              title="Copy link to public customer support portal"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Portal Link Copied' : 'Customer Portal Link'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCannedResponsesOpen(true)}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Canned Replies</span>
            </Button>

            {(isAdmin || isManager) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSlaPolicyOpen(true)}
              >
                <Settings className="w-4 h-4" />
                <span>SLA Policy</span>
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewTicketOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>New Ticket</span>
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Quick View Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border/60">
        {quickViews.map((qv) => {
          const isActive = activeView === qv.id;
          return (
            <button
              key={qv.id}
              onClick={() => setActiveView(qv.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {qv.label}
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ticket number, subject, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-1.5 text-sm bg-transparent rounded-xl border border-transparent focus:border-border focus:bg-background outline-none transition-all placeholder:text-muted"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-muted/60 border border-border/60 rounded-xl px-2.5 py-1.5 text-foreground outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs bg-muted/60 border border-border/60 rounded-xl px-2.5 py-1.5 text-foreground outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tickets List View */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : !data?.tickets || data.tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets found"
          description={
            searchTerm || activeView !== 'all' || statusFilter !== 'all'
              ? 'Try modifying your search or clearing quick view filters.'
              : 'Support tickets submitted via the portal, email, or manual creation will appear here.'
          }
          actionLabel="Create Ticket"
          onAction={() => setIsNewTicketOpen(true)}
        />
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border/60">
          {data.tickets.map((ticket) => (
            <div
              key={ticket._id}
              onClick={() => navigate(`/tickets/${ticket._id}`)}
              className="p-4 sm:px-6 hover:bg-muted/40 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              {/* Left Details */}
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="mt-0.5">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/70 group-hover:border-foreground/30 transition-colors">
                    {ticket.number}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {ticket.subject}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {ticket.contact && (
                      <span className="flex items-center gap-1 font-medium text-foreground/80">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        {`${(ticket.contact as any).firstName || ''} ${(ticket.contact as any).lastName || ''}`.trim() ||
                          (ticket.contact as any).name ||
                          (ticket.contact as any).email}
                      </span>
                    )}
                    {ticket.account && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-muted-foreground" />
                        {(ticket.account as any).name}
                      </span>
                    )}
                    <span>Channel: {ticket.channel}</span>
                    <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Right Status, Priority & SLA */}
              <div className="flex items-center gap-3 shrink-0 sm:justify-end">
                {renderSlaIndicator(ticket)}
                {renderPriorityBadge(ticket.priority)}
                {renderStatusBadge(ticket.status)}

                {/* Assignee Avatar */}
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground border border-border ml-1">
                  {ticket.assignee ? (
                    (ticket.assignee as any).name?.slice(0, 2).toUpperCase() || 'AG'
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-normal">None</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer: Create New Ticket */}
      <Drawer
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        title="Create Support Ticket"
        width="max-w-lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 p-1">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Subject *
            </label>
            <input
              type="text"
              required
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g. Cannot connect bank account or export invoices"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Channel
              </label>
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none"
              >
                <option value="manual">Manual Entry</option>
                <option value="email">Email</option>
                <option value="portal">Support Portal</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Contact
            </label>
            <select
              value={newContactId}
              onChange={(e) => setNewContactId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none"
            >
              <option value="">Select contact (optional)...</option>
              {Array.isArray(contactsData) &&
                contactsData.map((c: any) => {
                  const fullName =
                    `${c.firstName || ''} ${c.lastName || ''}`.trim() ||
                    c.name ||
                    c.email;
                  return (
                    <option key={c._id} value={c._id}>
                      {fullName} {c.email ? `(${c.email})` : ''}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Account / Organization
            </label>
            <select
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none"
            >
              <option value="">Select company account (optional)...</option>
              {Array.isArray(accountsData) &&
                accountsData.map((a: any) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Assignee
            </label>
            <select
              value={newAssigneeId}
              onChange={(e) => setNewAssigneeId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none"
            >
              <option value="">Unassigned</option>
              {Array.isArray(usersData) &&
                usersData.map((u: any) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Description / Initial Note
            </label>
            <textarea
              rows={4}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Enter full details of customer issue, error trace, or request..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="e.g. billing, bug, onboarding"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewTicketOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createMutation.isPending}
            >
              Create Ticket
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Modal: SLA Policy Settings */}
      <Modal
        isOpen={isSlaPolicyOpen}
        onClose={() => setIsSlaPolicyOpen(false)}
        title="SLA Policy Configuration"
        size="lg"
      >
        <div className="space-y-5 text-sm">
          <p className="text-xs text-muted-foreground">
            Configure response and resolution targets per ticket priority. SLA countdown clocks run against these targets for compliance calculation and breach warnings.
          </p>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Response & Resolution Targets (Hours)
            </h4>

            {slaPolicyData && (
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-muted/20">
                {(['urgent', 'high', 'medium', 'low'] as TicketPriority[]).map((p) => {
                  const target = slaPolicyData.priorities[p];
                  return (
                    <div key={p} className="p-3 flex items-center justify-between gap-4">
                      <div className="w-24">
                        {renderPriorityBadge(p)}
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">First Response: </span>
                          <span className="font-semibold">{target?.firstResponseHours || 8} hrs</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Resolution: </span>
                          <span className="font-semibold">{target?.resolutionHours || 24} hrs</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
            <strong>Operating Mode:</strong> Clocks pause automatically whenever ticket status is marked as <code>pending</code> (e.g. waiting for customer reply) and resume when active.
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSlaPolicyOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Canned Responses Manager */}
      <Modal
        isOpen={isCannedResponsesOpen}
        onClose={() => setIsCannedResponsesOpen(false)}
        title="Canned Response Snippets"
        size="xl"
      >
        <div className="space-y-5 text-sm">
          <p className="text-xs text-muted-foreground">
            Save pre-written replies for common customer questions. Insert them quickly into replies using the snippet picker.
          </p>

          {/* Add snippet form */}
          <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Add New Snippet
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Shortcut (e.g. /greeting)"
                value={cannedShortcut}
                onChange={(e) => setCannedShortcut(e.target.value)}
                className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg outline-none"
              />
              <input
                type="text"
                placeholder="Title (e.g. Welcome Greeting)"
                value={cannedTitle}
                onChange={(e) => setCannedTitle(e.target.value)}
                className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg outline-none"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Full snippet body..."
              value={cannedBody}
              onChange={(e) => setCannedBody(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-lg outline-none resize-none"
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                isLoading={createCannedMutation.isPending}
                onClick={() => {
                  if (!cannedTitle.trim() || !cannedBody.trim()) {
                    error('Please provide title and body');
                    return;
                  }
                  createCannedMutation.mutate({
                    shortcut: cannedShortcut.trim() || undefined,
                    title: cannedTitle.trim(),
                    body: cannedBody.trim(),
                    category: cannedCategory,
                    shared: true,
                  });
                }}
              >
                Save Snippet
              </Button>
            </div>
          </div>

          {/* Existing snippets list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {cannedResponsesData?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No canned responses saved yet.
              </p>
            ) : (
              cannedResponsesData?.map((item) => (
                <div
                  key={item._id}
                  className="p-3 border border-border rounded-xl flex items-start justify-between gap-3 bg-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">{item.title}</span>
                      {item.shortcut && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.body}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteCannedMutation.mutate(item._id)}
                    className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCannedResponsesOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
