import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Kanban,
  Building2,
  Contact as ContactIcon,
  Calendar,
  User as UserIcon,
  Mail,
  Phone,
  Edit,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Deal, Account, Contact, Task, User, DealStage } from '../types/index.js';
import { api } from '../api/client.js';
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
import { explainScoreWithAi, getAiStatus } from '../api/ai.js';

export const DealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'tasks' | 'emails' | 'quotes' | 'invoices' | 'history'>('timeline');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [explainingRisk, setExplainingRisk] = useState(false);
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

  const handleExplainRisk = async () => {
    if (!id || explainingRisk) return;
    setExplainingRisk(true);
    try {
      await explainScoreWithAi('deal', id);
      success('AI risk explanation generated for deal');
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
    } catch (err: any) {
      error(err.message || 'Failed to generate explanation');
    } finally {
      setExplainingRisk(false);
    }
  };

  // Quick Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Edit form state
  const [formData, setFormData] = useState({
    title: '',
    amount: 0,
    stage: 'qualified' as DealStage,
    expectedClose: '',
    account: '',
    contact: '',
    owner: '',
    custom: {} as Record<string, any>,
  });

  // Query Deal Detail
  const {
    data: deal,
    isLoading,
    isError,
  } = useQuery<Deal>({
    queryKey: ['deal', id],
    queryFn: async () => {
      const res = await api.get(`/deals/${id}`);
      return res.data;
    },
    retry: false,
  });

  // Query Accounts
  const { data: accountsData } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=100');
      return res.data;
    },
  });
  const accounts: Account[] = accountsData?.data || [];

  // Query Contacts
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=100');
      return res.data;
    },
  });
  const contacts: Contact[] = contactsData?.data || [];

  // Query Users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: isAdmin || isManager,
  });

  // Query Tasks related to this Deal
  const { data: tasksData } = useQuery({
    queryKey: ['deal-tasks', id],
    queryFn: async () => {
      const res = await api.get('/tasks?limit=50');
      return res.data;
    },
  });
  const dealTasks: Task[] = (tasksData?.data || []).filter((t: Task) => {
    const dId = typeof t.deal === 'object' ? t.deal?._id : t.deal;
    return dId === id;
  });

  // Sync form when deal loads
  React.useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        amount: deal.amount,
        stage: deal.stage,
        expectedClose: deal.expectedClose ? deal.expectedClose.slice(0, 10) : '',
        account:
          typeof deal.account === 'object'
            ? (deal.account as any)._id
            : (deal.account as string),
        contact:
          typeof deal.contact === 'object'
            ? (deal.contact as any)._id
            : (deal.contact as string),
        owner:
          typeof deal.owner === 'object'
            ? (deal.owner as User)._id
            : (deal.owner as string),
        custom: deal.custom || {},
      });
    }
  }, [deal]);

  // Stage change mutation (creates system activity server-side)
  const changeStageMutation = useMutation({
    mutationFn: async (newStage: DealStage) => {
      const res = await api.patch(`/deals/${id}`, { stage: newStage });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['activities', 'deal', id] });
      success('Deal stage updated');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update deal stage');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.patch(`/deals/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      success('Deal updated successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update deal');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/deals/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      success('Deal deleted');
      navigate('/deals');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete deal');
    },
  });

  // Add Task Mutation
  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/tasks', {
        title: taskTitle.trim(),
        description: `Follow up on deal: ${deal?.title}`,
        dueDate: new Date(taskDueDate).toISOString(),
        priority: taskPriority,
        deal: id,
        status: 'open',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-tasks', id] });
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

  if (isError || !deal) {
    return (
      <div className="p-12 text-center bg-card border border-border rounded-card max-w-md mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
          <Kanban className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Record not found</h3>
        <p className="text-sm text-muted">
          This deal does not exist or you do not have permission to access it.
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/deals')}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Deals</span>
        </Button>
      </div>
    );
  }

  const accountObj = typeof deal.account === 'object' ? (deal.account as any) : null;
  const contactObj = typeof deal.contact === 'object' ? (deal.contact as any) : null;
  const owner = typeof deal.owner === 'object' ? (deal.owner as User) : null;
  const ownerName = owner?.name || 'Unassigned';

  const stages: DealStage[] = ['qualified', 'proposal', 'negotiation', 'won', 'lost'];

  return (
    <PageTransition className="space-y-6">
      {/* Top Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/deals')}
              className="p-2 rounded-xl border border-border bg-card text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {deal.title}
                </h1>
                <Badge size="md" variant={getStatusBadgeVariant(deal.stage)}>
                  {deal.stage}
                </Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {formatINR(deal.amount)} • Expected Close {formatDate(deal.expectedClose)}
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

        {/* Stage Progress Ribbon */}
        <div className="p-3 mt-4 bg-card rounded-card border border-border shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider pl-1 shrink-0">
            Pipeline:
          </span>
          <div className="flex items-center gap-1.5 flex-1 min-w-[500px]">
            {stages.map((stg) => {
              const isCurrent = deal.stage === stg;
              return (
                <button
                  key={stg}
                  type="button"
                  onClick={() => changeStageMutation.mutate(stg)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium capitalize text-center transition-all ${
                    isCurrent
                      ? 'bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs'
                      : 'bg-[#F4F4F5] dark:bg-[#202025] text-muted hover:text-foreground hover:bg-[#ECECED] dark:hover:bg-[#28282F]'
                  }`}
                >
                  {stg}
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN ================= */}
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

          {/* Deal Risk Card */}
          {deal.aiRisk && (
            <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Deal Risk
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                    deal.aiRisk.level === 'high'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                      : deal.aiRisk.level === 'medium'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  }`}
                >
                  {deal.aiRisk.level} Risk • {deal.aiRisk.score}/100
                </span>
              </div>

              {deal.aiRisk.reasons && deal.aiRisk.reasons.length > 0 && (
                <ul className="text-xs space-y-1 text-muted">
                  {deal.aiRisk.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}

              {deal.aiRisk.explanation && (
                <div className="text-xs bg-muted/20 border border-border/50 rounded-lg p-2.5 text-foreground leading-relaxed">
                  <div className="text-[10px] uppercase font-semibold text-muted mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" /> AI Analysis & Next Step
                  </div>
                  {deal.aiRisk.explanation}
                </div>
              )}

              {aiAvailable && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExplainRisk}
                  isLoading={explainingRisk}
                  className="w-full text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{deal.aiRisk.explanation ? 'Refresh AI Analysis' : 'Explain Risk with AI'}</span>
                </Button>
              )}
            </div>
          )}

          {/* Details Card */}
          <div className="bg-card border border-border rounded-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2.5">
              Deal Information
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block text-[11px] mb-0.5">Deal Value</span>
                <span className="font-bold text-foreground text-base">
                  {formatINR(deal.amount)}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Stage</span>
                <Badge size="sm" variant={getStatusBadgeVariant(deal.stage)}>
                  {deal.stage}
                </Badge>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Expected Close Date</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  <span>{formatDate(deal.expectedClose)}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Account</span>
                {accountObj ? (
                  <Link
                    to={`/accounts/${accountObj._id}`}
                    className="font-medium text-foreground hover:text-brand flex items-center gap-1"
                  >
                    <Building2 className="w-3.5 h-3.5 text-muted" />
                    <span>{accountObj.name}</span>
                    <ExternalLink className="w-3 h-3 text-muted/60" />
                  </Link>
                ) : (
                  <span className="text-muted italic">Unlinked</span>
                )}
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Contact</span>
                {contactObj ? (
                  <Link
                    to={`/contacts/${contactObj._id}`}
                    className="font-medium text-foreground hover:text-brand flex items-center gap-1"
                  >
                    <ContactIcon className="w-3.5 h-3.5 text-muted" />
                    <span>
                      {contactObj.firstName} {contactObj.lastName}
                    </span>
                    <ExternalLink className="w-3 h-3 text-muted/60" />
                  </Link>
                ) : (
                  <span className="text-muted italic">Unlinked</span>
                )}
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Deal Owner</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-muted" />
                  <span>{ownerName}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Created Date</span>
                <span className="text-muted flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  <span>{formatDate(deal.createdAt)}</span>
                </span>
              </div>
            </div>

            {/* Custom Fields (Part 5) */}
            <CustomFieldsSection entity="deal" values={deal.custom || {}} readOnly />
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
          </div>

          {activeTab === 'timeline' && (
            <TimelineTab entityType="deal" entityId={id!} />
          )}

          {activeTab === 'notes' && (
            <TimelineTab entityType="deal" entityId={id!} defaultFilter="note" />
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Deal Action Items
                </h4>
                <Button variant="secondary" size="sm" onClick={() => setTaskModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </Button>
              </div>
              <TimelineTab entityType="deal" entityId={id!} defaultFilter="task" />
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
              <TimelineTab entityType="deal" entityId={id!} defaultFilter="email" />
            </div>
          )}

          {activeTab === 'quotes' && (
            <EntityQuotesAndInvoices
              type="quotes"
              filter={{ deal: id }}
              dealId={id}
            />
          )}

          {activeTab === 'invoices' && (
            <EntityQuotesAndInvoices
              type="invoices"
              filter={{ deal: id }}
              dealId={id}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab entityType="deal" entityId={id!} />
          )}
        </Reveal>

        {/* ================= RIGHT COLUMN: RELATED RECORDS ================= */}
        <Reveal delay={0.18} className="lg:col-span-3 space-y-4">
          {/* Related Account */}
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
              <span>Account</span>
              {accountObj && (
                <Link
                  to={`/accounts/${accountObj._id}`}
                  className="text-[11px] text-brand hover:underline font-normal"
                >
                  View
                </Link>
              )}
            </h3>

            {accountObj ? (
              <div
                onClick={() => navigate(`/accounts/${accountObj._id}`)}
                className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1E1E24] border border-border/80 hover:border-neutral-400 cursor-pointer transition-colors"
              >
                <h4 className="text-xs font-semibold text-foreground">{accountObj.name}</h4>
                <p className="text-[10px] text-muted mt-0.5">{accountObj.industry}</p>
              </div>
            ) : (
              <p className="text-xs text-muted">No associated account.</p>
            )}
          </div>

          {/* Related Contact */}
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
              <span>Primary Contact</span>
              {contactObj && (
                <Link
                  to={`/contacts/${contactObj._id}`}
                  className="text-[11px] text-brand hover:underline font-normal"
                >
                  View
                </Link>
              )}
            </h3>

            {contactObj ? (
              <div
                onClick={() => navigate(`/contacts/${contactObj._id}`)}
                className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1E1E24] border border-border/80 hover:border-neutral-400 cursor-pointer transition-colors"
              >
                <h4 className="text-xs font-semibold text-foreground">
                  {contactObj.firstName} {contactObj.lastName}
                </h4>
                <p className="text-[10px] text-muted truncate mt-0.5">{contactObj.email}</p>
              </div>
            ) : (
              <p className="text-xs text-muted">No primary contact linked.</p>
            )}
          </div>

          {/* Related Tasks */}
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Tasks ({dealTasks.length})
              </h3>
              <button
                onClick={() => setTaskModalOpen(true)}
                className="text-[11px] text-brand hover:underline"
              >
                + Add
              </button>
            </div>

            {dealTasks.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No tasks linked to deal.</p>
            ) : (
              <div className="space-y-2">
                {dealTasks.map((t) => (
                  <div
                    key={t._id}
                    className="p-2.5 rounded-xl border border-border bg-card text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground line-clamp-1">{t.title}</span>
                      <Badge size="sm" variant={getStatusBadgeVariant(t.priority)}>
                        {t.priority}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted">Due {formatDate(t.dueDate)}</p>
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
        title="Edit Deal"
        subtitle={`ID: ${deal._id}`}
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
            <label className="block text-xs font-medium text-foreground mb-1">Deal Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Amount (₹) *</label>
              <input
                type="number"
                min="0"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Stage</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as DealStage })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              >
                {stages.map((stg) => (
                  <option key={stg} value={stg}>
                    {stg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Expected Close</label>
            <input
              type="date"
              required
              value={formData.expectedClose}
              onChange={(e) => setFormData({ ...formData, expectedClose: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Account *</label>
              <select
                required
                value={formData.account}
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              >
                <option value="">Select Account...</option>
                {accounts.map((acc) => (
                  <option key={acc._id} value={acc._id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Contact *</label>
              <select
                required
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              >
                <option value="">Select Contact...</option>
                {contacts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
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
            entity="deal"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Add Task Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Add Task for Deal"
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
              placeholder="e.g. Send finalized MSA to legal"
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
        title="Delete Deal"
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
              Delete Deal
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground">
          Are you sure you want to delete <span className="font-semibold">{deal.title}</span>?
          This action cannot be undone.
        </p>
      </Modal>

      {/* Email Compose Modal */}
      <ComposeEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        entityType="deal"
        entityId={id!}
        recipientEmail={contactObj?.email || ''}
        contextData={{
          deal: {
            title: deal.title,
            amount: deal.amount,
          },
          account: accountObj || {},
          contact: contactObj || {},
        }}
      />

      {/* Record Summary Modal */}
      <RecordSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        entityType="deal"
        entityId={id!}
        recordName={deal.title}
      />
    </PageTransition>
  );
};
