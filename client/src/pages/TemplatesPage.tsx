import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Plus,
  Copy,
  Edit,
  Trash2,
  Sparkles,
  ChevronDown,
  Search,
  Users,
  Lock,
} from 'lucide-react';
import { EmailTemplate, TemplateCategory } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { PageTransition } from '../components/motion/PageTransition.js';
import { Reveal } from '../components/motion/Reveal.js';

const SAMPLE_DATA: Record<string, string> = {
  '{{contact.firstName}}': 'Aarav',
  '{{contact.lastName}}': 'Sharma',
  '{{account.name}}': 'Tata Digital Ltd',
  '{{deal.title}}': 'Enterprise Cloud Migration',
  '{{deal.amount}}': '₹12,50,000',
  '{{owner.name}}': 'Rohan Mehta',
  '{{lead.name}}': 'Priya Nair',
  '{{lead.company}}': 'Swiggy Technologies',
};

export const TemplatesPage: React.FC = () => {
  const { user, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'follow_up' as TemplateCategory,
    shared: false,
  });

  // Query Templates
  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates', categoryFilter],
    queryFn: async () => {
      const params = categoryFilter ? `?category=${categoryFilter}` : '';
      const res = await api.get(`/emails/templates${params}`);
      return res.data;
    },
  });

  // Filtered Templates by Search
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.body.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [templates, search]);

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (selectedTemplate) {
        const res = await api.patch(`/emails/templates/${selectedTemplate._id}`, data);
        return res.data;
      } else {
        const res = await api.post('/emails/templates', data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      success(selectedTemplate ? 'Template updated' : 'Template created');
      setModalOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save template');
    },
  });

  // Duplicate Mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/emails/templates/${id}/duplicate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      success('Template duplicated successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to duplicate template');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/emails/templates/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      success('Template deleted');
      setDeleteModalOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete template');
    },
  });

  const handleOpenCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      subject: '',
      body: '',
      category: 'follow_up',
      shared: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (tmpl: EmailTemplate) => {
    setSelectedTemplate(tmpl);
    setFormData({
      name: tmpl.name,
      subject: tmpl.subject,
      body: tmpl.body,
      category: tmpl.category,
      shared: tmpl.shared,
    });
    setModalOpen(true);
  };

  const handleInsertToken = (token: string) => {
    if (!textareaRef.current) {
      setFormData((prev) => ({ ...prev, body: prev.body + token }));
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextBody = formData.body.substring(0, start) + token + formData.body.substring(end);
    setFormData((prev) => ({ ...prev, body: nextBody }));
    setFieldMenuOpen(false);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // Live preview resolved with sample data
  const resolvedPreview = useMemo(() => {
    let subj = formData.subject;
    let b = formData.body;
    Object.entries(SAMPLE_DATA).forEach(([token, val]) => {
      subj = subj.split(token).join(val);
      b = b.split(token).join(val);
    });
    return { subject: subj, body: b };
  }, [formData.subject, formData.body]);

  const canEdit = (tmpl: EmailTemplate) => {
    if (isAdmin || isManager) return true;
    const ownerId = typeof tmpl.owner === 'object' ? tmpl.owner?._id : tmpl.owner;
    return ownerId === user?._id;
  };

  return (
    <PageTransition className="space-y-6">
      {/* Page Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Mail className="w-6 h-6 text-brand" />
              <span>Email Templates</span>
            </h1>
            <p className="text-xs text-muted mt-1">
              Standardize outbound sales correspondence with reusable templates and live merge tags.
            </p>
          </div>

          <Button variant="primary" size="md" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </Button>
        </div>
      </Reveal>

      {/* Toolbar Filters */}
      <Reveal delay={0.06}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name, subject or body..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="">All Categories</option>
              <option value="follow_up">Follow Up</option>
              <option value="proposal">Proposal</option>
              <option value="intro">Introduction</option>
              <option value="thank_you">Thank You</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </Reveal>

      {/* Templates Grid */}
      <Reveal delay={0.12}>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 bg-card border border-border rounded-card animate-pulse"
            />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No email templates found"
          description="Create your first reusable email template with dynamic merge fields."
          actionLabel="Create Template"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tmpl) => {
            const editable = canEdit(tmpl);
            const ownerObj = typeof tmpl.owner === 'object' ? tmpl.owner : null;
            const ownerName = ownerObj?.name || 'User';

            return (
              <div
                key={tmpl._id}
                className="bg-card border border-border rounded-card p-4 shadow-xs flex flex-col justify-between hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground line-clamp-1">
                      {tmpl.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-muted capitalize">
                        {tmpl.category.replace('_', ' ')}
                      </span>
                      {tmpl.shared && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          Shared
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-medium text-foreground/80 mt-2 line-clamp-1">
                    Subject: {tmpl.subject}
                  </p>

                  <p className="text-xs text-muted mt-1.5 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {tmpl.body}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted truncate max-w-[120px]">
                    By {ownerName}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateMutation.mutate(tmpl._id)}
                      className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
                      title="Duplicate Template"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {editable ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(tmpl)}
                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
                        title="Edit Template"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span
                        className="p-1.5 text-muted/40 cursor-not-allowed"
                        title="Shared templates are read-only"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {editable && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplate(tmpl);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </Reveal>

      {/* Create / Edit Modal with Live Preview */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedTemplate ? 'Edit Template' : 'New Email Template'}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => saveMutation.mutate(formData)}
              isLoading={saveMutation.isPending}
              disabled={!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()}
            >
              {selectedTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Form Side */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Post-Demo Follow Up"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as TemplateCategory })
                  }
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
                >
                  <option value="follow_up">Follow Up</option>
                  <option value="proposal">Proposal</option>
                  <option value="intro">Introduction</option>
                  <option value="thank_you">Thank You</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="tmpl-shared"
                  checked={formData.shared}
                  onChange={(e) => setFormData({ ...formData, shared: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-black dark:text-white"
                />
                <label
                  htmlFor="tmpl-shared"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  Share with team
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Subject *</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Next steps for {{account.name}}"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-foreground">Message Body *</label>

                {/* Field-insert Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFieldMenuOpen(!fieldMenuOpen)}
                    className="flex items-center gap-1 text-[11px] text-brand hover:underline font-medium"
                  >
                    <span>Insert field</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {fieldMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-50 py-1 text-xs">
                      {Object.keys(SAMPLE_DATA).map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => handleInsertToken(token)}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] dark:hover:bg-[#202025] text-foreground font-mono text-[11px]"
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                rows={7}
                required
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Hi {{contact.firstName}},&#10;&#10;Thank you for taking the time to speak today..."
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none resize-none font-sans"
              />
            </div>
          </div>

          {/* Live Preview Side */}
          <div className="p-4 bg-[#FAFAFA] dark:bg-[#1C1C22] rounded-xl border border-border space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F07B2A]" />
                  Live Preview (Sample Data)
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-muted block text-[11px]">Subject:</span>
                  <p className="font-semibold text-foreground text-sm">
                    {resolvedPreview.subject || <span className="text-muted/60 italic">—</span>}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <span className="text-muted block text-[11px] mb-1">Body:</span>
                  <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed text-xs">
                    {resolvedPreview.body || (
                      <span className="text-muted/60 italic">Your message preview will appear here.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border/60 text-[10px] text-muted">
              Merge fields like <code className="bg-card px-1 py-0.5 rounded">{'{{contact.firstName}}'}</code> resolve to recipient information when composing.
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Template"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate._id)}
              isLoading={deleteMutation.isPending}
            >
              Delete Template
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground">
          Are you sure you want to delete template{' '}
          <span className="font-semibold">{selectedTemplate?.name}</span>? This action cannot be
          undone.
        </p>
      </Modal>
    </PageTransition>
  );
};
