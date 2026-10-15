import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Plus, Trash2, Calendar, AlertCircle, CheckCircle2, Briefcase, Phone, Mail, Users, FileText } from 'lucide-react';
import { Task, Deal, User, TaskPriority, TaskStatus, TaskType } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { DataTable, Column } from '../components/common/DataTable.js';
import { Badge, getStatusBadgeVariant } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Drawer } from '../components/ui/Drawer.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { formatDate, isOverdue } from '../utils/formatters.js';
import { PageTransition } from '../components/motion/PageTransition.js';

export const TasksPage: React.FC = () => {
  const { user, canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sort, setSort] = useState('dueDate:asc');

  // Drawer & modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'open' as TaskStatus,
    priority: 'medium' as TaskPriority,
    type: 'todo' as TaskType,
    deal: '',
    owner: '',
  });

  // Query Tasks
  const { data: responseData, isLoading } = useQuery({
    queryKey: ['tasks', { page, search, statusFilter, priorityFilter, sort }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('q', search);
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (sort) params.append('sort', sort);

      const res = await api.get(`/tasks?${params.toString()}`);
      return res.data;
    },
  });

  // Query Deals for dropdown
  const { data: dealsData } = useQuery({
    queryKey: ['deals-dropdown'],
    queryFn: async () => {
      const res = await api.get('/deals?limit=100');
      return res.data?.data || [];
    },
  });
  const deals: Deal[] = dealsData || [];

  // Query Users for owner dropdown (admin/manager only)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: isAdmin || isManager,
  });

  // Toggle Done status mutation
  const toggleDoneMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: TaskStatus }) => {
      const res = await api.patch(`/tasks/${id}`, { status: newStatus });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success(vars.newStatus === 'done' ? 'Task marked as completed' : 'Task marked as open');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update task');
    },
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = { ...data };
      if (!payload.deal) payload.deal = null;

      if (selectedTask) {
        const res = await api.patch(`/tasks/${selectedTask._id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/tasks', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success(selectedTask ? 'Task updated successfully' : 'Task created successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save task');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/tasks/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success('Task deleted successfully');
      setDeleteModalOpen(false);
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete task');
    },
  });

  const handleOpenCreate = () => {
    setSelectedTask(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    setFormData({
      title: '',
      description: '',
      dueDate: tomorrow.toISOString().split('T')[0],
      status: 'open',
      priority: 'medium',
      type: 'todo',
      deal: '',
      owner: user?._id || '',
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    const dateFormatted = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
    setFormData({
      title: task.title,
      description: task.description || '',
      dueDate: dateFormatted,
      status: task.status,
      priority: task.priority,
      type: task.type || 'todo',
      deal: typeof task.deal === 'object' && task.deal ? task.deal._id : ((task.deal as unknown as string) || ''),
      owner: typeof task.owner === 'object' ? task.owner._id : (task.owner || ''),
    });
    setDrawerOpen(true);
  };

  const columns: Column<Task>[] = [
    {
      key: 'statusToggle',
      header: '',
      className: 'w-10 text-center',
      render: (task) => {
        const isDone = task.status === 'done';
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleDoneMutation.mutate({
                id: task._id,
                newStatus: isDone ? 'open' : 'done',
              });
            }}
            className="p-1 rounded-md text-muted hover:text-foreground transition-transform active:scale-95"
            aria-label="Toggle task status"
          >
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-[#3FCB8A]" />
            ) : (
              <div className="w-4 h-4 rounded border-2 border-muted hover:border-black dark:hover:border-white transition-colors" />
            )}
          </button>
        );
      },
    },
    {
      key: 'title',
      header: 'Task Title',
      sortable: true,
      render: (task) => {
        const isDone = task.status === 'done';
        return (
          <div className="max-w-md">
            <div
              className={`font-medium ${
                isDone ? 'line-through text-muted' : 'text-foreground'
              }`}
            >
              {task.title}
            </div>
            {task.description && (
              <p className="text-xs text-muted truncate mt-0.5">{task.description}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (task) => {
        const t = task.type || 'todo';
        const config: Record<string, { label: string; icon: any; color: string }> = {
          call: { label: 'Call', icon: Phone, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
          email: { label: 'Email', icon: Mail, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
          meeting: { label: 'Meeting', icon: Users, color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
          document: { label: 'Document', icon: FileText, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
          todo: { label: 'To-Do', icon: CheckSquare, color: 'text-slate-600 bg-slate-500/10 border-slate-500/20' },
        };
        const item = config[t] || config.todo;
        const Icon = item.icon;
        return (
          <span className={`text-xs capitalize font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${item.color}`}>
            <Icon className="w-3 h-3" />
            <span>{item.label}</span>
          </span>
        );
      },
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (task) => {
        const overdue = isOverdue(task.dueDate) && task.status === 'open';
        return (
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              overdue
                ? 'text-[#B42318] dark:text-[#F87171]'
                : task.status === 'done'
                ? 'text-muted'
                : 'text-foreground'
            }`}
          >
            {overdue ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Calendar className="w-3.5 h-3.5 shrink-0 opacity-60" />
            )}
            <span>{formatDate(task.dueDate)}</span>
            {overdue && <span className="text-[10px] font-semibold">(Overdue)</span>}
          </div>
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (task) => (
        <Badge variant={getStatusBadgeVariant(task.priority)}>
          {task.priority}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (task) => (
        <Badge variant={getStatusBadgeVariant(task.status)}>
          {task.status}
        </Badge>
      ),
    },
    {
      key: 'deal',
      header: 'Linked Deal',
      render: (task) => {
        const dealTitle = typeof task.deal === 'object' && task.deal ? task.deal.title : '-';
        if (dealTitle === '-') return <span className="text-muted text-xs">-</span>;
        return (
          <div className="flex items-center gap-1.5 text-xs text-foreground truncate max-w-[180px]">
            <Briefcase className="w-3 h-3 text-muted shrink-0" />
            <span className="truncate">{dealTitle}</span>
          </div>
        );
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (task) => {
        const ownerName = typeof task.owner === 'object' ? task.owner?.name : 'Assigned';
        return <span className="text-xs text-muted">{ownerName}</span>;
      },
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
        searchPlaceholder="Search tasks by title or description..."
        sort={sort}
        onSortChange={setSort}
        pagination={responseData?.pagination}
        onPageChange={setPage}
        onRowClick={handleOpenEdit}
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
              <option value="open">Open</option>
              <option value="done">Completed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-card border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        }
        actionSlot={
          <Button variant="primary" size="md" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </Button>
        }
        emptyState={
          <EmptyState
            icon={CheckSquare}
            title="No tasks scheduled"
            description="Keep your sales pipeline organized with timely action items and follow-ups."
            actionLabel="Add Task"
            onAction={handleOpenCreate}
          />
        }
      />

      {/* Drawer Form (Create / Edit) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedTask ? 'Edit Task' : 'Create New Task'}
        subtitle={selectedTask ? `ID: ${selectedTask._id}` : 'Schedule action item or client meeting'}
        footer={
          <>
            <div>
              {selectedTask && canDelete && (
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
                {selectedTask ? 'Save Changes' : 'Create Task'}
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
              Task Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Schedule demo follow-up with Tata CISO"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Task Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as TaskType })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="call">📞 Call</option>
                <option value="email">✉️ Email</option>
                <option value="meeting">👥 Meeting</option>
                <option value="document">📄 Document</option>
                <option value="todo">☑️ To-Do</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="open">Open</option>
                <option value="done">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Linked Deal (Optional)
              </label>
              <select
                value={formData.deal}
                onChange={(e) => setFormData({ ...formData, deal: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="">None (General Task)</option>
                {deals.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title}
                  </option>
                ))}
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
              Description / Action Items
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add agenda, call summary, meeting URL, or required assets..."
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>
        </form>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Task"
        description={`Are you sure you want to delete the task "${selectedTask?.title}"?`}
        confirmLabel="Delete Task"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => selectedTask && deleteMutation.mutate(selectedTask._id)}
      />
    </PageTransition>
  );
};
