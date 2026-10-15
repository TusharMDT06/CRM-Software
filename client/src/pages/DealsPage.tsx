import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { Plus, Trash2, Calendar, Building2, User2, AlertCircle, GripVertical, Download } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { PageTransition } from '../components/motion/PageTransition.js';
import { MOTION } from '../lib/motion.js';
import { Deal, DealStage, Account, Contact, User } from '../types/index.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Drawer } from '../components/ui/Drawer.js';
import { Modal } from '../components/ui/Modal.js';
import { formatINR, formatCompactINR, formatDate, isOverdue } from '../utils/formatters.js';
import { CustomFieldsSection } from '../components/custom-fields/CustomFieldsSection.js';

const STAGES: { stage: DealStage; label: string; color: string }[] = [
  { stage: 'qualified', label: 'Qualified', color: '#6F8BE8' },
  { stage: 'proposal', label: 'Proposal', color: '#8B7FE0' },
  { stage: 'negotiation', label: 'Negotiation', color: '#F07B2A' },
  { stage: 'won', label: 'Won', color: '#3FCB8A' },
  { stage: 'lost', label: 'Lost', color: '#B42318' },
];

export const DealsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, canDelete, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    account: '',
    contact: '',
    amount: 500000,
    stage: 'qualified' as DealStage,
    expectedClose: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    owner: '',
    custom: {} as Record<string, any>,
  });

  // Query Deals
  const { data: dealsData } = useQuery<{ data: Deal[] }>({
    queryKey: ['deals'],
    queryFn: async () => {
      const res = await api.get('/deals?limit=200&sort=createdAt:desc');
      return res.data;
    },
  });
  const deals = dealsData?.data || [];

  // Query Accounts for form
  const { data: accountsData } = useQuery({
    queryKey: ['accounts-dropdown'],
    queryFn: async () => {
      const res = await api.get('/accounts?limit=100');
      return res.data?.data || [];
    },
  });
  const accounts: Account[] = accountsData || [];

  // Query Contacts for form
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-dropdown'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=100');
      return res.data?.data || [];
    },
  });
  const contacts: Contact[] = contactsData || [];

  // Query Users for owner dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: isAdmin || isManager,
  });

  // Drag sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Update Stage Mutation with optimistic update
  const stageMutation = useMutation({
    mutationFn: async ({ dealId, newStage }: { dealId: string; newStage: DealStage }) => {
      const res = await api.patch(`/deals/${dealId}`, { stage: newStage });
      return res.data;
    },
    onMutate: async ({ dealId, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      const previousData = queryClient.getQueryData<{ data: Deal[] }>(['deals']);

      if (previousData) {
        queryClient.setQueryData<{ data: Deal[] }>(['deals'], {
          ...previousData,
          data: previousData.data.map((d) => (d._id === dealId ? { ...d, stage: newStage } : d)),
        });
      }
      return { previousData };
    },
    onError: (err: any, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['deals'], context.previousData);
      }
      error(err.message || 'Failed to update deal stage');
    },
    onSuccess: (updatedDeal) => {
      success(`Moved deal to ${updatedDeal.stage.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        contact: data.contact ? data.contact : undefined,
      };
      if (selectedDeal) {
        const res = await api.patch(`/deals/${selectedDeal._id}`, payload);
        return res.data;
      } else {
        const res = await api.post('/deals', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success(selectedDeal ? 'Deal updated successfully' : 'Deal created successfully');
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save deal');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/deals/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      success('Deal deleted successfully');
      setDeleteModalOpen(false);
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete deal');
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d._id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as DealStage;

    const currentDeal = deals.find((d) => d._id === dealId);
    if (currentDeal && currentDeal.stage !== newStage) {
      stageMutation.mutate({ dealId, newStage });
    }
  };

  const handleOpenCreateInStage = (stage: DealStage) => {
    setSelectedDeal(null);
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + 30);

    setFormData({
      title: '',
      account: accounts[0]?._id || '',
      contact: contacts[0]?._id || '',
      amount: 1000000,
      stage,
      expectedClose: closeDate.toISOString().split('T')[0],
      owner: user?._id || '',
      custom: {},
    });
    setDrawerOpen(true);
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const res = await api.get('/deals/export', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deals_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      success('Deals exported as CSV');
    } catch (err: any) {
      error(err.message || 'Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageTransition className="h-full flex flex-col gap-4">
      {/* Top Controls */}
      <div className="flex items-center justify-between shrink-0">
        <div className="text-sm text-muted">
          <span>Total pipeline deals: </span>
          <span className="font-semibold text-foreground">{deals.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCSV}
            isLoading={isExporting}
            title="Export all deals as CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => handleOpenCreateInStage('qualified')}
          >
            <Plus className="w-4 h-4" />
            <span>Create Deal</span>
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 overflow-x-auto pb-4 items-start min-h-0">
          {STAGES.map((col, colIndex) => {
            const stageDeals = deals.filter((d) => d.stage === col.stage);
            const totalAmount = stageDeals.reduce((sum, d) => sum + d.amount, 0);

            return (
              <KanbanColumn
                key={col.stage}
                stage={col.stage}
                label={col.label}
                color={col.color}
                deals={stageDeals}
                totalAmount={totalAmount}
                colIndex={colIndex}
                onCardClick={(deal) => navigate(`/deals/${deal._id}`)}
                onAddClick={() => handleOpenCreateInStage(col.stage)}
              />
            );
          })}
        </div>

        {/* Drag Overlay for active card preview */}
        <DragOverlay>
          {activeDeal ? (
            <div className="rotate-2 scale-105 transition-transform pointer-events-none opacity-90 shadow-2xl">
              <DealCard deal={activeDeal} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Drawer Form (Create / Edit) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedDeal ? 'Edit Deal' : 'Create New Deal'}
        subtitle={selectedDeal ? `ID: ${selectedDeal._id}` : 'Create sales opportunity'}
        footer={
          <>
            <div>
              {selectedDeal && canDelete && (
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
                {selectedDeal ? 'Save Changes' : 'Create Deal'}
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
              Deal Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Tata Digital - Loyalty Integration Suite"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Pipeline Stage *
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as DealStage })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="qualified">Qualified</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Account *
              </label>
              <select
                required
                value={formData.account}
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="" disabled>Select account</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Contact (Optional)
              </label>
              <select
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="">No contact</option>
                {contacts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Expected Close Date *
            </label>
            <input
              type="date"
              required
              value={formData.expectedClose}
              onChange={(e) => setFormData({ ...formData, expectedClose: e.target.value })}
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
            entity="deal"
            values={formData.custom}
            onChange={(custom) => setFormData({ ...formData, custom })}
          />
        </form>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Deal"
        description={`Are you sure you want to permanently delete "${selectedDeal?.title}"? This cannot be undone.`}
        confirmLabel="Delete Deal"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => selectedDeal && deleteMutation.mutate(selectedDeal._id)}
      />
    </PageTransition>
  );
};

// Kanban Column Subcomponent
interface KanbanColumnProps {
  stage: DealStage;
  label: string;
  color: string;
  deals: Deal[];
  totalAmount: number;
  colIndex: number;
  onCardClick: (deal: Deal) => void;
  onAddClick: () => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stage,
  label,
  color,
  deals,
  totalAmount,
  colIndex,
  onCardClick,
  onAddClick,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });
  const reducedMotion = useReducedMotion();
  const isFirstMountRef = React.useRef(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      isFirstMountRef.current = false;
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      ref={setNodeRef}
      initial={reducedMotion || !isFirstMountRef.current ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.25,
        delay: reducedMotion || !isFirstMountRef.current ? 0 : colIndex * 0.06,
        ease: MOTION.easing.easeOut,
      }}
      className={`flex flex-col bg-card rounded-card border transition-colors h-[calc(100vh-190px)] max-h-[760px] ${
        isOver
          ? 'border-neutral-400 dark:border-neutral-500 bg-[#F8F8FA] dark:bg-[#1E1E24]'
          : 'border-border'
      }`}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between shrink-0 bg-card rounded-t-card">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {label}
          </h3>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full font-medium bg-[#ECECEF] dark:bg-[#2A2A32] text-muted">
            {deals.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {formatCompactINR(totalAmount)}
          </span>
          <button
            onClick={onAddClick}
            title={`Add deal to ${label}`}
            className="p-1 rounded-md text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
        {deals.length === 0 ? (
          <div className="h-28 flex items-center justify-center text-xs text-muted border border-dashed border-border/60 rounded-xl m-1">
            Drag deals here
          </div>
        ) : (
          deals.map((deal, cardIndex) => (
            <DraggableDealCard
              key={deal._id}
              deal={deal}
              cardIndex={cardIndex}
              colIndex={colIndex}
              isFirstMount={isFirstMountRef.current}
              onClick={() => onCardClick(deal)}
            />
          ))
        )}
      </div>
    </motion.div>
  );
};

// Draggable Deal Card
const DraggableDealCard: React.FC<{
  deal: Deal;
  cardIndex: number;
  colIndex: number;
  isFirstMount: boolean;
  onClick: () => void;
}> = ({ deal, cardIndex, colIndex, isFirstMount, onClick }) => {
  const reducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal._id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const isStaggered = isFirstMount && cardIndex < 8 && !reducedMotion;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout={!isDragging && !reducedMotion}
      initial={isStaggered ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
      transition={{
        opacity: { duration: 0.2, delay: isStaggered ? colIndex * 0.06 + cardIndex * 0.03 : 0 },
        y: { duration: 0.2, delay: isStaggered ? colIndex * 0.06 + cardIndex * 0.03 : 0, ease: MOTION.easing.easeOut },
        layout: { duration: 0.2, ease: MOTION.easing.easeOut },
      }}
    >
      <DealCard deal={deal} onClick={onClick} dragHandleProps={{ ...listeners, ...attributes }} />
    </motion.div>
  );
};

// Deal Card Presentation
const DealCard: React.FC<{
  deal: Deal;
  onClick: () => void;
  dragHandleProps?: any;
}> = ({ deal, onClick, dragHandleProps }) => {
  const accountName = typeof deal.account === 'object' ? deal.account?.name : 'Account';
  const contactName =
    deal.contact && typeof deal.contact === 'object'
      ? `${(deal.contact as any)?.firstName || ''} ${(deal.contact as any)?.lastName || ''}`.trim() || null
      : null;
  const ownerName = typeof deal.owner === 'object' ? deal.owner?.name : 'Owner';
  const isOpen = deal.stage !== 'won' && deal.stage !== 'lost';
  const overdue = isOpen && isOverdue(deal.expectedClose);

  return (
    <div
      onClick={onClick}
      className="p-3 bg-card border border-border rounded-xl hover:border-neutral-400 dark:hover:border-neutral-600 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
    >
      {/* Top: Deal Title & Grip */}
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <h4 className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors line-clamp-2 leading-snug">
          {deal.title}
        </h4>
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="text-muted/50 hover:text-foreground cursor-grab active:cursor-grabbing p-0.5 rounded shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Meta: Account & Contact */}
      <div className="space-y-0.5 text-[11px] text-muted mb-2">
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="w-3 h-3 shrink-0 opacity-60" />
          <span className="truncate">{accountName}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <User2 className="w-3 h-3 shrink-0 opacity-60" />
          <span className={`truncate ${!contactName ? 'text-muted/50' : ''}`}>
            {contactName || 'No contact'}
          </span>
        </div>
      </div>

      {/* Bottom: Amount, Owner and Expected Close */}
      <div className="pt-2 border-t border-border/70 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">{formatINR(deal.amount)}</span>
          <span className="text-[10px] text-muted truncate max-w-[65px]">· {ownerName}</span>
        </div>

        <div
          className={`flex items-center gap-1 text-[10px] font-medium ${
            overdue
              ? 'text-[#B42318] dark:text-[#F87171] font-semibold'
              : 'text-muted'
          }`}
        >
          {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3 opacity-60" />}
          <span>{formatDate(deal.expectedClose)}</span>
        </div>
      </div>
    </div>
  );
};
