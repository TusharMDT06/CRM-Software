import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  Plus,
  Play,
  Pause,
  KeyRound,
  RotateCw,
  Send,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Layers,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  getLeadSources,
  createLeadSource,
  updateLeadSource,
  rotateLeadSourceSecret,
  sendTestLead,
  getLeadSourceEvents,
  replayLeadEvent,
} from '../../api/marketing.js';
import { LeadSourceItem, LeadEventItem } from '../../types/index.js';
import { useToast } from '../../context/ToastContext.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Drawer } from '../../components/ui/Drawer.js';
import { PageTransition } from '../../components/motion/PageTransition.js';
import { Reveal } from '../../components/motion/Reveal.js';

export const LeadSourcesPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSourceForEvents, setSelectedSourceForEvents] = useState<LeadSourceItem | null>(null);
  const [newApiKeyModalData, setNewApiKeyModalData] = useState<{ name: string; apiKey?: string; webhookId: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // New source form state
  const [formData, setFormData] = useState<{
    name: string;
    type: 'generic_webhook' | 'website_form';
    fieldMappingJson: string;
  }>({
    name: '',
    type: 'generic_webhook',
    fieldMappingJson: '{\n  "name": "full_name",\n  "email": "email",\n  "phone": "phone",\n  "company": "company_name"\n}',
  });

  // Query sources
  const { data: sources = [], isLoading, refetch } = useQuery<LeadSourceItem[]>({
    queryKey: ['leadSources'],
    queryFn: getLeadSources,
  });

  // Query events for drawer
  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery<{
    events: LeadEventItem[];
    pagination: any;
  }>({
    queryKey: ['sourceEvents', selectedSourceForEvents?._id],
    queryFn: () => getLeadSourceEvents(selectedSourceForEvents!._id),
    enabled: Boolean(selectedSourceForEvents?._id),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      let mapping = {};
      if (formData.type === 'generic_webhook' && formData.fieldMappingJson.trim()) {
        try {
          mapping = JSON.parse(formData.fieldMappingJson);
        } catch (_) {
          throw new Error('Field mapping must be valid JSON');
        }
      }
      return createLeadSource({
        name: formData.name,
        type: formData.type,
        config: { fieldMapping: mapping },
      });
    },
    onSuccess: (data) => {
      success('Lead source created successfully');
      setCreateModalOpen(false);
      setFormData({
        name: '',
        type: 'generic_webhook',
        fieldMappingJson: '{\n  "name": "full_name",\n  "email": "email",\n  "phone": "phone",\n  "company": "company_name"\n}',
      });
      queryClient.invalidateQueries({ queryKey: ['leadSources'] });

      if (data.apiKey) {
        setNewApiKeyModalData({
          name: data.source.name,
          apiKey: data.apiKey,
          webhookId: data.source.webhookId,
        });
      }
    },
    onError: (err: any) => {
      error(err.message || 'Failed to create lead source');
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ source, newStatus }: { source: LeadSourceItem; newStatus: 'active' | 'paused' }) => {
      return updateLeadSource(source._id, { status: newStatus });
    },
    onSuccess: () => {
      success('Lead source status updated');
      queryClient.invalidateQueries({ queryKey: ['leadSources'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update status');
    },
  });

  // Rotate secret mutation
  const rotateSecretMutation = useMutation({
    mutationFn: async (source: LeadSourceItem) => {
      return rotateLeadSourceSecret(source._id);
    },
    onSuccess: (data, source) => {
      success('Secret rotated successfully');
      queryClient.invalidateQueries({ queryKey: ['leadSources'] });
      if (data.apiKey) {
        setNewApiKeyModalData({
          name: source.name,
          apiKey: data.apiKey,
          webhookId: data.webhookId,
        });
      }
    },
    onError: (err: any) => {
      error(err.message || 'Failed to rotate secret');
    },
  });

  // Test lead mutation
  const testLeadMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return sendTestLead(sourceId);
    },
    onSuccess: () => {
      success('Test lead dispatched! Lead marked with "Test" badge and pipeline verified.');
      queryClient.invalidateQueries({ queryKey: ['leadSources'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (selectedSourceForEvents) {
        refetchEvents();
      }
    },
    onError: (err: any) => {
      error(err.message || 'Failed to dispatch test lead');
    },
  });

  // Replay event mutation
  const replayMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return replayLeadEvent(eventId);
    },
    onSuccess: () => {
      success('Event replayed successfully');
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ['leadSources'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to replay event');
    },
  });

  const getPlatformLabel = (type: string) => {
    switch (type) {
      case 'generic_webhook':
        return 'Generic Webhook (API / Zapier)';
      case 'website_form':
        return 'Website Form';
      case 'google_ads':
        return 'Google Ads';
      case 'meta_lead_ads':
        return 'Meta Lead Ads (FB / IG)';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
            Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Error
          </span>
        );
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Top Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Radio className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Lead Intake Sources
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Connect website forms, Zapier, Google Ads, and Meta Lead Ads with automatic attribution and zero duplicates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Source</span>
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Sources Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-56 bg-card border border-border rounded-2xl animate-pulse p-5 space-y-4"
            />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Radio className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No Lead Sources Connected</h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                Create a generic webhook or website form to start ingesting leads automatically into Flowdesk with attribution.
              </p>
            </div>
            <Button variant="primary" size="md" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Create First Source</span>
            </Button>
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sources.map((source, index) => (
            <Reveal key={source._id} delay={0.05 * index}>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-primary/40 transition-all">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-foreground truncate">{source.name}</h3>
                      <p className="text-[11px] text-muted">{getPlatformLabel(source.type)}</p>
                    </div>
                    {getStatusBadge(source.status)}
                  </div>

                  {/* Webhook Endpoint Info */}
                  <div className="p-2.5 rounded-xl bg-card-subtle border border-border space-y-1 text-xs font-mono">
                    <span className="text-[10px] text-muted block uppercase font-sans font-semibold">
                      {source.type === 'website_form' ? 'Hosted Form Link' : 'Webhook Ingest URL'}
                    </span>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-foreground truncate">
                      <span className="truncate">
                        {source.type === 'website_form'
                          ? `/f/${source.webhookId}`
                          : `/hooks/generic/${source.webhookId}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const url =
                            source.type === 'website_form'
                              ? `${window.location.origin}/f/${source.webhookId}`
                              : `${window.location.origin}/hooks/generic/${source.webhookId}`;
                          navigator.clipboard.writeText(url);
                          success('URL copied to clipboard');
                        }}
                        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-muted hover:text-foreground"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Counters Matrix */}
                <div className="grid grid-cols-4 gap-2 text-center py-2 border-y border-border/60">
                  <div className="p-1.5 rounded-lg bg-card border border-border/40">
                    <span className="text-[10px] text-muted block">Received</span>
                    <span className="font-bold text-xs text-foreground">{source.counters.received}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-card border border-border/40">
                    <span className="text-[10px] text-muted block">Created</span>
                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {source.counters.created}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-card border border-border/40">
                    <span className="text-[10px] text-muted block">Duplicate</span>
                    <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                      {source.counters.duplicates}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-card border border-border/40">
                    <span className="text-[10px] text-muted block">Failed</span>
                    <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                      {source.counters.failed}
                    </span>
                  </div>
                </div>

                {/* Last lead & Error info */}
                <div className="text-[11px] text-muted space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Last lead:</span>
                    <span className="font-medium text-foreground">
                      {source.lastLeadAt ? new Date(source.lastLeadAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  {source.lastError && (
                    <div className="text-rose-500 dark:text-rose-400 truncate flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{source.lastError}</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => testLeadMutation.mutate(source._id)}
                    isLoading={testLeadMutation.isPending && testLeadMutation.variables === source._id}
                    className="gap-1 text-xs"
                    title="Send a test lead to verify intake and attribution"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send Test</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedSourceForEvents(source)}
                    className="gap-1 text-xs"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Events</span>
                  </Button>

                  {source.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => toggleStatusMutation.mutate({ source, newStatus: 'paused' })}
                      className="p-2 rounded-xl border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted hover:text-foreground transition-colors"
                      title="Pause intake"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleStatusMutation.mutate({ source, newStatus: 'active' })}
                      className="p-2 rounded-xl border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-emerald-600 dark:text-emerald-400 transition-colors"
                      title="Resume intake"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to rotate the webhook secret and token? Existing integrations will need to update their key.')) {
                        rotateSecretMutation.mutate(source);
                      }
                    }}
                    className="p-2 rounded-xl border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted hover:text-foreground transition-colors"
                    title="Rotate Webhook Secret"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* Create Source Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Connect New Lead Source"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-foreground block mb-1">Source Name</label>
            <input
              type="text"
              placeholder="e.g. Website Hero Form, Zapier Lead Sync, WordPress Portal"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1">Source Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="generic_webhook">Generic Webhook (Zapier, Make, Wix, Custom API)</option>
              <option value="website_form">Website Form (Embed or Hosted Page)</option>
            </select>
          </div>

          {formData.type === 'generic_webhook' && (
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                JSON Key-to-Field Mapping (JSON format)
              </label>
              <p className="text-[11px] text-muted">
                Map incoming JSON keys to standard Lead fields (name, email, phone, company, value, notes, custom.*):
              </p>
              <textarea
                rows={5}
                value={formData.fieldMappingJson}
                onChange={(e) => setFormData({ ...formData, fieldMappingJson: e.target.value })}
                className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {formData.type === 'website_form' && (
            <div className="p-3 rounded-xl bg-card-subtle border border-border text-[11px] text-muted leading-relaxed">
              💡 A customizable web form will be created. You can further customize field labels, required flags, allowed domains, and embed snippets from the <strong>Marketing &gt; Forms</strong> page.
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <Button variant="secondary" size="md" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!formData.name.trim() || createMutation.isPending}
              isLoading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create Source
            </Button>
          </div>
        </div>
      </Modal>

      {/* New API Key One-Time Display Modal */}
      <Modal
        isOpen={Boolean(newApiKeyModalData)}
        onClose={() => setNewApiKeyModalData(null)}
        title="⚠️ Important: Copy Your Webhook Credentials"
      >
        {newApiKeyModalData && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This API key will <strong>never be shown again</strong>. Store it safely in your Zapier, Make, or webhook integration header.
              </span>
            </div>

            <div className="space-y-3 font-mono text-[11px]">
              {newApiKeyModalData.apiKey && (
                <div>
                  <span className="text-muted block uppercase font-sans text-[10px] mb-1">
                    Header: x-api-key
                  </span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card">
                    <span className="truncate font-bold text-foreground">{newApiKeyModalData.apiKey}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newApiKeyModalData.apiKey!);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                        success('API Key copied');
                      }}
                      className="shrink-0 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-muted"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span className="text-muted block uppercase font-sans text-[10px] mb-1">
                  Webhook URL (POST)
                </span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card">
                  <span className="truncate text-foreground">
                    {window.location.origin}/hooks/generic/{newApiKeyModalData.webhookId}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/hooks/generic/${newApiKeyModalData.webhookId}`
                      );
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                      success('Webhook URL copied');
                    }}
                    className="shrink-0 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-muted"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" size="md" onClick={() => setNewApiKeyModalData(null)}>
                I have saved these credentials
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Events Inspection Drawer */}
      <Drawer
        isOpen={Boolean(selectedSourceForEvents)}
        onClose={() => setSelectedSourceForEvents(null)}
        title={`Recent Inbound Events (${selectedSourceForEvents?.name || ''})`}
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-muted">Showing latest 20 raw inbound events</span>
            <Button variant="secondary" size="sm" onClick={() => refetchEvents()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {eventsLoading ? (
            <div className="p-8 text-center text-muted">Loading events...</div>
          ) : !eventsData || eventsData.events.length === 0 ? (
            <div className="p-8 text-center text-muted">No events recorded yet for this source.</div>
          ) : (
            <div className="space-y-3">
              {eventsData.events.map((event) => (
                <div
                  key={event._id}
                  className="p-3 rounded-xl border border-border bg-card-subtle space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        event.status === 'processed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : event.status === 'duplicate'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : event.status === 'ignored'
                          ? 'bg-neutral-500/10 text-neutral-600'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {event.status} {event.isTest && '• TEST'}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(event.createdAt).toLocaleTimeString()} • {new Date(event.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {event.lead && (
                    <div className="text-[11px] text-foreground flex items-center justify-between">
                      <span>Lead: <strong>{event.lead.name}</strong> ({event.lead.email})</span>
                      <a
                        href={`/leads/${event.lead._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {event.error && (
                    <div className="text-[11px] text-rose-500 dark:text-rose-400 bg-rose-500/5 p-2 rounded border border-rose-500/20">
                      Error: {event.error}
                    </div>
                  )}

                  {/* Raw Payload Preview Toggle */}
                  <details className="text-[10px] text-muted cursor-pointer font-mono">
                    <summary className="hover:text-foreground">View Raw Payload</summary>
                    <pre className="p-2 mt-1 rounded bg-black/5 dark:bg-white/5 overflow-x-auto max-h-32">
                      {JSON.stringify(event.rawPayload, null, 2)}
                    </pre>
                  </details>

                  {event.status === 'failed' && (
                    <div className="pt-1 flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => replayMutation.mutate(event._id)}
                        isLoading={replayMutation.isPending && replayMutation.variables === event._id}
                        className="text-[11px] gap-1"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Replay Event</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>
    </PageTransition>
  );
};
