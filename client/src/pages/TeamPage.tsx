import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserX, UserCheck, KeyRound, Mail, Calendar, Edit3 } from 'lucide-react';
import { User, UserRole } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { DataTable, Column } from '../components/common/DataTable.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Drawer } from '../components/ui/Drawer.js';
import { Modal } from '../components/ui/Modal.js';
import { formatDate } from '../utils/formatters.js';
import { PageTransition } from '../components/motion/PageTransition.js';

export const TeamPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Password reset modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const [inviteViaEmail, setInviteViaEmail] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'sales' as UserRole,
    active: true,
  });

  // Query Users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  // Save / Update User Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (selectedUser) {
        const payload: any = {
          name: data.name,
          role: data.role,
          active: data.active,
        };
        if (data.email !== selectedUser.email) payload.email = data.email;
        if (data.password) payload.password = data.password;

        const res = await api.patch(`/users/${selectedUser._id}`, payload);
        return res.data;
      } else {
        if (inviteViaEmail) {
          const res = await api.post('/users/invite', {
            name: data.name,
            email: data.email,
            role: data.role,
          });
          return res.data;
        } else {
          const res = await api.post('/users', data);
          return res.data;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      success(selectedUser ? 'User updated successfully' : 'Team member invitation sent successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save user');
    },
  });

  // Toggle Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const res = await api.patch(`/users/${userId}`, { active });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      success(`User ${data.name} is now ${data.active ? 'active' : 'disabled'}`);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update user status');
    },
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const res = await api.patch(`/users/${userId}`, { password });
      return res.data;
    },
    onSuccess: () => {
      success('Password reset successfully');
      setResetModalOpen(false);
      setNewPassword('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to reset password');
    },
  });

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      password: 'Password@123',
      role: 'sales',
      active: true,
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setSelectedUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      active: u.active,
    });
    setDrawerOpen(true);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Member',
      render: (u) => (
        <div>
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <span>{u.name}</span>
            {currentUser?._id === u._id && (
              <span className="text-[10px] text-muted font-normal">(You)</span>
            )}
          </div>
          <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3 opacity-60" /> {u.email}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <Badge
          variant={
            u.role === 'admin'
              ? 'warning'
              : u.role === 'manager'
              ? 'success'
              : 'info'
          }
        >
          {u.role}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Account Status',
      render: (u) => (
        <Badge variant={u.active ? 'success' : 'danger'}>
          {u.active ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u) => (
        <span className="text-xs text-muted flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 opacity-60" /> {formatDate(u.createdAt || '')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Quick Actions',
      render: (u) => {
        const isSelf = currentUser?._id === u._id;
        return (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleOpenEdit(u)}
              title="Edit member"
              className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setSelectedUser(u);
                setNewPassword('');
                setResetModalOpen(true);
              }}
              title="Reset password"
              className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            {!isSelf && (
              <button
                onClick={() =>
                  toggleActiveMutation.mutate({ userId: u._id, active: !u.active })
                }
                title={u.active ? 'Disable user' : 'Activate user'}
                className={`p-1.5 rounded-lg border border-border transition-colors ${
                  u.active
                    ? 'text-muted hover:text-[#B42318] hover:bg-[#FDE4E4]/30'
                    : 'text-[#15803D] hover:bg-[#DDF6E8]/40'
                }`}
              >
                {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PageTransition className="space-y-4">
      <DataTable
        columns={columns}
        data={filteredUsers}
        isLoading={isLoading}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search team members by name or email..."
        onRowClick={handleOpenEdit}
        filterSlot={
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="sales">Sales</option>
          </select>
        }
        actionSlot={
          <Button variant="primary" size="md" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </Button>
        }
      />

      {/* Drawer Form (Create / Edit User) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedUser ? 'Edit Team Member' : 'Invite New Team Member'}
        subtitle={selectedUser ? `User: ${selectedUser.email}` : 'Add user with role permissions'}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => saveMutation.mutate(formData)}
              isLoading={saveMutation.isPending}
            >
              {selectedUser ? 'Save Member' : 'Add Member'}
            </Button>
          </div>
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
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Vikram Malhotra"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="vikram@crm.test"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Role & Permissions *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="sales">Sales (Own records view & edit only)</option>
              <option value="manager">Manager (All records, delete allowed, assign owners)</option>
              <option value="admin">Admin (Full system control, manage team)</option>
            </select>
          </div>

          {!selectedUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="inviteViaEmail"
                  checked={inviteViaEmail}
                  onChange={(e) => setInviteViaEmail(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-black focus:ring-0"
                />
                <label htmlFor="inviteViaEmail" className="text-xs font-semibold text-foreground cursor-pointer">
                  Send email invitation (7-day single use token)
                </label>
              </div>

              {!inviteViaEmail && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required={!inviteViaEmail}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Account Status
              </label>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    disabled={currentUser?._id === selectedUser._id}
                    className="w-4 h-4 rounded border-border text-black focus:ring-0"
                  />
                  <span>Active (Allow CRM login)</span>
                </label>
              </div>
            </div>
          )}
        </form>
      </Drawer>

      {/* Password Reset Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset User Password"
        description={`Set a new temporary password for ${selectedUser?.name} (${selectedUser?.email}).`}
        confirmLabel="Update Password"
        confirmVariant="primary"
        isLoading={resetPasswordMutation.isPending}
        onConfirm={() => {
          if (newPassword.length < 6) {
            error('Password must be at least 6 characters');
            return;
          }
          if (selectedUser) {
            resetPasswordMutation.mutate({ userId: selectedUser._id, password: newPassword });
          }
        }}
      >
        <div className="pt-2">
          <label className="block text-xs font-medium text-foreground mb-1">
            New Password (minimum 6 chars)
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
          />
        </div>
      </Modal>
    </PageTransition>
  );
};
