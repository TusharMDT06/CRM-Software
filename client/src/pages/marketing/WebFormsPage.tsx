import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileInput,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Trash2,
  ShieldCheck,
  Globe,
  Settings2,
  Save,
} from 'lucide-react';
import {
  getLeadSources,
  createLeadSource,
  updateLeadSource,
} from '../../api/marketing.js';
import { LeadSourceItem } from '../../types/index.js';
import { useToast } from '../../context/ToastContext.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Drawer } from '../../components/ui/Drawer.js';
import { PageTransition } from '../../components/motion/PageTransition.js';
import { Reveal } from '../../components/motion/Reveal.js';

interface FormFieldItem {
  field: string;
  label: string;
  required: boolean;
}

export const WebFormsPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedFormForEdit, setSelectedFormForEdit] = useState<LeadSourceItem | null>(null);
  const [embedModalData, setEmbedModalData] = useState<LeadSourceItem | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedHosted, setCopiedHosted] = useState(false);

  // New form state
  const [newFormName, setNewFormName] = useState('');

  // Form builder configuration state
  const [configState, setConfigState] = useState<{
    fields: FormFieldItem[];
    consentCheckboxText: string;
    successMessage: string;
    redirectUrl: string;
    allowedDomains: string;
    turnstileEnabled: boolean;
  }>({
    fields: [
      { field: 'name', label: 'Full Name', required: true },
      { field: 'email', label: 'Work Email', required: true },
      { field: 'phone', label: 'Phone Number', required: true },
      { field: 'company', label: 'Company Name', required: false },
    ],
    consentCheckboxText: 'I consent to receive calls and email updates regarding Flowdesk products.',
    successMessage: 'Thank you! Our sales team will get back to you shortly.',
    redirectUrl: '',
    allowedDomains: '',
    turnstileEnabled: false,
  });

  // Query sources filtering for website_form
  const { data: allSources = [], isLoading } = useQuery<LeadSourceItem[]>({
    queryKey: ['leadSources'],
    queryFn: getLeadSources,
  });

  const forms = allSources.filter((s) => s.type === 'website_form');

  // Create form mutation
  const createFormMutation = useMutation({
    mutationFn: async () => {
      return createLeadSource({
        name: newFormName,
        type: 'website_form',
        config: {
          fields: [
            { field: 'name', label: 'Full Name', required: true },
            { field: 'email', label: 'Work Email', required: true },
            { field: 'phone', label: 'Phone Number', required: true },
            { field: 'company', label: 'Company Name', required: false },
          ],
          consentCheckboxText: 'I consent to receive calls and email updates regarding Flowdesk products.',
          successMessage: 'Thank you! Our sales team will get back to you shortly.',
        },
      });
    },
    onSuccess: () => {
      success('Website form created successfully');
      setCreateModalOpen(false);
      setNewFormName('');
      queryClient.invalidateQueries({ queryKey: ['leadSources'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to create form');
    },
  });

  // Save builder config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFormForEdit) return;
      const domainList = configState.allowedDomains
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean);

      return updateLeadSource(selectedFormForEdit._id, {
        config: {
          ...selectedFormForEdit.config,
          fields: configState.fields,
          consentCheckboxText: configState.consentCheckboxText,
          successMessage: configState.successMessage,
          redirectUrl: configState.redirectUrl.trim() || undefined,
          allowedDomains: domainList,
          turnstileEnabled: configState.turnstileEnabled,
        },
      });
    },
    onSuccess: () => {
      success('Form configuration updated successfully');
      setSelectedFormForEdit(null);
      queryClient.invalidateQueries({ queryKey: ['leadSources'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update form');
    },
  });

  const openBuilder = (form: LeadSourceItem) => {
    setSelectedFormForEdit(form);
    const existing = form.config || {};
    setConfigState({
      fields: existing.fields || [
        { field: 'name', label: 'Full Name', required: true },
        { field: 'email', label: 'Work Email', required: true },
        { field: 'phone', label: 'Phone Number', required: true },
      ],
      consentCheckboxText:
        existing.consentCheckboxText ||
        'I consent to receive calls and email updates regarding Flowdesk products.',
      successMessage:
        existing.successMessage || 'Thank you! Our sales team will get back to you shortly.',
      redirectUrl: existing.redirectUrl || '',
      allowedDomains: (existing.allowedDomains || []).join('\n'),
      turnstileEnabled: Boolean(existing.turnstileEnabled),
    });
  };

  const addField = () => {
    setConfigState({
      ...configState,
      fields: [...configState.fields, { field: 'notes', label: 'Inquiry Message', required: false }],
    });
  };

  const removeField = (index: number) => {
    setConfigState({
      ...configState,
      fields: configState.fields.filter((_, i) => i !== index),
    });
  };

  const updateFieldItem = (index: number, key: keyof FormFieldItem, value: any) => {
    const updated = [...configState.fields];
    updated[index] = { ...updated[index], [key]: value };
    setConfigState({ ...configState, fields: updated });
  };

  const generateEmbedSnippet = (formId: string) => {
    const host = window.location.origin;
    return `<!-- Flowdesk Lead Capture Form Embed -->
<iframe
  id="flowdesk-form-${formId}"
  src="${host}/f/${formId}"
  style="width: 100%; min-height: 520px; border: none; border-radius: 16px; overflow: hidden;"
  loading="lazy"
></iframe>
<script>
  (function() {
    // Forward UTM params, click IDs & referrer to iframe
    var iframe = document.getElementById('flowdesk-form-${formId}');
    if (iframe) {
      var currentUrl = new URL(window.location.href);
      var formUrl = new URL(iframe.src);
      currentUrl.searchParams.forEach(function(val, key) {
        formUrl.searchParams.set(key, val);
      });
      formUrl.searchParams.set('referrer', document.referrer || window.location.href);
      iframe.src = formUrl.toString();
    }
  })();
</script>`;
  };

  return (
    <PageTransition className="space-y-6">
      {/* Top Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FileInput className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Website Lead Forms
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Create embedded or hosted lead generation forms with spam protection and automatic UTM attribution.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setCreateModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Form</span>
          </Button>
        </div>
      </Reveal>

      {/* Forms List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <FileInput className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No Website Forms Yet</h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                Create a form to embed on your website or use as a standalone hosted landing page.
              </p>
            </div>
            <Button variant="primary" size="md" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Create First Form</span>
            </Button>
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {forms.map((form, index) => (
            <Reveal key={form._id} delay={0.05 * index}>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-primary/40 transition-all">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-foreground truncate">{form.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {form.counters.created} leads captured
                    </span>
                  </div>

                  <p className="text-[11px] text-muted">
                    {form.config?.fields?.length || 4} fields • Honeypot spam defense enabled
                  </p>

                  <div className="p-2.5 rounded-xl bg-card-subtle border border-border text-xs flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-muted truncate">
                      {window.location.origin}/f/{form.webhookId}
                    </span>
                    <a
                      href={`/f/${form.webhookId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline shrink-0 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
                      title="Open Hosted Form"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 border-t border-border/60">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openBuilder(form)}
                    className="gap-1 text-xs flex-1"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Customize Fields</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEmbedModalData(form)}
                    className="gap-1 text-xs"
                    title="Get Embed Code"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Embed</span>
                  </Button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Website Form"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-foreground block mb-1">Form Name</label>
            <input
              type="text"
              placeholder="e.g. Homepage Hero Form, Pricing Request Form, Contact Us"
              value={newFormName}
              onChange={(e) => setNewFormName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="p-3 rounded-xl bg-card-subtle border border-border text-[11px] text-muted space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Built-in spam & attribution protection:
            </div>
            <p>
              Forms automatically come with hidden honeypot spam protection, per-IP rate limiting, and capture of UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`), `gclid`, and `fbclid`.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <Button variant="secondary" size="md" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!newFormName.trim() || createFormMutation.isPending}
              isLoading={createFormMutation.isPending}
              onClick={() => createFormMutation.mutate()}
            >
              Create & Customize
            </Button>
          </div>
        </div>
      </Modal>

      {/* Form Customizer Drawer */}
      <Drawer
        isOpen={Boolean(selectedFormForEdit)}
        onClose={() => setSelectedFormForEdit(null)}
        title={`Customize Form: ${selectedFormForEdit?.name || ''}`}
      >
        <div className="space-y-6 text-xs pb-6">
          {/* Form Fields Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Form Fields
              </h4>
              <Button variant="secondary" size="sm" onClick={addField} className="text-xs gap-1">
                <Plus className="w-3 h-3" />
                <span>Add Field</span>
              </Button>
            </div>

            <div className="space-y-2.5">
              {configState.fields.map((f, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-border bg-card-subtle space-y-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted block mb-0.5">Target Field</span>
                      <select
                        value={f.field}
                        onChange={(e) => updateFieldItem(idx, 'field', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground"
                      >
                        <option value="name">Name (Full Name)</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="company">Company</option>
                        <option value="value">Estimated Budget / Value</option>
                        <option value="notes">Message / Notes</option>
                        <option value="custom_requirement">Custom: Requirement</option>
                        <option value="custom_city">Custom: City</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted block mb-0.5">Label Shown to Visitor</span>
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateFieldItem(idx, 'label', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 text-muted cursor-pointer text-[11px]">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateFieldItem(idx, 'required', e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                      <span>Required field</span>
                    </label>

                    {configState.fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Remove Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consent Text */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
              Consent Checkbox Text
            </h4>
            <textarea
              rows={2}
              value={configState.consentCheckboxText}
              onChange={(e) => setConfigState({ ...configState, consentCheckboxText: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Submission Feedback */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">
              Submission Action
            </h4>

            <div>
              <span className="text-[10px] text-muted block mb-0.5">Success Message</span>
              <input
                type="text"
                value={configState.successMessage}
                onChange={(e) => setConfigState({ ...configState, successMessage: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground"
              />
            </div>

            <div>
              <span className="text-[10px] text-muted block mb-0.5">Redirect URL (Optional)</span>
              <input
                type="text"
                placeholder="https://yourwebsite.com/thank-you"
                value={configState.redirectUrl}
                onChange={(e) => setConfigState({ ...configState, redirectUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-border bg-card text-foreground"
              />
            </div>
          </div>

          {/* Domain Restriction */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Allowed Domains (CORS)
            </h4>
            <p className="text-[11px] text-muted">
              Leave blank to allow any website, or enter domain names (one per line, e.g. <code>mycompany.com</code>):
            </p>
            <textarea
              rows={2}
              placeholder="example.com&#10;app.example.com"
              value={configState.allowedDomains}
              onChange={(e) => setConfigState({ ...configState, allowedDomains: e.target.value })}
              className="w-full font-mono text-[11px] px-3 py-2 rounded-xl border border-border bg-card text-foreground"
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={() => setSelectedFormForEdit(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={saveConfigMutation.isPending}
              onClick={() => saveConfigMutation.mutate()}
              className="gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Embed Code Modal */}
      <Modal
        isOpen={Boolean(embedModalData)}
        onClose={() => setEmbedModalData(null)}
        title="Form Embed Code & Hosted Link"
      >
        {embedModalData && (
          <div className="space-y-4 text-xs">
            {/* Hosted Page */}
            <div>
              <span className="font-semibold text-foreground block mb-1">
                1. Standalone Hosted Link:
              </span>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card">
                <span className="truncate font-mono text-[11px] text-foreground">
                  {window.location.origin}/f/{embedModalData.webhookId}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/f/${embedModalData.webhookId}`);
                    setCopiedHosted(true);
                    setTimeout(() => setCopiedHosted(false), 2000);
                    success('Hosted link copied');
                  }}
                  className="shrink-0 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-muted"
                >
                  {copiedHosted ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Embed Code Snippet */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-foreground">2. HTML Embed Code (Copy &amp; Paste):</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateEmbedSnippet(embedModalData.webhookId));
                    setCopiedEmbed(true);
                    setTimeout(() => setCopiedEmbed(false), 2000);
                    success('Embed snippet copied');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                >
                  {copiedEmbed ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEmbed ? 'Copied!' : 'Copy Snippet'}</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={10}
                value={generateEmbedSnippet(embedModalData.webhookId)}
                className="w-full font-mono text-[11px] p-3 rounded-xl border border-border bg-black/5 dark:bg-white/5 text-foreground leading-relaxed focus:outline-none"
              />
              <p className="text-[10px] text-muted mt-1">
                Includes automatic forwarding of visitors' UTM tags, Google Ad Click ID (`gclid`), Meta Click ID (`fbclid`), and landing page URLs.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" size="md" onClick={() => setEmbedModalData(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  );
};
