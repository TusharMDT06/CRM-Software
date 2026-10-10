import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  Plus,
  Play,
  History,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import {
  fetchWorkflows,
  createWorkflow,
  updateWorkflow,
  toggleWorkflow,
  deleteWorkflow,
  testWorkflowDryRun,
  fetchWorkflowRuns,
} from '../api/phase3.js';
import { api } from '../api/client.js';
import {
  Workflow,
  WorkflowCondition,
  WorkflowAction,
  WorkflowRun,
} from '../types/index.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';

export const AutomationsPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [testModalWorkflow, setTestModalWorkflow] = useState<Workflow | null>(null);
  const [historyWorkflow, setHistoryWorkflow] = useState<Workflow | null>(null);

  // Builder Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('deal_created');
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [actions, setActions] = useState<WorkflowAction[]>([
    { type: 'create_task', config: { taskTitle: 'Follow up with {record.name}', taskDueInDays: 1, taskAssignee: 'owner' } },
  ]);
  const [stopOnError, setStopOnError] = useState(false);

  // Test Dry-run state
  const [testEntityType, setTestEntityType] = useState('deal');
  const [testEntityId, setTestEntityId] = useState('');
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const { data: workflowsData, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => fetchWorkflows(),
  });

  const { data: dealsData } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => (await api.get('/deals')).data,
    enabled: Boolean(testModalWorkflow),
  });

  const { data: leadsData } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get('/leads')).data,
    enabled: Boolean(testModalWorkflow),
  });

  const { data: runsData } = useQuery({
    queryKey: ['workflowRuns', historyWorkflow?._id],
    queryFn: () => fetchWorkflowRuns(historyWorkflow!._id),
    enabled: Boolean(historyWorkflow),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleWorkflow(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      success(res.message);
    },
    onError: (err: any) => {
      error(err.message || 'Failed to toggle workflow');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      success('Workflow deleted successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete workflow');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingWorkflow) {
        return await updateWorkflow(editingWorkflow._id, payload);
      } else {
        return await createWorkflow(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      success(editingWorkflow ? 'Workflow updated' : 'Workflow created');
      setIsBuilderOpen(false);
      resetBuilder();
    },
    onError: (err: any) => {
      error(err.message || 'Failed to save workflow');
    },
  });

  const dryRunMutation = useMutation({
    mutationFn: ({ id, entityType, entityId }: { id: string; entityType: string; entityId: string }) =>
      testWorkflowDryRun(id, entityType, entityId),
    onSuccess: (res) => {
      setDryRunResult(res);
    },
    onError: (err: any) => {
      error(err.message || 'Dry-run test failed');
    },
  });

  const resetBuilder = () => {
    setEditingWorkflow(null);
    setName('');
    setDescription('');
    setTriggerType('deal_created');
    setTriggerConfig({});
    setConditions([]);
    setActions([{ type: 'create_task', config: { taskTitle: 'Follow up with {record.name}', taskDueInDays: 1, taskAssignee: 'owner' } }]);
    setStopOnError(false);
  };

  const handleOpenCreate = () => {
    resetBuilder();
    setIsBuilderOpen(true);
  };

  const handleOpenEdit = (w: Workflow) => {
    setEditingWorkflow(w);
    setName(w.name);
    setDescription(w.description || '');
    setTriggerType(w.trigger.type);
    setTriggerConfig(w.trigger.config || {});
    setConditions(w.conditions || []);
    setActions(w.actions || []);
    setStopOnError(w.stopOnError || false);
    setIsBuilderOpen(true);
  };

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      { field: 'amount', operator: 'greater_than', value: 100000 },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleAddAction = (type: WorkflowAction['type']) => {
    setActions([
      ...actions,
      { type, config: {} },
    ]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSaveWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Workflow name is required');
      return;
    }
    if (actions.length === 0) {
      error('At least one action is required');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      enabled: editingWorkflow ? editingWorkflow.enabled : true,
      stopOnError,
      trigger: {
        type: triggerType,
        config: triggerConfig,
      },
      conditions,
      actions,
    };

    saveMutation.mutate(payload);
  };

  const handleExecuteDryRun = () => {
    if (!testModalWorkflow || !testEntityId) {
      error('Please pick a record to test against');
      return;
    }
    dryRunMutation.mutate({
      id: testModalWorkflow._id,
      entityType: testEntityType,
      entityId: testEntityId,
    });
  };

  const workflows = workflowsData?.data || [];

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      {/* Header */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-[#F07B2A]" />
              Workflow Automations
            </h1>
            <p className="text-sm text-muted mt-1">
              Automate task assignment, deal notifications, email follow-ups, and round-robin lead allocation.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Automation
          </button>
        </div>
      </Reveal>

      {/* Workflows List Card */}
      <Reveal direction="up" delay={0.05}>
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] dark:bg-[#202025] flex items-center justify-center text-muted mb-3">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No automations configured</h3>
              <p className="text-xs text-muted mt-1 max-w-sm">
                Create event-driven workflows to streamline lead qualification and notification processes.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {workflows.map((wf) => (
                <div
                  key={wf._id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E24]/40 transition-colors"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-foreground text-base">{wf.name}</h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] text-muted">
                        {wf.trigger.type.replace('_', ' ')}
                      </span>
                      {wf.enabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                          Disabled
                        </span>
                      )}
                    </div>

                    {wf.description && (
                      <p className="text-xs text-muted line-clamp-1">{wf.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-muted pt-1">
                      <span>Conditions: <strong>{wf.conditions.length}</strong></span>
                      <span>Actions: <strong>{wf.actions.length}</strong></span>
                      <span>Total Executions: <strong>{wf.runCount || 0}</strong></span>
                      {wf.lastRunAt && (
                        <span>Last Run: {new Date(wf.lastRunAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {/* Toggle Button */}
                    <button
                      onClick={() => toggleMutation.mutate(wf._id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        wf.enabled
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800'
                          : 'border-border text-muted hover:text-foreground'
                      }`}
                    >
                      {wf.enabled ? 'Active' : 'Turn On'}
                    </button>

                    {/* Test Dry-Run Button */}
                    <button
                      onClick={() => {
                        setTestModalWorkflow(wf);
                        setDryRunResult(null);
                        setTestEntityId('');
                      }}
                      title="Test Dry Run"
                      className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>

                    {/* Execution History */}
                    <button
                      onClick={() => setHistoryWorkflow(wf)}
                      title="View Run History"
                      className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleOpenEdit(wf)}
                      title="Edit Workflow"
                      className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (confirm(`Delete workflow "${wf.name}"?`)) {
                          deleteMutation.mutate(wf._id);
                        }
                      }}
                      title="Delete Workflow"
                      className="p-2 rounded-xl border border-border text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      {/* Step-Based Builder Drawer / Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-100 text-[#F07B2A] dark:bg-orange-950/40">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {editingWorkflow ? 'Edit Workflow' : 'Create Automation Workflow'}
                  </h2>
                  <p className="text-xs text-muted">Step-based trigger, filter conditions, and action execution.</p>
                </div>
              </div>
              <button onClick={() => setIsBuilderOpen(false)} className="p-1 rounded-lg text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkflow} className="space-y-6">
              {/* General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Workflow Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Notify Manager for Enterprise Deals"
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief summary of why this automation runs..."
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>
              </div>

              {/* Step 1: WHEN THIS HAPPENS */}
              <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                  <span className="w-5 h-5 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px]">1</span>
                  When this happens (Trigger)
                </div>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground font-medium focus:outline-hidden"
                >
                  <option value="lead_created">New Lead Created</option>
                  <option value="deal_created">New Deal Created</option>
                  <option value="deal_stage_changed">Deal Stage Changed</option>
                  <option value="deal_won">Deal Won</option>
                  <option value="deal_lost">Deal Lost</option>
                  <option value="task_overdue">Task Overdue</option>
                  <option value="quote_accepted">Quote Accepted by Client</option>
                  <option value="quote_declined">Quote Declined by Client</option>
                  <option value="invoice_overdue">Invoice Overdue</option>
                  <option value="invoice_paid">Invoice Paid</option>
                </select>
              </div>

              {/* Step 2: ONLY IF (Conditions) */}
              <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <span className="w-5 h-5 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px]">2</span>
                    Only If (Conditions - all must match)
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="text-xs font-semibold text-foreground hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Filter
                  </button>
                </div>

                {conditions.length === 0 ? (
                  <p className="text-xs text-muted italic">No conditions set. This automation will run for every trigger event.</p>
                ) : (
                  <div className="space-y-2">
                    {conditions.map((cond, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Field (e.g. amount, source)"
                          value={cond.field}
                          onChange={(e) => {
                            const newConds = [...conditions];
                            newConds[idx].field = e.target.value;
                            setConditions(newConds);
                          }}
                          className="flex-1 px-2.5 py-1 text-xs bg-card border border-border rounded-lg text-foreground"
                        />
                        <select
                          value={cond.operator}
                          onChange={(e) => {
                            const newConds = [...conditions];
                            newConds[idx].operator = e.target.value as any;
                            setConditions(newConds);
                          }}
                          className="w-32 px-2 py-1 text-xs bg-card border border-border rounded-lg text-foreground"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="greater_than">greater than</option>
                          <option value="less_than">less than</option>
                          <option value="contains">contains</option>
                          <option value="is_empty">is empty</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Value"
                          value={cond.value || ''}
                          onChange={(e) => {
                            const newConds = [...conditions];
                            newConds[idx].value = e.target.value;
                            setConditions(newConds);
                          }}
                          className="flex-1 px-2.5 py-1 text-xs bg-card border border-border rounded-lg text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(idx)}
                          className="p-1 text-muted hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 3: THEN DO (Actions) */}
              <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                    <span className="w-5 h-5 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-[10px]">3</span>
                    Then do (Actions in order)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddAction('create_task')}
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-card border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      + Task
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddAction('send_notification')}
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-card border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      + Notification
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddAction('assign_owner')}
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-card border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      + Round Robin
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {actions.map((act, idx) => (
                    <div key={idx} className="p-3 bg-card border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                          Action {idx + 1}: {act.type.replace('_', ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAction(idx)}
                          className="text-muted hover:text-red-500 text-xs"
                        >
                          Remove
                        </button>
                      </div>

                      {act.type === 'create_task' && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] text-muted mb-1">Task Title</label>
                            <input
                              type="text"
                              value={act.config.taskTitle || ''}
                              onChange={(e) => {
                                const newActs = [...actions];
                                newActs[idx].config.taskTitle = e.target.value;
                                setActions(newActs);
                              }}
                              placeholder="Follow up with {record.name}"
                              className="w-full px-2 py-1 border border-border rounded-lg text-foreground bg-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted mb-1">Due in (Days)</label>
                            <input
                              type="number"
                              min="1"
                              value={act.config.taskDueInDays || 1}
                              onChange={(e) => {
                                const newActs = [...actions];
                                newActs[idx].config.taskDueInDays = parseInt(e.target.value) || 1;
                                setActions(newActs);
                              }}
                              className="w-full px-2 py-1 border border-border rounded-lg text-foreground bg-transparent"
                            />
                          </div>
                        </div>
                      )}

                      {act.type === 'send_notification' && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] text-muted mb-1">Recipient</label>
                            <select
                              value={act.config.notificationRecipient || 'owner'}
                              onChange={(e) => {
                                const newActs = [...actions];
                                newActs[idx].config.notificationRecipient = e.target.value;
                                setActions(newActs);
                              }}
                              className="w-full px-2 py-1 border border-border rounded-lg text-foreground bg-card"
                            >
                              <option value="owner">Record Owner</option>
                              <option value="managers">All Managers & Admins</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted mb-1">Alert Title</label>
                            <input
                              type="text"
                              value={act.config.notificationTitle || ''}
                              onChange={(e) => {
                                const newActs = [...actions];
                                newActs[idx].config.notificationTitle = e.target.value;
                                setActions(newActs);
                              }}
                              placeholder="Action required"
                              className="w-full px-2 py-1 border border-border rounded-lg text-foreground bg-transparent"
                            />
                          </div>
                        </div>
                      )}

                      {act.type === 'assign_owner' && (
                        <p className="text-[11px] text-muted">
                          Automatically distributes records evenly across active sales reps in round-robin order.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-muted">
                  <input
                    type="checkbox"
                    checked={stopOnError}
                    onChange={(e) => setStopOnError(e.target.checked)}
                    className="w-4 h-4 rounded text-black focus:ring-0"
                  />
                  Stop on Error (halt workflow if a step fails)
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBuilderOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold border border-border rounded-xl text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="px-5 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black rounded-xl hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Workflow'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Dry-Run Modal */}
      {testModalWorkflow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-foreground">
                  Dry-Run Test: {testModalWorkflow.name}
                </h3>
              </div>
              <button onClick={() => setTestModalWorkflow(null)} className="p-1 rounded-lg text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted">
              Select a record to simulate this workflow. Dry-run evaluates triggers and filters without modifying records.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Entity Type</label>
                <select
                  value={testEntityType}
                  onChange={(e) => setTestEntityType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground"
                >
                  <option value="deal">Deal</option>
                  <option value="lead">Lead</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Pick Record</label>
                <select
                  value={testEntityId}
                  onChange={(e) => setTestEntityId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground"
                >
                  <option value="">-- Choose Record --</option>
                  {testEntityType === 'deal'
                    ? (dealsData?.data || []).map((d: any) => (
                        <option key={d._id} value={d._id}>{d.title}</option>
                      ))
                    : (leadsData?.data || []).map((l: any) => (
                        <option key={l._id} value={l._id}>{l.name} ({l.company})</option>
                      ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleExecuteDryRun}
              disabled={dryRunMutation.isPending || !testEntityId}
              className="w-full py-2 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {dryRunMutation.isPending ? 'Simulating...' : 'Run Simulation'}
            </button>

            {/* Dry Run Outcome */}
            {dryRunResult && (
              <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Overall Result:</span>
                  {dryRunResult.matched ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Would Trigger Actions!
                    </span>
                  ) : (
                    <span className="text-neutral-500 font-semibold flex items-center gap-1">
                      <XCircle className="w-4 h-4" /> Conditions Not Met (Skipped)
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="font-semibold block text-foreground">Conditions Evaluated:</span>
                  {dryRunResult.conditionResults.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] p-1.5 bg-card rounded-lg border border-border">
                      <span>{c.field} {c.operator} {c.expected}</span>
                      <span className={c.passed ? 'text-emerald-600 font-bold' : 'text-red-500 font-semibold'}>
                        {c.passed ? 'Passed (Actual: ' + c.actual + ')' : 'Failed (Actual: ' + c.actual + ')'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Execution Run History Drawer / Modal */}
      {historyWorkflow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-foreground" />
                <h3 className="text-base font-bold text-foreground">
                  Run History: {historyWorkflow.name}
                </h3>
              </div>
              <button onClick={() => setHistoryWorkflow(null)} className="p-1 rounded-lg text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {runsData?.data?.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">
                No recorded executions for this workflow yet.
              </p>
            ) : (
              <div className="space-y-3">
                {runsData?.data?.map((run: WorkflowRun) => (
                  <div key={run._id} className="p-4 rounded-xl border border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Triggered on {run.triggerEntity.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        run.status === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : run.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {run.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted">
                      Executed at: {new Date(run.startedAt).toLocaleString()}
                    </div>

                    {run.steps?.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {run.steps.map((st, i) => (
                          <div key={i} className="text-[11px] flex items-center gap-2">
                            <span className={st.status === 'success' ? 'text-emerald-600' : 'text-red-500'}>
                              {st.status === 'success' ? '✓' : '✗'}
                            </span>
                            <span className="font-medium text-foreground">{st.action}:</span>
                            <span className="text-muted">{st.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {run.error && (
                      <div className="text-red-600 font-mono text-[11px] bg-red-50 dark:bg-red-950/30 p-2 rounded-lg">
                        Error: {run.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
