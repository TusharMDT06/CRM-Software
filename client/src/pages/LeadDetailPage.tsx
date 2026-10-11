import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  User as UserIcon,
  Edit,
  ArrowRightLeft,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  FileText,
  Sparkles,
  Target,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { Lead, Task, User } from '../types/index.js';
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
import { HistoryTab } from '../components/common/HistoryTab.js';
import { RecordSummaryModal } from '../components/ai/RecordSummaryModal.js';
import { explainScoreWithAi, getAiStatus } from '../api/ai.js';

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'tasks' | 'emails' | 'history'>('timeline');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [explainingScore, setExplainingScore] = useState(false);
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

  const handleExplainScore = async () => {
    if (!id || explainingScore) return;
    setExplainingScore(true);
    try {
      await explainScoreWithAi('lead', id);
      success('AI explanation generated for lead score');
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
    } catch (err: any) {
      error(err.message || 'Failed to generate explanation');
    } finally {
      setExplainingScore(false);
    }
  };

  // Quick Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Edit form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: 'website',
    status: 'new',
    value: 0,
    notes: '',
    owner: '',
    custom: {} as Record<string, any>,
  });

  // Query Lead Detail
  const {
    data: lead,
    isLoading,
    isError,
  } = useQuery<Lead>({
    queryKey: ['lead', id],
    queryFn: async () => {
      const res = await api.get(`/leads/${id}`);
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

  // Query Tasks related to this owner / lead context
  const { data: tasksData } = useQuery({
    queryKey: ['lead-tasks', id],
    queryFn: async () => {
      const res = await api.get('/tasks?limit=20');
      return res.data;
    },
  });

  const tasks: Task[] = (tasksData?.data || []).filter((t: Task) => {
    return t.description?.includes(id!) || t.title?.toLowerCase().includes(lead?.name?.toLowerCase() || '');
  });

  // Sync form when lead loads
  React.useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        source: lead.source,
        status: lead.status,
        value: lead.value,
        notes: lead.notes || '',
        owner: typeof lead.owner === 'object' ? (lead.owner as User)._id : (lead.owner as string),
        custom: lead.custom || {},
      });
    }
  }, [lead]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.patch(`/leads/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      success('Lead updated successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update lead');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/leads/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      success('Lead deleted');
      navigate('/leads');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete lead');
    },
  });

  // Convert Handler
  const handleConvert = async () => {
    if (!lead) return;
    try {
      setIsConverting(true);
      const res = await api.post(`/leads/${id}/convert`);
      success('Lead converted to Account, Contact, and Deal successfully!');
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (res.data?.deal?._id) {
        navigate(`/deals/${res.data.deal._id}`);
      }
    } catch (err: any) {
      error(err.message || 'Failed to convert lead');
    } finally {
      setIsConverting(false);
    }
  };

  // Add Task Mutation
  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/tasks', {
        title: taskTitle.trim(),
        description: `Follow up with lead: ${lead?.name} (${lead?.company}) [ID: ${id}]`,
        dueDate: new Date(taskDueDate).toISOString(),
        priority: taskPriority,
        status: 'open',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', id] });
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

  if (isError || !lead) {
    return (
      <div className="p-12 text-center bg-card border border-border rounded-card max-w-md mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Record not found</h3>
        <p className="text-sm text-muted">
          This lead does not exist or you do not have permission to access it.
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/leads')}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads</span>
        </Button>
      </div>
    );
  }

  const owner = typeof lead.owner === 'object' ? (lead.owner as User) : null;
  const ownerName = owner?.name || 'Unassigned';

  return (
    <PageTransition className="space-y-6">
      {/* Top Header Breadcrumb & Actions */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/leads')}
              className="p-2 rounded-xl border border-border bg-card text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {lead.name}
                </h1>
                <Badge size="md" variant={getStatusBadgeVariant(lead.status)}>
                  {lead.status}
                </Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {lead.company} • Created {formatDate(lead.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {aiAvailable && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSummaryModalOpen(true)}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Summarise</span>
              </Button>
            )}

            <Button variant="secondary" size="md" onClick={() => setDrawerOpen(true)}>
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Button>

            {lead.status !== 'converted' && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleConvert}
                isLoading={isConverting}
                className="text-[#3FCB8A] hover:text-[#3FCB8A]"
              >
                <ArrowRightLeft className="w-4 h-4 text-[#3FCB8A]" />
                <span>Convert Lead</span>
              </Button>
            )}

            {canDelete && (
              <Button variant="danger" size="md" onClick={() => setDeleteModalOpen(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      {/* 3-Column Layout (Stacks on mobile/tablet) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: INFO & QUICK ACTIONS ================= */}
        <Reveal delay={0.06} className="lg:col-span-4 space-y-5">
          <div className="space-y-5">
          {/* Quick Actions Card */}
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

          {/* Lead Score Card */}
          {lead.aiScore && (
            <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Lead Score
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                    lead.aiScore.grade === 'hot'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                      : lead.aiScore.grade === 'warm'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                  }`}
                >
                  {lead.aiScore.grade} • {lead.aiScore.score}/100
                </span>
              </div>

              {lead.aiScore.reasons && lead.aiScore.reasons.length > 0 && (
                <ul className="text-xs space-y-1 text-muted">
                  {lead.aiScore.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}

              {lead.aiScore.explanation && (
                <div className="text-xs bg-muted/20 border border-border/50 rounded-lg p-2.5 text-foreground leading-relaxed">
                  <div className="text-[10px] uppercase font-semibold text-muted mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" /> AI Analysis
                  </div>
                  {lead.aiScore.explanation}
                </div>
              )}

              {aiAvailable && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExplainScore}
                  isLoading={explainingScore}
                  className="w-full text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{lead.aiScore.explanation ? 'Refresh AI Analysis' : 'Explain Score with AI'}</span>
                </Button>
              )}
            </div>
          )}

          {/* Record Details Card */}
          <div className="bg-card border border-border rounded-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2.5">
              Lead Details
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block text-[11px] mb-0.5">Email</span>
                <a
                  href={`mailto:${lead.email}`}
                  className="font-medium text-foreground hover:text-brand flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5 text-muted" />
                  <span>{lead.email}</span>
                </a>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Phone</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted" />
                  <span>{lead.phone || '—'}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Company</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-muted" />
                  <span>{lead.company}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Lead Value</span>
                <span className="font-semibold text-foreground text-sm">
                  {formatINR(lead.value)}
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Source</span>
                <span className="font-medium text-foreground capitalize">{lead.source}</span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Owner</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5 text-muted" />
                  <span>{ownerName}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Created Date</span>
                <span className="text-muted flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  <span>{formatDate(lead.createdAt)}</span>
                </span>
              </div>

              {lead.notes && (
                <div className="pt-2 border-t border-border">
                  <span className="text-muted block text-[11px] mb-1">Notes</span>
                  <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Custom Fields (Part 5) */}
            <CustomFieldsSection entity="lead" values={lead.custom || {}} readOnly />

            {/* Phase 5: Where this lead came from Card */}
            <div className="bg-card border border-border rounded-card p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Where this lead came from
                  </h3>
                </div>
                {lead.isTest && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    TEST LEAD
                  </span>
                )}
              </div>

              <div className="space-y-3 text-xs">
                {/* Marketing Channel */}
                <div>
                  <span className="text-muted block text-[11px] mb-1">Marketing Channel</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-xs capitalize ${
                      lead.channel === 'google_ads'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : lead.channel === 'facebook'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                        : lead.channel === 'instagram'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                        : lead.channel === 'website_form'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : lead.channel === 'whatsapp'
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                        : 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20'
                    }`}
                  >
                    <Radio className="w-3 h-3" />
                    <span>{lead.channel ? lead.channel.replace('_', ' ') : 'Manual / Other'}</span>
                  </span>
                </div>

                {/* Campaign */}
                {lead.campaign?.name && (
                  <div>
                    <span className="text-muted block text-[11px] mb-0.5">Campaign</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-muted" />
                      <span>{lead.campaign.name}</span>
                    </span>
                    {lead.campaign.externalId && (
                      <span className="text-[10px] text-muted font-mono block mt-0.5">
                        ID: {lead.campaign.externalId}
                      </span>
                    )}
                  </div>
                )}

                {/* Ad Set & Ad */}
                {(lead.adSet?.name || lead.ad?.name) && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
                    {lead.adSet?.name && (
                      <div>
                        <span className="text-muted block text-[10px]">Ad Set</span>
                        <span className="font-medium text-foreground truncate block">
                          {lead.adSet.name}
                        </span>
                      </div>
                    )}
                    {lead.ad?.name && (
                      <div>
                        <span className="text-muted block text-[10px]">Ad Creative</span>
                        <span className="font-medium text-foreground truncate block">
                          {lead.ad.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Form Name */}
                {lead.formName && (
                  <div>
                    <span className="text-muted block text-[11px] mb-0.5">Inbound Form</span>
                    <span className="font-medium text-foreground">{lead.formName}</span>
                  </div>
                )}

                {/* Inquiries Count */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-muted text-[11px]">Total Inquiries:</span>
                  <span className="font-bold text-foreground px-2 py-0.5 rounded bg-muted/20 text-[11px]">
                    {lead.inquiryCount || 1} {lead.inquiryCount === 1 ? 'inquiry' : 'inquiries'}
                  </span>
                </div>

                {/* UTM Parameters */}
                {lead.utm && (lead.utm.source || lead.utm.campaign || lead.utm.medium) && (
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    <span className="text-muted block text-[11px] font-semibold">UTM Attribution:</span>
                    <div className="p-2 rounded-lg bg-card-subtle border border-border/60 text-[11px] font-mono space-y-0.5">
                      {lead.utm.source && <div>utm_source: <span className="text-foreground">{lead.utm.source}</span></div>}
                      {lead.utm.medium && <div>utm_medium: <span className="text-foreground">{lead.utm.medium}</span></div>}
                      {lead.utm.campaign && <div>utm_campaign: <span className="text-foreground">{lead.utm.campaign}</span></div>}
                      {lead.utm.term && <div>utm_term: <span className="text-foreground">{lead.utm.term}</span></div>}
                      {lead.utm.content && <div>utm_content: <span className="text-foreground">{lead.utm.content}</span></div>}
                    </div>
                  </div>
                )}

                {/* Click IDs */}
                {lead.clickIds && (lead.clickIds.gclid || lead.clickIds.fbclid) && (
                  <div className="text-[11px] font-mono p-2 rounded-lg bg-card-subtle border border-border/60 truncate">
                    {lead.clickIds.gclid && <div className="truncate">gclid: {lead.clickIds.gclid}</div>}
                    {lead.clickIds.fbclid && <div className="truncate">fbclid: {lead.clickIds.fbclid}</div>}
                  </div>
                )}

                {/* Consent Status */}
                <div className="pt-2 border-t border-border/40 text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck
                      className={`w-3.5 h-3.5 ${
                        lead.consent?.given ? 'text-emerald-500' : 'text-neutral-400'
                      }`}
                    />
                    <span className="font-medium text-foreground">
                      Consent: {lead.consent?.given ? 'Granted & Documented' : 'Not recorded'}
                    </span>
                  </div>
                  {lead.consent?.text && (
                    <p className="text-[10px] text-muted italic line-clamp-2">
                      "{lead.consent.text}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ================= CENTER COLUMN: TABS ================= */}
      <Reveal delay={0.12} className="lg:col-span-5 space-y-4">
        {/* Tab Navigation */}
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

          {/* Tab Content */}
          {activeTab === 'timeline' && (
            <TimelineTab entityType="lead" entityId={id!} />
          )}

          {activeTab === 'notes' && (
            <TimelineTab entityType="lead" entityId={id!} defaultFilter="note" />
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Associated Tasks
                </h4>
                <Button variant="secondary" size="sm" onClick={() => setTaskModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </Button>
              </div>

              {tasks.length === 0 ? (
                <div className="bg-card border border-border rounded-card p-8 text-center text-xs text-muted">
                  No tasks linked to this lead yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task._id}
                      className="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{task.title}</p>
                        <p className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Due {formatDate(task.dueDate)}</span>
                        </p>
                      </div>
                      <Badge size="sm" variant={getStatusBadgeVariant(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Sent Emails
                </h4>
                <Button variant="primary" size="sm" onClick={() => setEmailModalOpen(true)}>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Compose Email</span>
                </Button>
              </div>
              <TimelineTab entityType="lead" entityId={id!} defaultFilter="email" />
            </div>
          )}

          {activeTab === 'history' && (
            <HistoryTab entityType="lead" entityId={id!} />
          )}
        </Reveal>

        {/* ================= RIGHT COLUMN: RELATED RECORDS ================= */}
        <Reveal delay={0.18} className="lg:col-span-3 space-y-4">
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Pipeline Stage
            </h3>
            <div className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1E1E24] border border-border/80 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted">Current status:</span>
                <Badge size="sm" variant={getStatusBadgeVariant(lead.status)}>
                  {lead.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Value:</span>
                <span className="font-bold text-foreground">{formatINR(lead.value)}</span>
              </div>
              {lead.status === 'converted' && (
                <div className="pt-2 border-t border-border text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Converted to Customer</span>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Edit Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Edit Lead"
        subtitle={`ID: ${lead._id}`}
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
            <label className="block text-xs font-medium text-foreground mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Lead Value (₹) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              >
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="social">Social</option>
                <option value="email">Email</option>
                <option value="event">Event</option>
                <option value="other">Other</option>
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

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none resize-none"
            />
          </div>

          {/* Dynamic Custom Fields in Drawer */}
          <CustomFieldsSection
            entity="lead"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Quick Add Task Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Add Task for Lead"
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
              placeholder="e.g. Send updated pricing deck"
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Lead"
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
              Delete Lead
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground">
          Are you sure you want to delete lead <span className="font-semibold">{lead.name}</span>?
          This action cannot be undone.
        </p>
      </Modal>

      {/* Email Compose Modal */}
      <ComposeEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        entityType="lead"
        entityId={id!}
        recipientEmail={lead.email}
        contextData={{
          lead: {
            name: lead.name,
            company: lead.company,
          },
        }}
      />

      {/* Record Summary Modal */}
      <RecordSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        entityType="lead"
        entityId={id!}
        recordName={lead.name}
      />
    </PageTransition>
  );
};
