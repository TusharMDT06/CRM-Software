import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  User as UserIcon,
  Briefcase,
  Edit,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Contact, Account, Deal, User } from '../types/index.js';
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

export const ContactDetailPage: React.FC = () => {
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

  // Quick Task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Edit form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    account: '',
    owner: '',
    custom: {} as Record<string, any>,
  });

  // Query Contact Detail
  const {
    data: contact,
    isLoading,
    isError,
  } = useQuery<Contact>({
    queryKey: ['contact', id],
    queryFn: async () => {
      const res = await api.get(`/contacts/${id}`);
      return res.data;
    },
    retry: false,
  });

  // Query Accounts for account dropdown
  const { data: accountsData } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=100');
      return res.data;
    },
  });
  const accounts: Account[] = accountsData?.data || [];

  // Query Users for owner dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: isAdmin || isManager,
  });

  // Query related Deals for this contact
  const { data: dealsData } = useQuery({
    queryKey: ['contact-deals', id],
    queryFn: async () => {
      const res = await api.get('/deals?limit=50');
      return res.data;
    },
  });
  const contactDeals: Deal[] = (dealsData?.data || []).filter((d: Deal) => {
    const contactId = typeof d.contact === 'object' ? d.contact?._id : d.contact;
    return contactId === id;
  });

  // Sync form when contact loads
  React.useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        jobTitle: contact.jobTitle || '',
        account:
          typeof contact.account === 'object'
            ? (contact.account as Account)._id
            : (contact.account as string),
        owner:
          typeof contact.owner === 'object'
            ? (contact.owner as User)._id
            : (contact.owner as string),
        custom: contact.custom || {},
      });
    }
  }, [contact]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.patch(`/contacts/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      success('Contact updated successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update contact');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/contacts/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      success('Contact deleted');
      navigate('/contacts');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete contact');
    },
  });

  // Quick Task Mutation
  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/tasks', {
        title: taskTitle.trim(),
        description: `Follow up with contact: ${contact?.firstName} ${contact?.lastName} [ID: ${id}]`,
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

  if (isError || !contact) {
    return (
      <div className="p-12 text-center bg-card border border-border rounded-card max-w-md mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
          <UserIcon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Record not found</h3>
        <p className="text-sm text-muted">
          This contact does not exist or you do not have permission to access it.
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/contacts')}>
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Contacts</span>
        </Button>
      </div>
    );
  }

  const accountObj = typeof contact.account === 'object' ? (contact.account as Account) : null;
  const owner = typeof contact.owner === 'object' ? (contact.owner as User) : null;
  const ownerName = owner?.name || 'Unassigned';

  return (
    <PageTransition className="space-y-6">
      {/* Top Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/contacts')}
              className="p-2 rounded-xl border border-border bg-card text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {contact.firstName} {contact.lastName}
                </h1>
                {contact.jobTitle && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-muted font-medium">
                    {contact.jobTitle}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {accountObj ? accountObj.name : 'No Account'} • Created {formatDate(contact.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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

          {/* Details Card */}
          <div className="bg-card border border-border rounded-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2.5">
              Contact Details
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block text-[11px] mb-0.5">Email</span>
                <a
                  href={`mailto:${contact.email}`}
                  className="font-medium text-foreground hover:text-brand flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5 text-muted" />
                  <span>{contact.email}</span>
                </a>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Phone</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted" />
                  <span>{contact.phone || '—'}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Job Title</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-muted" />
                  <span>{contact.jobTitle || '—'}</span>
                </span>
              </div>

              <div>
                <span className="text-muted block text-[11px] mb-0.5">Account / Company</span>
                {accountObj ? (
                  <Link
                    to={`/accounts/${accountObj._id}`}
                    className="font-medium text-foreground hover:text-brand flex items-center gap-1 group"
                  >
                    <Building2 className="w-3.5 h-3.5 text-muted group-hover:text-brand" />
                    <span>{accountObj.name}</span>
                    <ExternalLink className="w-3 h-3 text-muted/60" />
                  </Link>
                ) : (
                  <span className="text-muted italic">Unlinked</span>
                )}
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
                  <span>{formatDate(contact.createdAt)}</span>
                </span>
              </div>
            </div>

            {/* Custom Fields (Part 5) */}
            <CustomFieldsSection entity="contact" values={contact.custom || {}} readOnly />
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
            <TimelineTab entityType="contact" entityId={id!} />
          )}

          {activeTab === 'notes' && (
            <TimelineTab entityType="contact" entityId={id!} defaultFilter="note" />
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
              <TimelineTab entityType="contact" entityId={id!} defaultFilter="task" />
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
              <TimelineTab entityType="contact" entityId={id!} defaultFilter="email" />
            </div>
          )}

          {activeTab === 'history' && (
            <HistoryTab entityType="contact" entityId={id!} />
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
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-foreground font-semibold text-xs">
                    {accountObj.name[0]}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{accountObj.name}</h4>
                    <p className="text-[10px] text-muted">{accountObj.industry}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted">No associated account.</p>
            )}
          </div>

          {/* Related Deals */}
          <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Deals ({contactDeals.length})
              </h3>
              <button
                onClick={() => navigate('/deals')}
                className="text-[11px] text-brand hover:underline"
              >
                Go to Kanban
              </button>
            </div>

            {contactDeals.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No active deals with this contact.</p>
            ) : (
              <div className="space-y-2">
                {contactDeals.map((deal) => (
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
        title="Edit Contact"
        subtitle={`ID: ${contact._id}`}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            <label className="block text-xs font-medium text-foreground mb-1">Job Title</label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
            />
          </div>

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
            entity="contact"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Add Task Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Add Task for Contact"
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
              placeholder="e.g. Call to discuss contract renewal"
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
        title="Delete Contact"
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
              Delete Contact
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground">
          Are you sure you want to delete <span className="font-semibold">{contact.firstName} {contact.lastName}</span>?
          This action cannot be undone.
        </p>
      </Modal>

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        entityType="contact"
        entityId={id!}
        recipientEmail={contact.email}
        contextData={{
          contact: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
          },
          account: accountObj || {},
        }}
      />
    </PageTransition>
  );
};
