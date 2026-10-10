import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  Upload,
  Landmark,
  Save,
  Hash,
} from 'lucide-react';
import { fetchCompanySettings, updateCompanySettings } from '../api/phase3.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';

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
