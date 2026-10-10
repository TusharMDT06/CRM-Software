import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Contact as ContactIcon, Plus, Trash2, Mail, Phone, Building2, Download, Upload } from 'lucide-react';
import { Contact, Account, User } from '../types/index.js';
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

export const ContactsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [sort, setSort] = useState('createdAt:desc');

  // Drawer & modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form State
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

  // Query Contacts
  const { data: responseData, isLoading } = useQuery({
    queryKey: ['contacts', { page, search, accountFilter, sort }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('q', search);
      if (accountFilter) params.append('account', accountFilter);
      if (sort) params.append('sort', sort);

      const res = await api.get(`/contacts?${params.toString()}`);
      return res.data;
    },
  });

  // Query Accounts for dropdown
  const { data: accountsData } = useQuery({
    queryKey: ['accounts-dropdown'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=100');
      return res.data?.data || [];
    },
  });
  const accounts: Account[] = accountsData || [];

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
      if (selectedContact) {
        const res = await api.patch(`/contacts/${selectedContact._id}`, data);
        return res.data;
      } else {
        const res = await api.post('/contacts', data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      success(selectedContact ? 'Contact updated successfully' : 'Contact created successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save contact');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/contacts/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      success('Contact deleted successfully');
      setDeleteModalOpen(false);
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete contact');
    },
  });

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (accountFilter) params.append('account', accountFilter);
      if (sort) params.append('sort', sort);

      const res = await api.get(`/contacts/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      success('Contacts exported as CSV');
    } catch (err: any) {
      error(err.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedContact(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      account: accounts[0]?._id || '',
      owner: user?._id || '',
      custom: {},
    });
    setDrawerOpen(true);
  };

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Contact Name',
      sortable: true,
      render: (contact) => (
        <div>
          <div className="font-medium text-foreground">
            {contact.firstName} {contact.lastName}
          </div>
          <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3 opacity-60" /> {contact.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      sortable: true,
      render: (contact) => (
        <span className="text-sm text-foreground">{contact.jobTitle || 'Executive'}</span>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      render: (contact) => {
        const accName = typeof contact.account === 'object' ? contact.account?.name : 'Account';
        return (
          <div className="flex items-center gap-1.5 text-foreground">
            <Building2 className="w-3.5 h-3.5 text-muted shrink-0" />
            <span>{accName}</span>
          </div>
        );
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (contact) => (
        <span className="text-xs text-muted flex items-center gap-1">
          <Phone className="w-3 h-3 opacity-60" /> {contact.phone || '-'}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (contact) => {
        const ownerName = typeof contact.owner === 'object' ? contact.owner?.name : 'Assigned';
        return <span className="text-xs text-muted">{ownerName}</span>;
      },
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (contact) => <span className="text-xs text-muted">{formatDate(contact.createdAt)}</span>,
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
        searchPlaceholder="Search contacts by name, email, job title..."
        sort={sort}
        onSortChange={setSort}
        pagination={responseData?.pagination}
        onPageChange={setPage}
        onRowClick={(contact) => navigate(`/contacts/${contact._id}`)}
        storageKey="flowdesk_cols_contacts"
        filterSlot={
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        }
        actionSlot={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleExportCSV}
              isLoading={isExporting}
              title="Export filtered contacts as CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setImportModalOpen(true)}
              title="Import contacts from CSV"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="primary" size="md" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              <span>Add Contact</span>
            </Button>
          </div>
        }
        emptyState={
          <EmptyState
            icon={ContactIcon}
            title="No contacts found"
            description="Manage your enterprise stakeholder relationships by adding a contact."
            actionLabel="Add Contact"
            onAction={handleOpenCreate}
          />
        }
      />

      {/* Drawer Form (Create / Edit) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedContact ? 'Edit Contact' : 'Create New Contact'}
        subtitle={selectedContact ? `ID: ${selectedContact._id}` : 'Add stakeholder or decision maker'}
        footer={
          <>
            <div>
              {selectedContact && canDelete && (
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
                {selectedContact ? 'Save Changes' : 'Create Contact'}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Aarav"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Sharma"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
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
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98200 12345"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Job Title
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              placeholder="e.g. VP of Engineering, Chief Strategy Officer"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Associated Account *
            </label>
            <select
              required
              value={formData.account}
              onChange={(e) => setFormData({ ...formData, account: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="" disabled>Select an account</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.city || a.industry})
                </option>
              ))}
            </select>
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
            entity="contact"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Contact"
        description={`Are you sure you want to permanently delete "${selectedContact?.firstName} ${selectedContact?.lastName}"? This action cannot be undone.`}
        confirmLabel="Delete Contact"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => selectedContact && deleteMutation.mutate(selectedContact._id)}
      />

      {/* CSV Import Wizard Modal */}
      <ImportWizardModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        entity="contact"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['contacts'] })}
      />
    </PageTransition>
  );
};
