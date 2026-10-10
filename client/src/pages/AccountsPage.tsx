import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Trash2, Globe, Phone, MapPin, Users, Download, Upload } from 'lucide-react';
import { Account, User } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { DataTable, Column } from '../components/common/DataTable.js';
import { Button } from '../components/ui/Button.js';
import { Drawer } from '../components/ui/Drawer.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { formatDate } from '../utils/formatters.js';
import { CustomFieldsSection } from '../components/custom-fields/CustomFieldsSection.js';
import { ImportWizardModal } from '../components/import/ImportWizardModal.js';
import { PageTransition } from '../components/motion/PageTransition.js';

export const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [sort, setSort] = useState('createdAt:desc');

  // Drawer & modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    website: '',
    phone: '',
    city: '',
    employees: 50,
    owner: '',
    custom: {} as Record<string, any>,
  });

  // Query Accounts
  const { data: responseData, isLoading } = useQuery({
    queryKey: ['accounts', { page, search, industryFilter, sort }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('q', search);
      if (industryFilter) params.append('industry', industryFilter);
      if (sort) params.append('sort', sort);

      const res = await api.get(`/accounts?${params.toString()}`);
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

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (selectedAccount) {
        const res = await api.patch(`/accounts/${selectedAccount._id}`, data);
        return res.data;
      } else {
        const res = await api.post('/accounts', data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      success(selectedAccount ? 'Account updated successfully' : 'Account created successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save account');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/accounts/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      success('Account deleted successfully');
      setDeleteModalOpen(false);
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete account');
    },
  });

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (industryFilter) params.append('industry', industryFilter);
      if (sort) params.append('sort', sort);

      const res = await api.get(`/accounts/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounts_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      success('Accounts exported as CSV');
    } catch (err: any) {
      error(err.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedAccount(null);
    setFormData({
      name: '',
      industry: 'Technology',
      website: '',
      phone: '',
      city: 'Mumbai',
      employees: 50,
      owner: user?._id || '',
      custom: {},
    });
    setDrawerOpen(true);
  };

  const columns: Column<Account>[] = [
    {
      key: 'name',
      header: 'Company / Account',
      sortable: true,
      render: (acc) => (
        <div>
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-muted shrink-0" />
            <span>{acc.name}</span>
          </div>
          {acc.website && (
            <div className="text-xs text-muted flex items-center gap-1 mt-0.5 ml-5.5">
              <Globe className="w-3 h-3 opacity-60" />
              <span className="truncate max-w-[200px]">{acc.website.replace('https://', '')}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'industry',
      header: 'Industry',
      sortable: true,
      render: (acc) => (
        <span className="text-xs bg-[#F4F4F5] dark:bg-[#202025] px-2.5 py-1 rounded-lg text-foreground font-medium">
          {acc.industry}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'Location',
      sortable: true,
      render: (acc) => (
        <span className="text-xs text-foreground flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-muted shrink-0" /> {acc.city || 'India'}
        </span>
      ),
    },
    {
      key: 'employees',
      header: 'Size',
      sortable: true,
      render: (acc) => (
        <span className="text-xs text-muted flex items-center gap-1">
          <Users className="w-3.5 h-3.5 opacity-60" /> {acc.employees?.toLocaleString('en-IN')} employees
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (acc) => (
        <span className="text-xs text-muted flex items-center gap-1">
          <Phone className="w-3 h-3 opacity-60" /> {acc.phone || '-'}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (acc) => {
        const ownerName = typeof acc.owner === 'object' ? acc.owner?.name : 'Assigned';
        return <span className="text-xs text-muted">{ownerName}</span>;
      },
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (acc) => <span className="text-xs text-muted">{formatDate(acc.createdAt)}</span>,
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
        searchPlaceholder="Search accounts by name, industry, city..."
        sort={sort}
        onSortChange={setSort}
        pagination={responseData?.pagination}
        onPageChange={setPage}
        onRowClick={(acc) => navigate(`/accounts/${acc._id}`)}
        storageKey="flowdesk_cols_accounts"
        filterSlot={
          <input
            type="text"
            value={industryFilter}
            onChange={(e) => {
              setIndustryFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by industry..."
            className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white w-36"
          />
        }
        actionSlot={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleExportCSV}
              isLoading={isExporting}
              title="Export filtered accounts as CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setImportModalOpen(true)}
              title="Import accounts from CSV"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="primary" size="md" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </Button>
          </div>
        }
        emptyState={
          <EmptyState
            icon={Building2}
            title="No accounts found"
            description="Manage company organizations and accounts in your portfolio."
            actionLabel="Add Account"
            onAction={handleOpenCreate}
          />
        }
      />

      {/* Drawer Form (Create / Edit) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedAccount ? 'Edit Account' : 'Create New Account'}
        subtitle={selectedAccount ? `ID: ${selectedAccount._id}` : 'Create organization record'}
        footer={
          <>
            <div>
              {selectedAccount && canDelete && (
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
                {selectedAccount ? 'Save Changes' : 'Create Account'}
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
              Account / Organization Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Tata Digital Solutions"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Industry *
              </label>
              <input
                type="text"
                required
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="Enterprise Software, FinTech, Retail"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Headquarters City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Mumbai, Bengaluru, Delhi"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Website URL
              </label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://tatadigital.com"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Company Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 22 6665 8282"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Employee Count
            </label>
            <input
              type="number"
              min="1"
              value={formData.employees}
              onChange={(e) => setFormData({ ...formData, employees: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
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

          {/* Dynamic Custom Fields */}
          <CustomFieldsSection
            entity="account"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Account"
        description={`Are you sure you want to permanently delete "${selectedAccount?.name}"? Contacts and deals associated with this account may be impacted.`}
        confirmLabel="Delete Account"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => selectedAccount && deleteMutation.mutate(selectedAccount._id)}
      />

      {/* CSV Import Wizard Modal */}
      <ImportWizardModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        entity="account"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['accounts'] })}
      />
    </PageTransition>
  );
};
