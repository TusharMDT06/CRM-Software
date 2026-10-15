import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users2,
  Plus,
  ArrowRightLeft,
  Trash2,
  Mail,
  Building,
  Download,
  Upload,
} from 'lucide-react';
import { Lead, User, LeadStatus, LeadSource } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { DataTable, Column } from '../components/common/DataTable.js';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Drawer } from '../components/ui/Drawer.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import { CustomFieldsSection } from '../components/custom-fields/CustomFieldsSection.js';
import { ImportWizardModal } from '../components/import/ImportWizardModal.js';
import { PageTransition } from '../components/motion/PageTransition.js';

export const LeadsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [sort, setSort] = useState('createdAt:desc');

  // Drawer & modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: 'website' as LeadSource,
    status: 'new' as LeadStatus,
    rating: 'warm' as 'hot' | 'warm' | 'cold',
    value: 0,
    notes: '',
    owner: '',
    custom: {} as Record<string, any>,
  });

  // Query Leads
  const { data: responseData, isLoading } = useQuery({
    queryKey: ['leads', { page, search, statusFilter, sourceFilter, channelFilter, campaignFilter, sort }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('q', search);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (channelFilter) params.append('channel', channelFilter);
      if (campaignFilter) params.append('campaign', campaignFilter);
      if (sort) params.append('sort', sort);

      const res = await api.get(`/leads?${params.toString()}`);
      return res.data;
    },
  });

  // Query Users for owner dropdown (admin/manager only)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: isAdmin || isManager,
  });

  // Create or Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (selectedLead) {
        const res = await api.patch(`/leads/${selectedLead._id}`, data);
        return res.data;
      } else {
        const res = await api.post('/leads', data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success(selectedLead ? 'Lead updated successfully' : 'Lead created successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save lead');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/leads/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success('Lead deleted successfully');
      setDeleteModalOpen(false);
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete lead');
    },
  });

  // Convert Lead to Deal Mutation
  const convertMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await api.post(`/leads/${leadId}/convert`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success(`Lead converted into ${data.deal?.title}!`);
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to convert lead');
    },
  });

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (sort) params.append('sort', sort);

      const res = await api.get(`/leads/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      success('Leads exported as CSV');
    } catch (err: any) {
      error(err.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedLead(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      source: 'website',
      status: 'new',
      rating: 'warm',
      value: 100000,
      notes: '',
      owner: user?._id || '',
      custom: {},
    });
    setDrawerOpen(true);
  };

  const handleConvert = async () => {
    if (!selectedLead) return;
    setIsConverting(true);
    try {
      await convertMutation.mutateAsync(selectedLead._id);
    } finally {
      setIsConverting(false);
    }
  };

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead Name',
      sortable: true,
      render: (lead) => (
        <div>
          <div className="font-medium text-foreground flex items-center gap-1.5">
            <span>{lead.name}</span>
            {lead.isTest && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                TEST
              </span>
            )}
          </div>
          <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3 opacity-60" /> {lead.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      sortable: true,
      render: (lead) => {
        const ch = lead.channel || 'other';
        return (
          <span className="text-xs capitalize text-foreground bg-[#F4F4F5] dark:bg-[#202025] px-2 py-0.5 rounded-md">
            {ch.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'campaign',
      header: 'Campaign',
      render: (lead) => {
        const camp = lead.campaign?.name || lead.campaign?.externalId || '—';
        return <span className="text-xs text-muted truncate max-w-[130px] block">{camp}</span>;
      },
    },
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      render: (lead) => (
        <div className="flex items-center gap-1.5 text-foreground">
          <Building className="w-3.5 h-3.5 text-muted shrink-0" />
          <span>{lead.company}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (lead) => (
        <Badge variant={getStatusBadgeVariant(lead.status)}>
          {lead.status}
        </Badge>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      render: (lead) => {
        const r = lead.rating || 'warm';
        const color =
          r === 'hot'
            ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
            : r === 'warm'
            ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
            : 'text-blue-600 bg-blue-500/10 border-blue-500/20';
        const emoji = r === 'hot' ? '🔥' : r === 'warm' ? '☀️' : '❄️';
        return (
          <span className={`text-xs capitalize font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${color}`}>
            <span>{emoji}</span> {r}
          </span>
        );
      },
    },
    {
      key: 'value',
      header: 'Value',
      sortable: true,
      render: (lead) => (
        <span className="font-semibold text-foreground">{formatINR(lead.value)}</span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (lead) => {
        const ownerName = typeof lead.owner === 'object' ? lead.owner?.name : 'Assigned';
        return <span className="text-xs text-muted">{ownerName}</span>;
      },
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (lead) => <span className="text-xs text-muted">{formatDate(lead.createdAt)}</span>,
    },
  ];

  return (
    <PageTransition className="space-y-4">
      <DataTable
        columns={columns}
        data={responseData?.data || []}
        isLoading={isLoading}
        searchQuery={search}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchPlaceholder="Search leads by name, company, email..."
        sort={sort}
        onSortChange={setSort}
        pagination={responseData?.pagination}
        onPageChange={setPage}
        onRowClick={(lead) => navigate(`/leads/${lead._id}`)}
        storageKey="flowdesk_cols_leads"
        filterSlot={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="">All Sources</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="cold_outreach">Cold Outreach</option>
              <option value="inbound">Inbound</option>
              <option value="advertisement">Advertisement</option>
              <option value="other">Other</option>
            </select>

            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="">All Channels</option>
              <option value="google_ads">Google Ads</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="website_form">Website Form</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="api">API / Webhook</option>
              <option value="import">Import</option>
              <option value="manual">Manual</option>
              <option value="other">Other</option>
            </select>

            <input
              type="text"
              placeholder="Campaign..."
              value={campaignFilter}
              onChange={(e) => {
                setCampaignFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white w-28 placeholder:text-muted"
            />
          </div>
        }
        actionSlot={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleExportCSV}
              isLoading={isExporting}
              title="Export filtered leads as CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setImportModalOpen(true)}
              title="Import leads from CSV file"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="primary" size="md" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </Button>
          </div>
        }
        emptyState={
          <EmptyState
            icon={Users2}
            title="No leads found"
            description="Start building your sales pipeline by adding your first lead."
            actionLabel="Create Lead"
            onAction={handleOpenCreate}
          />
        }
      />

      {/* Drawer Form (Create / Edit) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedLead ? 'Edit Lead' : 'Create New Lead'}
        subtitle={selectedLead ? `ID: ${selectedLead._id}` : 'Add prospective lead to pipeline'}
        footer={
          <>
            <div className="flex items-center gap-2">
              {selectedLead && canDelete && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => setDeleteModalOpen(true)}
                  disabled={saveMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </Button>
              )}
              {selectedLead && selectedLead.status !== 'converted' && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleConvert}
                  isLoading={isConverting}
                  title="Convert to Account, Contact and Deal"
                >
                  <ArrowRightLeft className="w-4 h-4 text-[#3FCB8A]" />
                  <span>Convert Lead</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => saveMutation.mutate(formData)}
                isLoading={saveMutation.isPending}
              >
                {selectedLead ? 'Save Changes' : 'Create Lead'}
              </Button>
            </div>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(formData);
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
              placeholder="e.g. Aarav Sharma"
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
                placeholder="aarav@company.com"
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
                placeholder="+91 98200 12345"
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
                placeholder="Tata Digital, Swiggy, etc."
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Rating
              </label>
              <select
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value as any })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="hot">🔥 Hot</option>
                <option value="warm">☀️ Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Source
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
              <label className="block text-xs font-medium text-foreground mb-1">
                Assign Owner
              </label>
              <select
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
            <label className="block text-xs font-medium text-foreground mb-1">
              Notes & Background
            </label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add discovery call notes, requirements, or follow-up details..."
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Dynamic Custom Fields */}
          <CustomFieldsSection
            entity="lead"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Lead"
        description={`Are you sure you want to permanently delete "${selectedLead?.name}" from ${selectedLead?.company}? This action cannot be undone.`}
        confirmLabel="Delete Lead"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => selectedLead && deleteMutation.mutate(selectedLead._id)}
      />

      {/* CSV Import Wizard Modal */}
      <ImportWizardModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        entity="lead"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
      />
    </PageTransition>
  );
};
