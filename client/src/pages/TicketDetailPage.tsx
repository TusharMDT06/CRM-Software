import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  LifeBuoy,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Send,
  User,
  Building,
  Kanban,
  Trash2,
  PauseCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  fetchTicket,
  fetchTicketMessages,
  createTicketMessage,
  updateTicket,
  deleteTicket,
  fetchCannedResponses,
} from '../api/tickets.js';
import { api } from '../api/client.js';
import { TicketPriority, TicketStatus } from '../types/index.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Reveal } from '../components/motion/Motion.js';
import { RecordSummaryModal } from '../components/ai/RecordSummaryModal.js';
import { getAiStatus } from '../api/ai.js';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  // Composer State
  const [composerType, setComposerType] = useState<'public_reply' | 'internal_note'>('public_reply');
  const [messageBody, setMessageBody] = useState('');
  const [nextStatus, setNextStatus] = useState<string>('');
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    getAiStatus()
      .then((status) => {
        if (status.isConfigured && status.aiEnabled) {
          setAiAvailable(true);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Ticket Data
  const { data: ticket, isLoading: isTicketLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  // Fetch Messages
  const { data: messages, isLoading: isMessagesLoading } = useQuery({
    queryKey: ['ticket-messages', id],
    queryFn: () => fetchTicketMessages(id!),
    enabled: !!id,
  });

  // Fetch Available Users for Assignee
  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
  });

  // Fetch Canned Responses for Quick Insertion
  const { data: cannedResponses } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: fetchCannedResponses,
  });

  // Update Ticket Mutation
  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateTicket(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      success('Ticket updated successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update ticket');
    },
  });

  // Delete Ticket Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteTicket(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      success('Ticket deleted successfully');
      navigate('/tickets');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete ticket');
    },
  });

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: (payload: { type: 'public_reply' | 'internal_note'; body: string }) =>
      createTicketMessage(id!, payload),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });

      // If user selected a status change alongside the reply
      if (nextStatus && nextStatus !== ticket?.status) {
        await updateTicket(id!, { status: nextStatus as any });
        queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      }

      success(composerType === 'public_reply' ? 'Reply sent to customer' : 'Internal note saved');
      setMessageBody('');
      setNextStatus('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to send message');
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) {
      error('Message body cannot be empty');
      return;
    }
    sendMessageMutation.mutate({
      type: composerType,
      body: messageBody.trim(),
    });
  };

  const handleInsertCanned = (body: string) => {
    setMessageBody((prev) => (prev ? `${prev}\n\n${body}` : body));
    success('Inserted snippet');
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

  if (isTicketLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto py-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 space-y-4">
        <LifeBuoy className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Ticket Not Found</h2>
        <Button variant="outline" size="sm" onClick={() => navigate('/tickets')}>
          Back to Tickets
        </Button>
      </div>
    );
  }

  const isPending = ticket.status === 'pending';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Bar */}
      <Reveal>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/tickets')}
              className="p-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                  {ticket.number}
                </span>
                {renderStatusBadge(ticket.status)}
                {renderPriorityBadge(ticket.priority)}
                {isPending && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <PauseCircle className="w-3.5 h-3.5" /> SLA Paused
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground mt-1">
                {ticket.subject}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {aiAvailable && (
              <Button variant="secondary" size="sm" onClick={() => setSummaryModalOpen(true)}>
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Summarise</span>
              </Button>
            )}

            {/* Quick Status Dropdown */}
            <select
              value={ticket.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value })}
              className="text-xs bg-muted font-medium border border-border rounded-xl px-3 py-2 text-foreground outline-none cursor-pointer hover:bg-muted/80 transition-colors"
            >
              <option value="new">Mark as New</option>
              <option value="open">Mark as Open</option>
              <option value="pending">Mark as Pending (Pause SLA)</option>
              <option value="resolved">Mark as Resolved</option>
              <option value="closed">Mark as Closed</option>
            </select>

            {(isAdmin || isManager) && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete ticket ${ticket.number}?`)) {
                    deleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      {/* Main Grid: Left Conversation Stream + Right Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Messages & Composer (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Initial Customer Ticket Description */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {(ticket.contact as any)?.name || 'Customer'}
                </span>
                <span>opened this ticket</span>
              </div>
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            </div>

            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>
          </div>

          {/* Conversation History Stream */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Conversation History ({messages?.length || 0})
            </h3>

            {isMessagesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : messages && messages.length > 0 ? (
              messages.map((msg) => {
                const isInternal = msg.type === 'internal_note';
                const isAgent = !!msg.author;

                return (
                  <div
                    key={msg._id}
                    className={`rounded-2xl border p-4.5 transition-all shadow-sm ${
                      isInternal
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40'
                        : isAgent
                        ? 'bg-card border-border'
                        : 'bg-muted/40 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2.5 pb-2 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        {isInternal ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                            <Lock className="w-3.5 h-3.5" />
                            Internal Note
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            {isAgent
                              ? (msg.author as any)?.name
                              : `${(ticket.contact as any)?.firstName || ''} ${(ticket.contact as any)?.lastName || ''}`.trim() ||
                                (ticket.contact as any)?.name ||
                                'Customer'}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {isAgent ? `(${(msg.author as any)?.role || 'Agent'})` : '(Customer)'}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {msg.body}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground italic px-1 py-2">
                No replies or notes recorded yet.
              </p>
            )}
          </div>

          {/* Reply / Internal Note Composer */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            {/* Mode Switch Tabs & Canned Picker */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setComposerType('public_reply')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    composerType === 'public_reply'
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Public Reply
                </button>
                <button
                  type="button"
                  onClick={() => setComposerType('internal_note')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all ${
                    composerType === 'internal_note'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  Internal Note
                </button>
              </div>

              {/* Canned Responses dropdown */}
              {cannedResponses && cannedResponses.length > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Snippets:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleInsertCanned(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="text-xs bg-muted border border-border rounded-lg px-2 py-1 outline-none text-foreground cursor-pointer"
                  >
                    <option value="" disabled>
                      Insert canned reply...
                    </option>
                    {cannedResponses.map((cr) => (
                      <option key={cr._id} value={cr.body}>
                        {cr.shortcut ? `${cr.shortcut} - ` : ''}
                        {cr.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Composer Input Area */}
            <form onSubmit={handleSendMessage} className="space-y-3">
              <textarea
                rows={4}
                required
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={
                  composerType === 'public_reply'
                    ? 'Write a reply to the customer (will be emailed to them)...'
                    : 'Add a private note visible only to your internal team...'
                }
                className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-xl focus:ring-1 focus:ring-foreground outline-none resize-none"
              />

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">After sending:</span>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    className="text-xs bg-muted border border-border/80 rounded-lg px-2 py-1 text-foreground outline-none cursor-pointer"
                  >
                    <option value="">Keep current status</option>
                    <option value="pending">Mark as Pending (Pause SLA)</option>
                    <option value="resolved">Mark as Resolved</option>
                    <option value="open">Keep as Open</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={sendMessageMutation.isPending}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {composerType === 'public_reply' ? 'Send Reply' : 'Save Internal Note'}
                  </span>
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: SLA Meters & Details Sidebar (1 Col) */}
        <div className="space-y-5">
          {/* SLA Performance Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>SLA Performance</span>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </h3>

            {/* First Response Meter */}
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">First Response SLA</span>
                {ticket.firstResponseAt ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Responded
                  </span>
                ) : ticket.slaBreached?.firstResponse ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Breached
                  </span>
                ) : (
                  <span className="text-amber-600 font-medium">Pending</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Due:{' '}
                {ticket.slaFirstResponseDue
                  ? new Date(ticket.slaFirstResponseDue).toLocaleString()
                  : 'N/A'}
              </p>
            </div>

            {/* Resolution Meter */}
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Resolution SLA</span>
                {ticket.resolvedAt ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                  </span>
                ) : ticket.slaBreached?.resolution ? (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Breached
                  </span>
                ) : isPending ? (
                  <span className="text-amber-600 font-semibold flex items-center gap-1">
                    <PauseCircle className="w-3.5 h-3.5" /> Clock Paused
                  </span>
                ) : (
                  <span className="text-muted-foreground font-medium">In Progress</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Due:{' '}
                {ticket.slaResolutionDue
                  ? new Date(ticket.slaResolutionDue).toLocaleString()
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Ticket Properties Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold uppercase tracking-wider text-muted-foreground">
              Properties
            </h3>

            {/* Assignee */}
            <div>
              <label className="text-muted-foreground block mb-1">Assignee</label>
              <select
                value={ticket.assignee ? (ticket.assignee as any)._id : ''}
                onChange={(e) => updateMutation.mutate({ assignee: e.target.value || null })}
                className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-foreground outline-none cursor-pointer"
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

            {/* Priority */}
            <div>
              <label className="text-muted-foreground block mb-1">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => updateMutation.mutate({ priority: e.target.value as any })}
                className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 text-foreground outline-none cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Channel */}
            <div>
              <label className="text-muted-foreground block mb-1">Channel</label>
              <span className="font-medium capitalize text-foreground">{ticket.channel}</span>
            </div>

            {/* Public Portal Token */}
            {ticket.publicToken && (
              <div>
                <label className="text-muted-foreground block mb-1">Customer Tracking Link</label>
                <Link
                  to={`/support/status/${ticket.publicToken}`}
                  target="_blank"
                  className="text-primary hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <span>Open Tracking Page</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Contact Card */}
          {ticket.contact && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 text-xs">
              <h3 className="font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Customer Contact</span>
                <User className="w-3.5 h-3.5" />
              </h3>
              <p className="font-semibold text-sm text-foreground">
                {`${(ticket.contact as any).firstName || ''} ${(ticket.contact as any).lastName || ''}`.trim() ||
                  (ticket.contact as any).name ||
                  'Customer'}
              </p>
              {(ticket.contact as any).email && (
                <p className="text-muted-foreground">{(ticket.contact as any).email}</p>
              )}
              {(ticket.contact as any).phone && (
                <p className="text-muted-foreground">{(ticket.contact as any).phone}</p>
              )}
              <div className="pt-2">
                <Link
                  to={`/contacts/${(ticket.contact as any)._id}`}
                  className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                >
                  View Contact Profile &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Account Card */}
          {ticket.account && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 text-xs">
              <h3 className="font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Organization</span>
                <Building className="w-3.5 h-3.5" />
              </h3>
              <p className="font-semibold text-sm text-foreground">
                {(ticket.account as any).name}
              </p>
              <div className="pt-2">
                <Link
                  to={`/accounts/${(ticket.account as any)._id}`}
                  className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                >
                  View Account Profile &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Linked Deal Card */}
          {ticket.deal && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2 text-xs">
              <h3 className="font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Linked Deal</span>
                <Kanban className="w-3.5 h-3.5" />
              </h3>
              <p className="font-semibold text-sm text-foreground">
                {(ticket.deal as any).title}
              </p>
              <p className="text-muted-foreground capitalize">
                Stage: {(ticket.deal as any).stage}
              </p>
              <div className="pt-2">
                <Link
                  to={`/deals/${(ticket.deal as any)._id}`}
                  className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                >
                  View Deal &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record Summary Modal */}
      <RecordSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        entityType="ticket"
        entityId={id!}
        recordName={ticket.subject}
      />
    </div>
  );
};
