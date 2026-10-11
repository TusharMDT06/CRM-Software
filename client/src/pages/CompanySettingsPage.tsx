import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  Upload,
  Landmark,
  Save,
  Hash,
  Download,
  Trash2,
  Archive,
  AlertOctagon,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  BarChart2,
} from 'lucide-react';
import { fetchCompanySettings, updateCompanySettings } from '../api/phase3.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';
import { getAiStatus, updateAiConsent, AiStatusResponse } from '../api/ai.js';

export const CompanySettingsPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    legalName: '',
    address: '',
    state: '',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
    website: '',
    logo: '',
    bankDetails: {
      accountName: '',
      accountNumber: '',
      ifsc: '',
      bankName: '',
    },
    defaultPaymentTermsDays: 30,
    defaultQuoteValidityDays: 30,
    defaultTerms: '',
    quotePrefix: 'QT',
    invoicePrefix: 'INV',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => fetchCompanySettings(),
  });

  useEffect(() => {
    if (data) {
      setFormData({
        legalName: data.legalName || '',
        address: data.address || '',
        state: data.state || '',
        gstin: data.gstin || '',
        pan: data.pan || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        logo: data.logo || '',
        bankDetails: {
          accountName: data.bankDetails?.accountName || '',
          accountNumber: data.bankDetails?.accountNumber || '',
          ifsc: data.bankDetails?.ifsc || '',
          bankName: data.bankDetails?.bankName || '',
        },
        defaultPaymentTermsDays: data.defaultPaymentTermsDays ?? 30,
        defaultQuoteValidityDays: data.defaultQuoteValidityDays ?? 30,
        defaultTerms: data.defaultTerms || '',
        quotePrefix: data.quotePrefix || 'QT',
        invoicePrefix: data.invoicePrefix || 'INV',
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateCompanySettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
      success('Company settings updated successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update company settings');
    },
  });

  const { tenant, refreshMe } = useAuth();
  const [exportData, setExportData] = useState<{
    jobId: string;
    downloadUrl: string;
    recordCounts: Record<string, number>;
  } | null>(null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/settings/tenant/export');
      return res.data;
    },
    onSuccess: (data) => {
      setExportData(data);
      success('Workspace export generated successfully!');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to generate workspace export');
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/settings/tenant/delete-request');
      return res.data;
    },
    onSuccess: async (data) => {
      success(data.message || 'Deletion requested. 14-day grace period started.');
      await refreshMe();
    },
    onError: (err: any) => {
      error(err.message || 'Failed to request deletion');
    },
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/settings/tenant/cancel-deletion');
      return res.data;
    },
    onSuccess: async (data) => {
      success(data.message || 'Deletion request cancelled successfully.');
      await refreshMe();
    },
    onError: (err: any) => {
      error(err.message || 'Failed to cancel deletion');
    },
  });

  // Stage 4: AI Status & Privacy Consent
  const { data: aiStatus, refetch: refetchAiStatus } = useQuery<AiStatusResponse>({
    queryKey: ['aiStatus'],
    queryFn: () => getAiStatus(),
  });

  const [aiEnabledToggle, setAiEnabledToggle] = useState(false);
  const [aiNoticeAccepted, setAiNoticeAccepted] = useState(false);

  useEffect(() => {
    if (aiStatus) {
      setAiEnabledToggle(Boolean(aiStatus.aiEnabled));
    }
  }, [aiStatus]);

  const aiConsentMutation = useMutation({
    mutationFn: async ({ enabled, acceptedNotice }: { enabled: boolean; acceptedNotice: boolean }) => {
      return updateAiConsent(enabled, acceptedNotice);
    },
    onSuccess: () => {
      success('AI privacy settings updated successfully.');
      refetchAiStatus();
      queryClient.invalidateQueries({ queryKey: ['aiStatus'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update AI settings');
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 1 MB = 1,048,576 bytes)
    if (file.size > 1024 * 1024) {
      error('Logo image must be smaller than 1 MB');
      return;
    }

    // Validate type (png or jpg/jpeg)
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      error('Logo must be a PNG or JPG image');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.legalName.trim() || !formData.address.trim() || !formData.state.trim()) {
      error('Legal name, address, and state are required');
      return;
    }

    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="h-10 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl w-64" />
        <div className="h-96 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full gap-6">
      {/* Page Title */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Building className="w-6 h-6 text-foreground" />
              Company & Billing Settings
            </h1>
            <p className="text-sm text-muted mt-1">
              Configure your organization legal entity details, GSTIN, bank accounts, and invoice templates.
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </Reveal>

      {/* Settings Navigation Tabs */}
      <div className="border-b border-border flex gap-2">
        {[
          { label: 'Company Settings', to: '/settings/company' },
          { label: 'AI Intelligence & Usage', to: '/settings/ai' },
          { label: 'Notifications', to: '/settings/notifications' },
          { label: 'Custom Fields', to: '/settings/custom-fields' },
        ].map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab.to === '/settings/company'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Legal Information & Logo */}
        <Reveal direction="up" delay={0.05}>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Building className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Legal Entity Details
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Logo Box */}
              <div className="flex flex-col items-center gap-3 p-4 border border-dashed border-border rounded-2xl bg-[#FAFAFA] dark:bg-[#1E1E24]/40">
                {formData.logo ? (
                  <div className="relative w-36 h-24 flex items-center justify-center p-2 bg-white dark:bg-neutral-900 border border-border rounded-xl">
                    <img
                      src={formData.logo}
                      alt="Company Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logo: '' })}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 shadow-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-muted">
                    <Upload className="w-8 h-8" />
                  </div>
                )}
                <div className="text-center">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-card transition-colors">
                    <span>{formData.logo ? 'Change Logo' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-muted mt-1.5">Max 1 MB (PNG or JPG)</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Legal Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    placeholder="e.g. Acme Technologies India Private Limited"
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Registered Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street address, building, suite"
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    State (For GST Jurisdiction) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Karnataka, Maharashtra"
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    GSTIN (Tax ID)
                  </label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="29ABCDE1234F1Z5"
                    className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    PAN (Permanent Account Number)
                  </label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="billing@yourcompany.com"
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourcompany.com"
                    className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Section 2: Bank Details */}
        <Reveal direction="up" delay={0.1}>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Landmark className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Bank & Payment Details (Printed on Invoices & Quotes)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Beneficiary Account Name
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.accountName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, accountName: e.target.value },
                    })
                  }
                  placeholder="e.g. Flowdesk Technologies Pvt Ltd"
                  className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.accountNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, accountNumber: e.target.value },
                    })
                  }
                  placeholder="e.g. 50200012345678"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.ifsc}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, ifsc: e.target.value.toUpperCase() },
                    })
                  }
                  placeholder="e.g. HDFC0001234"
                  className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Bank Name & Branch
                </label>
                <input
                  type="text"
                  value={formData.bankDetails.bankName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankDetails: { ...formData.bankDetails, bankName: e.target.value },
                    })
                  }
                  placeholder="e.g. HDFC Bank, Koramangala Branch"
                  className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>
            </div>
          </div>
        </Reveal>

        {/* Section 3: Document Numbering & Terms */}
        <Reveal direction="up" delay={0.15}>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Hash className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Document Numbering & Defaults
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Quote Prefix
                </label>
                <input
                  type="text"
                  value={formData.quotePrefix}
                  onChange={(e) => setFormData({ ...formData, quotePrefix: e.target.value.toUpperCase() })}
                  placeholder="QT"
                  className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
                <span className="text-[10px] text-muted mt-1 block">Format: QT-2026-0001</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={formData.invoicePrefix}
                  onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value.toUpperCase() })}
                  placeholder="INV"
                  className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
                <span className="text-[10px] text-muted mt-1 block">Format: INV-2026-0001</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Quote Validity (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.defaultQuoteValidityDays}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultQuoteValidityDays: parseInt(e.target.value) || 30 })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Payment Terms (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.defaultPaymentTermsDays}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultPaymentTermsDays: parseInt(e.target.value) || 30 })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Default Terms & Conditions Text
              </label>
              <textarea
                rows={3}
                value={formData.defaultTerms}
                onChange={(e) => setFormData({ ...formData, defaultTerms: e.target.value })}
                placeholder="Standard payment terms, warranty disclaimer, delivery expectations..."
                className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
            </div>
          </div>
        </Reveal>

        {/* Stage 4: AI Features & Data Privacy Gate (Google Gemini) */}
        <Reveal delay={0.22}>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  AI Intelligence & Data Privacy Gate (Google Gemini)
                </h2>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Gemini 2.0
              </span>
            </div>

            {!aiStatus?.isConfigured ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Gemini API Key is not configured on the server
                </div>
                <p className="text-[11px] text-muted">
                  To enable Copilot, smart email drafting, and natural-language search, set <code>GEMINI_API_KEY</code> in the server <code>.env</code> file. AI UI remains hidden until configured.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Enable toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card-subtle">
                  <div>
                    <h3 className="text-xs font-bold text-foreground">
                      Enable Flowdesk AI Features
                    </h3>
                    <p className="text-[11px] text-muted mt-0.5">
                      Powers Copilot chat, email drafting, record summaries, and natural-language search.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiEnabledToggle}
                      onChange={(e) => setAiEnabledToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Privacy & Terms Disclosure Notice */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs space-y-3">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Data Privacy & Google Terms Notice</span>
                  </div>

                  <div className="space-y-1.5 text-foreground leading-relaxed text-[11px]">
                    <p>
                      <strong>What customer data is sent to Google:</strong> Record names & values, notes, timeline activity entries, email & WhatsApp correspondence, and support ticket descriptions.
                    </p>
                    <p className="text-muted">
                      <strong>Google AI Studio Terms:</strong> On the free (unpaid) tier, prompts and responses may be processed to improve Google products and reviewed by human reviewers. On paid-tier (billing-enabled) API keys, customer data is never used for training or human review. We recommend a paid-tier key for real customer data.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={aiNoticeAccepted}
                        onChange={(e) => setAiNoticeAccepted(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>I understand the data shared and authorize enabling AI for this organization.</span>
                    </label>

                    <button
                      type="button"
                      disabled={aiConsentMutation.isPending || (aiEnabledToggle && !aiNoticeAccepted)}
                      onClick={() =>
                        aiConsentMutation.mutate({
                          enabled: aiEnabledToggle,
                          acceptedNotice: aiNoticeAccepted,
                        })
                      }
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {aiConsentMutation.isPending ? 'Saving...' : 'Confirm AI Consent'}
                    </button>
                  </div>

                  {aiStatus?.aiConsentConfirmedAt && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                      ✓ Confirmed by organization admin on{' '}
                      {new Date(aiStatus.aiConsentConfirmedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* AI Usage & Quotas (Admin) */}
                <div className="p-4 rounded-xl border border-border bg-card-subtle space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-primary" />
                      AI Request Usage & Quotas (This Month)
                    </span>
                    <span className="text-[11px] font-mono text-muted">
                      {aiStatus?.limits.monthlyUsed} / {aiStatus?.limits.monthlyMax} requests
                    </span>
                  </div>

                  <div className="w-full bg-card rounded-full h-2 border border-border overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          ((aiStatus?.limits.monthlyUsed || 0) / (aiStatus?.limits.monthlyMax || 50)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-card border border-border">
                      <span className="text-[10px] text-muted uppercase">Strong Model</span>
                      <p className="font-semibold text-foreground truncate">{aiStatus?.models.strong}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-card border border-border">
                      <span className="text-[10px] text-muted uppercase">Fast Model</span>
                      <p className="font-semibold text-foreground truncate">{aiStatus?.models.fast}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-card border border-border">
                      <span className="text-[10px] text-muted uppercase">Monthly Cap</span>
                      <p className="font-semibold text-foreground">{aiStatus?.limits.monthlyMax} requests</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-card border border-border">
                      <span className="text-[10px] text-muted uppercase">Plan Tier</span>
                      <p className="font-semibold text-foreground capitalize">{aiStatus?.limits.plan}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between text-[11px] text-muted gap-2">
                    <span>Detailed usage metrics, token consumption, and audit logs are available in AI Intelligence.</span>
                    <Link to="/settings/ai" className="font-semibold text-primary hover:underline">
                      View AI Usage Logs &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        {/* Organization Data Export & Danger Zone */}
        <Reveal delay={0.25}>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Workspace Data & Tenancy
                </h2>
              </div>
              <span className="text-[11px] font-mono bg-muted/20 px-2 py-0.5 rounded text-muted">
                Tenant: {tenant?.slug || 'default'}
              </span>
            </div>

            {/* Export Section */}
            <div className="p-4 rounded-xl border border-border bg-card-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-brand" />
                  Full Workspace Data Export (ZIP)
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  Export all leads, contacts, accounts, deals, tasks, products, quotes, invoices, payments and workflows as individual CSV files in a compressed archive.
                </p>
                {exportData && (
                  <div className="mt-2.5 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-600 dark:text-emerald-400">
                    <div className="font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Export ready! Download your archive:
                    </div>
                    <div className="mt-1">
                      <a
                        href={exportData.downloadUrl}
                        download
                        className="underline font-bold text-foreground hover:text-brand"
                      >
                        Download Flowdesk Export Archive (.zip)
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate()}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted/10 text-xs font-semibold text-foreground transition-colors disabled:opacity-50 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                {exportMutation.isPending ? 'Generating Export...' : 'Generate Export ZIP'}
              </button>
            </div>

            {/* Tenant Deletion (Danger Zone) */}
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" />
                    Danger Zone: Workspace Deletion Request
                  </h3>
                  <p className="text-[11px] text-muted mt-0.5">
                    Soft deletes all organization data with a 14-day recovery grace period, after which the tenant and all files are permanently purged.
                  </p>
                </div>

                {tenant?.deletionRequestedAt ? (
                  <button
                    type="button"
                    disabled={cancelDeletionMutation.isPending}
                    onClick={() => cancelDeletionMutation.mutate()}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted/10 transition-colors"
                  >
                    Cancel Deletion Request
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={deleteRequestMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to request deletion of this organization? Access will be suspended with a 14-day grace period before permanent purge.'
                        )
                      ) {
                        deleteRequestMutation.mutate();
                      }
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Request Workspace Deletion
                  </button>
                )}
              </div>

              {tenant?.deletionRequestedAt && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-600 dark:text-red-400">
                  ⚠️ Deletion requested on{' '}
                  <strong>{new Date(tenant.deletionRequestedAt).toLocaleDateString()}</strong>.
                  All organization records are scheduled for permanent purge after 14 days.
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
