import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Globe,
  Phone,
  MapPin,
  Users,
  Calendar,
  User as UserIcon,
  Mail,
  Edit,
  Plus,
  Trash2,
  Kanban,
  Contact as ContactIcon,
  LifeBuoy,
  Sparkles,
} from 'lucide-react';
import { Account, Contact, Deal, User } from '../types/index.js';
import { api } from '../api/client.js';
import { fetchTickets } from '../api/tickets.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Drawer } from '../components/ui/Drawer.js';
import { Modal } from '../components/ui/Modal.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import { TimelineTab } from '../components/activity/TimelineTab.js';
import { CustomFieldsSection } from '../components/custom-fields/CustomFieldsSection.js';
import { ComposeEmailModal } from '../components/email/ComposeEmailModal.js';
import { PageTransition } from '../components/motion/PageTransition.js';
import { Reveal } from '../components/motion/Reveal.js';
import { EntityQuotesAndInvoices } from '../components/billing/EntityQuotesAndInvoices.js';
import { HistoryTab } from '../components/common/HistoryTab.js';
import { RecordSummaryModal } from '../components/ai/RecordSummaryModal.js';
import { getAiStatus } from '../api/ai.js';

export const AccountDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'tasks' | 'emails' | 'quotes' | 'invoices' | 'history' | 'tickets'>('timeline');

  // Query linked tickets
  const { data: accountTicketsData } = useQuery({
    queryKey: ['account-tickets', id],
    queryFn: () => fetchTickets({ account: id }),
    enabled: activeTab === 'tickets',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
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

  // Quick Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Edit form state
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    website: '',
    phone: '',
    city: '',
    employees: 1,
    owner: '',
    custom: {} as Record<string, any>,
  });

  // Query Account Detail
  const {
    data: account,
    isLoading,
    isError,
  } = useQuery<Account>({
    queryKey: ['account', id],
    queryFn: async () => {
      const res = await api.get(`/accounts/${id}`);
      return res.data;
    },
    retry: false,
  });

  // Query Users for owner dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: isAdmin || isManager,
  });

  // Query Related Contacts
  const { data: contactsData } = useQuery({
    queryKey: ['account-contacts', id],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=100');
      return res.data;
    },
  });
  const accountContacts: Contact[] = (contactsData?.data || []).filter((c: Contact) => {
    const accId = typeof c.account === 'object' ? (c.account as Account)?._id : c.account;
    return accId === id;
  });

  // Query Related Deals
  const { data: dealsData } = useQuery({
    queryKey: ['account-deals', id],
    queryFn: async () => {
      const res = await api.get('/deals?limit=100');
      return res.data;
    },
  });
  const accountDeals: Deal[] = (dealsData?.data || []).filter((d: Deal) => {
    const accId = typeof d.account === 'object' ? (d.account as any)?._id : d.account;
    return accId === id;
  });

  // Sync form when account loads
  React.useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        industry: account.industry || '',
        website: account.website || '',
        phone: account.phone || '',
        city: account.city || '',
        employees: account.employees || 1,
        owner:
          typeof account.owner === 'object'
            ? (account.owner as User)._id
            : (account.owner as string),
        custom: account.custom || {},
      });
    }
  }, [account]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.patch(`/accounts/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      success('Account updated successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update account');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/accounts/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      success('Account deleted');
      navigate('/accounts');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete account');
    },
  });

  // Add Task Mutation
  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/tasks', {
        title: taskTitle.trim(),
        description: `Follow up with account: ${account?.name} [ID: ${id}]`,
        dueDate: new Date(taskDueDate).toISOString(),
        priority: taskPriority,
        status: 'open',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      success('Task added successfully');
      setTaskModalOpen(false);
      setTaskTitle('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to add task');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-card rounded-card border border-border animate-pulse" />
          <div className="h-96 bg-card rounded-card border border-border animate-pulse lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="p-12 text-center bg-card border border-border rounded-card max-w-md mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
          <Building2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Record not found</h3>
        <p className="text-sm text-muted">
          This account does not exist or you do not have permission to access it.
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Accounts</span>
        </Button>
      </div>
    );
  }

  const owner = typeof account.owner === 'object' ? (account.owner as User) : null;
  const ownerName = owner?.name || 'Unassigned';
  const primaryContactEmail = accountContacts[0]?.email || '';

  return (
    <PageTransition className="space-y-6">
      {/* Top Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/accounts')}
              className="p-2 rounded-xl border border-border bg-card text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {account.name}
                </h1>
                {account.industry && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-muted font-medium">
                    {account.industry}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {account.city || 'India'} • Created {formatDate(account.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {aiAvailable && (
              <Button variant="secondary" size="md" onClick={() => setSummaryModalOpen(true)}>
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Summarise</span>
              </Button>
            )}

            <Button variant="secondary" size="md" onClick={() => setDrawerOpen(true)}>
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Button>

            {canDelete && (
              <Button variant="danger" size="md" onClick={() => setDeleteModalOpen(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: INFO & QUICK ACTIONS ================= */}
        <Reveal delay={0.06} className="lg:col-span-4 space-y-5">
          <div className="space-y-5">
          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Quick Actions
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setEmailModalOpen(true)}
                className="p-2.5 rounded-xl border border-border hover:border-black dark:hover:border-white bg-[#FAFAFA] dark:bg-[#1E1E24] hover:bg-card flex flex-col items-center justify-center text-center gap-1.5 transition-all text-xs font-medium text-foreground group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <span>Email</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('timeline');
                  const composer = document.querySelector('input[placeholder*="summary"]') as HTMLElement;
                  if (composer) composer.focus();
                }}
                className="p-2.5 rounded-xl border border-border hover:border-black dark:hover:border-white bg-[#FAFAFA] dark:bg-[#1E1E24] hover:bg-card flex flex-col items-center justify-center text-center gap-1.5 transition-all text-xs font-medium text-foreground group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <span>Log Call</span>
              </button>

              <button
                onClick={() => setTaskModalOpen(true)}
                className="p-2.5 rounded-xl border border-border hover:border-black dark:hover:border-white bg-[#FAFAFA] dark:bg-[#1E1E24] hover:bg-card flex flex-col items-center justify-center text-center gap-1.5 transition-all text-xs font-medium text-foreground group"
              >
                <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span>Add Task</span>
              </button>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-card border border-border rounded-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2.5">
              Account Overview
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block text-[11px] mb-0.5">Industry</span>
                <span className="font-medium text-foreground">{account.industry || '—'}</span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Website</span>
                {account.website ? (
                  <a
                    href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{account.website}</span>
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Phone</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted" />
                  <span>{account.phone || '—'}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">City</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted" />
                  <span>{account.city || '—'}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Employees</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-muted" />
                  <span>{account.employees || 1} people</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Account Owner</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-muted" />
                  <span>{ownerName}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Created Date</span>
                <span className="text-muted flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  <span>{formatDate(account.createdAt)}</span>
                </span>
              </div>
            </div>

            {/* Custom Fields (Part 5) */}
            <CustomFieldsSection entity="account" values={account.custom || {}} readOnly />
          </div>
        </div>
      </Reveal>

      {/* ================= CENTER COLUMN ================= */}
      <Reveal delay={0.12} className="lg:col-span-5 space-y-4">
        <div className="flex items-center gap-1 border-b border-border pb-1">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'timeline'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'notes'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'tasks'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('emails')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'emails'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Emails
            </button>
            <button
              onClick={() => setActiveTab('quotes')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'quotes'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Quotes
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'invoices'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'history'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === 'tickets'
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Tickets
            </button>
          </div>

          {activeTab === 'timeline' && (
            <TimelineTab entityType="account" entityId={id!} />
          )}

          {activeTab === 'notes' && (
            <TimelineTab entityType="account" entityId={id!} defaultFilter="note" />
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Tasks
                </h4>
                <Button variant="secondary" size="sm" onClick={() => setTaskModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </Button>
              </div>
              <TimelineTab entityType="account" entityId={id!} defaultFilter="task" />
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Email History
                </h4>
                <Button variant="primary" size="sm" onClick={() => setEmailModalOpen(true)}>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Compose Email</span>
                </Button>
              </div>
              <TimelineTab entityType="account" entityId={id!} defaultFilter="email" />
            </div>
          )}

          {activeTab === 'quotes' && (
            <EntityQuotesAndInvoices
              type="quotes"
              filter={{ account: id }}
            />
          )}

          {activeTab === 'invoices' && (
            <EntityQuotesAndInvoices
              type="invoices"
              filter={{ account: id }}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab entityType="account" entityId={id!} />
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Support Tickets ({accountTicketsData?.tickets?.length || 0})
                </h4>
                <Link to="/tickets">
                  <Button variant="secondary" size="sm">
                    <LifeBuoy className="w-3.5 h-3.5" />
                    <span>All Tickets</span>
                  </Button>
                </Link>
              </div>

              {(!accountTicketsData?.tickets || accountTicketsData.tickets.length === 0) ? (
                <div className="p-8 text-center border border-border rounded-2xl bg-card">
                  <p className="text-xs text-muted-foreground">No support tickets found for this account.</p>
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden">
                  {accountTicketsData.tickets.map((t: any) => (
                    <div
                      key={t._id}
                      onClick={() => navigate(`/tickets/${t._id}`)}
                      className="p-3.5 hover:bg-muted/40 cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{t.number}</span>
                          <span className="font-medium text-foreground">{t.subject}</span>
                        </div>
                        <span className="text-muted-foreground text-[11px] block mt-0.5">
                          {new Date(t.createdAt).toLocaleDateString()} &bull; Channel: {t.channel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="capitalize px-2 py-0.5 rounded-md bg-muted text-foreground text-[10px] font-semibold">
                          {t.priority}
                        </span>
                        <span className="capitalize px-2 py-0.5 rounded-md bg-muted text-foreground text-[10px] font-semibold">
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Reveal>

        {/* ================= RIGHT COLUMN: RELATED RECORDS ================= */}
        <Reveal delay={0.18} className="lg:col-span-3 space-y-4">
          {/* Related Contacts */}
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <ContactIcon className="w-3.5 h-3.5" />
                <span>Contacts ({accountContacts.length})</span>
              </h3>
              <button
                onClick={() => navigate('/contacts')}
                className="text-[11px] text-brand hover:underline"
              >
                View all
              </button>
            </div>

            {accountContacts.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No contacts added yet.</p>
            ) : (
              <div className="space-y-2">
                {accountContacts.map((contact) => (
                  <div
                    key={contact._id}
                    onClick={() => navigate(`/contacts/${contact._id}`)}
                    className="p-2.5 rounded-xl border border-border hover:border-neutral-400 bg-card cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        {contact.firstName} {contact.lastName}
                      </span>
                      <span className="text-[10px] text-muted">{contact.jobTitle}</span>
                    </div>
                    <p className="text-[11px] text-muted truncate mt-0.5">{contact.email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related Deals */}
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Kanban className="w-3.5 h-3.5" />
                <span>Deals ({accountDeals.length})</span>
              </h3>
              <button
                onClick={() => navigate('/deals')}
                className="text-[11px] text-brand hover:underline"
              >
                Kanban
              </button>
            </div>

            {accountDeals.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No deals found for this account.</p>
            ) : (
              <div className="space-y-2">
                {accountDeals.map((deal) => (
                  <div
                    key={deal._id}
                    onClick={() => navigate(`/deals/${deal._id}`)}
                    className="p-2.5 rounded-xl border border-border hover:border-neutral-400 bg-card cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground line-clamp-1">
                        {deal.title}
                      </span>
                      <Badge size="sm" variant={getStatusBadgeVariant(deal.stage)}>
                        {deal.stage}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="font-semibold text-foreground">{formatINR(deal.amount)}</span>
                      <span className="text-muted">{formatDate(deal.expectedClose)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* Edit Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Edit Account"
        subtitle={`ID: ${account._id}`}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => updateMutation.mutate(formData)}
              isLoading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(formData);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Industry *</label>
              <input
                type="text"
                required
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Employees</label>
              <input
                type="number"
                min="1"
                value={formData.employees}
                onChange={(e) => setFormData({ ...formData, employees: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Website</label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
            />
          </div>

          {(isAdmin || isManager) && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Owner</label>
              <select
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <CustomFieldsSection
            entity="account"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Add Task Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Add Task for Account"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" onClick={() => setTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => addTaskMutation.mutate()}
              isLoading={addTaskMutation.isPending}
              disabled={!taskTitle.trim()}
            >
              Add Task
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Schedule quarterly business review"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Account"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => deleteMutation.mutate()}
              isLoading={deleteMutation.isPending}
            >
              Delete Account
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground">
          Are you sure you want to delete <span className="font-semibold">{account.name}</span>?
          This action cannot be undone.
        </p>
      </Modal>

      {/* Email Compose Modal */}
      <ComposeEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        entityType="account"
        entityId={id!}
        recipientEmail={primaryContactEmail}
        contextData={{
          account: {
            name: account.name,
            industry: account.industry,
          },
        }}
      />

      {/* Record Summary Modal */}
      <RecordSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        entityType="account"
        entityId={id!}
        recordName={account.name}
      />
    </PageTransition>
  );
};
