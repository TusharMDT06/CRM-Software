import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Settings,
  Plus,
  GripVertical,
  Edit,
  Hash,
  Type,
  Calendar,
  List,
  CheckSquare,
  Globe,
} from 'lucide-react';
import { FieldDefinition, CustomFieldType } from '../types/index.js';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { PageTransition } from '../components/motion/PageTransition.js';
import { Reveal } from '../components/motion/Reveal.js';

interface SortableFieldRowProps {
  field: FieldDefinition;
  onEdit: (field: FieldDefinition) => void;
  onToggleActive: (field: FieldDefinition) => void;
}

const SortableFieldRow: React.FC<SortableFieldRowProps> = ({
  field,
  onEdit,
  onToggleActive,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const getTypeIcon = (type: CustomFieldType) => {
    switch (type) {
      case 'number':
        return <Hash className="w-3.5 h-3.5" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'select':
        return <List className="w-3.5 h-3.5" />;
      case 'checkbox':
        return <CheckSquare className="w-3.5 h-3.5" />;
      case 'url':
        return <Globe className="w-3.5 h-3.5" />;
      case 'text':
      default:
        return <Type className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3.5 bg-card border rounded-xl transition-all ${
        field.active ? 'border-border' : 'border-border/50 bg-[#FAFAFA] dark:bg-[#1C1C22]/60 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-foreground touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">{field.label}</span>
            <code className="text-[11px] font-mono text-muted bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {field.key}
            </code>
            {field.required && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                Required
              </span>
            )}
            {!field.active && (
              <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                Inactive
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
            <span className="capitalize flex items-center gap-1">
              {getTypeIcon(field.type)}
              {field.type}
            </span>
            {field.options && field.options.length > 0 && (
              <span>• Options: {field.options.join(', ')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onToggleActive(field)}
          className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
            field.active
              ? 'text-muted hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
          }`}
          title={field.active ? 'Deactivate field' : 'Reactivate field'}
        >
          {field.active ? 'Deactivate' : 'Activate'}
        </button>

        <button
          type="button"
          onClick={() => onEdit(field)}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
          title="Edit field properties"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const CustomFieldsSettingsPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [activeEntity, setActiveEntity] = useState<'lead' | 'contact' | 'account' | 'deal'>('lead');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldDefinition | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    label: '',
    key: '',
    type: 'text' as CustomFieldType,
    optionsString: '',
    required: false,
    active: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Query Fields
  const { data: fields = [], isLoading } = useQuery<FieldDefinition[]>({
    queryKey: ['custom-fields', activeEntity],
    queryFn: async () => {
      const res = await api.get(`/custom-fields?entity=${activeEntity}`);
      return res.data;
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await api.patch('/custom-fields/reorder', { orderedIds });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', activeEntity] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to reorder custom fields');
    },
  });

  // Save mutation (Create / Update)
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (selectedField) {
        const res = await api.patch(`/custom-fields/${selectedField._id}`, {
          label: data.label,
          options: data.options,
          required: data.required,
          active: data.active,
        });
        return res.data;
      } else {
        const res = await api.post('/custom-fields', {
          entity: activeEntity,
          key: data.key,
          label: data.label,
          type: data.type,
          options: data.options,
          required: data.required,
        });
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', activeEntity] });
      success(selectedField ? 'Custom field updated' : 'Custom field created');
      setModalOpen(false);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save custom field');
    },
  });

  // Toggle active mutation (Deactivate soft delete)
  const toggleActiveMutation = useMutation({
    mutationFn: async (field: FieldDefinition) => {
      if (field.active) {
        // Soft delete endpoint
        const res = await api.delete(`/custom-fields/${field._id}`);
        return res.data;
      } else {
        const res = await api.patch(`/custom-fields/${field._id}`, { active: true });
        return res.data;
      }
    },
    onSuccess: (_, field) => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields', activeEntity] });
      success(field.active ? 'Field deactivated' : 'Field reactivated');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update field status');
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f._id === active.id);
      const newIndex = fields.findIndex((f) => f._id === over.id);
      const reordered = arrayMove(fields, oldIndex, newIndex);
      reorderMutation.mutate(reordered.map((f) => f._id));
    }
  };

  const handleOpenCreate = () => {
    setSelectedField(null);
    setFormData({
      label: '',
      key: '',
      type: 'text',
      optionsString: '',
      required: false,
      active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (field: FieldDefinition) => {
    setSelectedField(field);
    setFormData({
      label: field.label,
      key: field.key,
      type: field.type,
      optionsString: (field.options || []).join(', '),
      required: field.required,
      active: field.active,
    });
    setModalOpen(true);
  };

  const handleLabelChange = (lbl: string) => {
    const slug = lbl
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
    setFormData((prev) => ({
      ...prev,
      label: lbl,
      key: selectedField ? prev.key : slug,
    }));
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const options =
      formData.type === 'select'
        ? formData.optionsString
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    saveMutation.mutate({
      ...formData,
      options,
    });
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Settings className="w-6 h-6 text-brand" />
              <span>Custom Fields</span>
            </h1>
            <p className="text-xs text-muted mt-1">
              Configure custom metadata attributes across Leads, Contacts, Accounts, and Deals.
            </p>
          </div>

          <Button variant="primary" size="md" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            <span>Add Custom Field</span>
          </Button>
        </div>
      </Reveal>

      {/* Entity Tabs */}
      <Reveal delay={0.06}>
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {(['lead', 'contact', 'account', 'deal'] as const).map((ent) => (
            <button
              key={ent}
              onClick={() => setActiveEntity(ent)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                activeEntity === ent
                  ? 'bg-card text-foreground shadow-sm border border-border dark:bg-[#202025]'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {ent}s
            </button>
          ))}
        </div>
      </Reveal>

      {/* Fields List */}
      <Reveal delay={0.12}>
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : fields.length === 0 ? (
          <EmptyState
            icon={Settings}
            title={`No custom fields configured for ${activeEntity}s`}
            description="Add custom properties to track business-specific data."
            actionLabel="Add Field"
            onAction={handleOpenCreate}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f._id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2.5">
                {fields.map((field) => (
                  <SortableFieldRow
                    key={field._id}
                    field={field}
                    onEdit={handleOpenEdit}
                    onToggleActive={(f) => toggleActiveMutation.mutate(f)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      </Reveal>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedField ? 'Edit Custom Field' : `Add ${activeEntity} Custom Field`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveSubmit}
              isLoading={saveMutation.isPending}
              disabled={!formData.label.trim() || !formData.key.trim()}
            >
              {selectedField ? 'Save Changes' : 'Create Field'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Field Label *</label>
            <input
              type="text"
              required
              value={formData.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g. GST Number, Contract Tier"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Field Key (Slug) *
            </label>
            <input
              type="text"
              required
              disabled={Boolean(selectedField)}
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="e.g. gst_number"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed font-mono"
            />
            {selectedField && (
              <p className="text-[10px] text-muted mt-1">
                Field key is immutable after creation to protect existing stored records.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Field Type</label>
              <select
                disabled={Boolean(selectedField)}
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as CustomFieldType })
                }
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none disabled:opacity-60"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Select Dropdown</option>
                <option value="checkbox">Checkbox (Boolean)</option>
                <option value="url">URL Link</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="cf-req"
                checked={formData.required}
                onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                className="w-4 h-4 rounded border-border text-black dark:text-white"
              />
              <label htmlFor="cf-req" className="text-xs font-medium text-foreground cursor-pointer">
                Required Field
              </label>
            </div>
          </div>

          {formData.type === 'select' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Options (Comma separated) *
              </label>
              <input
                type="text"
                required
                value={formData.optionsString}
                onChange={(e) => setFormData({ ...formData, optionsString: e.target.value })}
                placeholder="Bronze, Silver, Gold, Platinum"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none"
              />
            </div>
          )}
        </form>
      </Modal>
    </PageTransition>
  );
};
