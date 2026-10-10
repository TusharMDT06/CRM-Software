import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  FileText,
  Building,
  User as UserIcon,
  Briefcase,
  AlertTriangle,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { fetchProducts } from '../../api/phase3.js';
import { api } from '../../api/client.js';
import {
  formatINR,
  paiseToRupees,
  rupeesToPaise,
  computeLiveTotals,
  LiveLineItem,
} from '../../utils/money.js';

interface DocumentBuilderProps {
  type: 'quote' | 'invoice';
  initialData?: any;
  onSave: (payload: any) => Promise<void>;
  isSaving: boolean;
  prefillDealId?: string;
}

export const DocumentBuilder: React.FC<DocumentBuilderProps> = ({
  type,
  initialData,
  onSave,
  isSaving,
  prefillDealId,
}) => {
  const navigate = useNavigate();

  // Queries for selectors
  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts(),
  });

  const { data: dealsData } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => (await api.get('/deals')).data,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => (await api.get('/accounts')).data,
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await api.get('/contacts')).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: async () => (await api.get('/settings/company')).data,
  });

  // Form State
  const [dealId, setDealId] = useState(initialData?.deal?._id || initialData?.deal || prefillDealId || '');
  const [accountId, setAccountId] = useState(initialData?.account?._id || initialData?.account || '');
  const [contactId, setContactId] = useState(initialData?.contact?._id || initialData?.contact || '');
  const [taxMode, setTaxMode] = useState<'intra' | 'inter'>(initialData?.taxMode || 'intra');
  const [validUntil, setValidUntil] = useState(
    initialData?.validUntil
      ? new Date(initialData.validUntil).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [issueDate, setIssueDate] = useState(
    initialData?.issueDate
      ? new Date(initialData.issueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(
    initialData?.dueDate
      ? new Date(initialData.dueDate).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [terms, setTerms] = useState(initialData?.terms || '');

  // Line items (unitPrice stored in paise)
  const [items, setItems] = useState<LiveLineItem[]>(
    initialData?.items?.length
      ? initialData.items.map((it: any) => ({
          product: it.product?._id || it.product,
          name: it.name,
          description: it.description || '',
          qty: it.qty || 1,
          unitPrice: it.unitPrice || 0,
          discountPct: it.discountPct || 0,
          taxRate: it.taxRate ?? 18,
        }))
      : [
          {
            name: '',
            description: '',
            qty: 1,
            unitPrice: 0,
            discountPct: 0,
            taxRate: 18,
          },
        ]
  );

  // Auto-fill from selected deal
  useEffect(() => {
    if (dealId && dealsData?.data) {
      const selectedDeal = dealsData.data.find((d: any) => d._id === dealId);
      if (selectedDeal) {
        if (!accountId && selectedDeal.account) {
          setAccountId(selectedDeal.account._id || selectedDeal.account);
        }
        if (!contactId && selectedDeal.contact) {
          setContactId(selectedDeal.contact._id || selectedDeal.contact);
        }
      }
    }
  }, [dealId, dealsData, accountId, contactId]);

  // Auto-detect Tax Mode by comparing Account state with Company state
  useEffect(() => {
    if (accountId && accountsData?.data && companySettings) {
      const acc = accountsData.data.find((a: any) => a._id === accountId);
      if (acc?.state && companySettings?.state) {
        const isSameState =
          acc.state.trim().toLowerCase() === companySettings.state.trim().toLowerCase();
        setTaxMode(isSameState ? 'intra' : 'inter');
      }
    }
  }, [accountId, accountsData, companySettings]);

  // Set default terms if empty
  useEffect(() => {
    if (!terms && companySettings?.defaultTerms) {
      setTerms(companySettings.defaultTerms);
    }
  }, [companySettings, terms]);

  // Live Totals Calculation
  const liveTotals = computeLiveTotals(items, taxMode);

  // High Discount & High Value Approval Warning
  const hasHighDiscount = items.some((it) => (it.discountPct || 0) > 15);
  const hasHighValue = liveTotals.total > 100_000_000; // > ₹10L in paise

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        name: '',
        description: '',
        qty: 1,
        unitPrice: 0,
        discountPct: 0,
        taxRate: 18,
      },
    ]);
  };

  const handleSelectProduct = (index: number, productId: string) => {
    const prod = (productsData?.data || []).find((p) => p._id === productId);
    if (!prod) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product: prod._id,
      name: prod.name,
      description: prod.description || '',
      unitPrice: prod.unitPrice,
      taxRate: prod.taxRate,
    };
    setItems(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof LiveLineItem, val: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealId || !accountId || !contactId) {
      alert('Please select a deal, account, and contact.');
      return;
    }
    if (items.some((it) => !it.name.trim() || it.qty <= 0)) {
      alert('All line items must have a valid name and quantity greater than zero.');
      return;
    }

    const payload: any = {
      deal: dealId,
      account: accountId,
      contact: contactId,
      taxMode,
      items: items.map((it) => ({
        product: it.product || undefined,
        name: it.name.trim(),
        description: it.description?.trim() || '',
        qty: Number(it.qty),
        unitPrice: Number(it.unitPrice), // in paise
        discountPct: Number(it.discountPct || 0),
        taxRate: Number(it.taxRate || 0),
      })),
      notes: notes.trim(),
      terms: terms.trim(),
    };

    if (type === 'quote') {
      payload.validUntil = new Date(validUntil).toISOString();
    } else {
      payload.issueDate = new Date(issueDate).toISOString();
      payload.dueDate = new Date(dueDate).toISOString();
    }

    await onSave(payload);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* Top Banner & Customer Selectors */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Building className="w-4 h-4 text-foreground" />
              Bill To & Record References
            </h2>
            <p className="text-xs text-muted">
              Select the deal, client organization, and primary contact.
            </p>
          </div>

          {/* Tax Mode Toggle */}
          <div className="flex items-center gap-2 bg-[#F4F4F5] dark:bg-[#202025] p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTaxMode('intra')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                taxMode === 'intra'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Intra-State (CGST + SGST)
            </button>
            <button
              type="button"
              onClick={() => setTaxMode('inter')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                taxMode === 'inter'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Inter-State (IGST)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-muted" />
              Linked Deal *
            </label>
            <select
              required
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            >
              <option value="">Select a deal...</option>
              {(dealsData?.data || []).map((d: any) => (
                <option key={d._id} value={d._id}>
                  {d.title} (₹{((d.value || 0) / 100).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-muted" />
              Account (Company) *
            </label>
            <select
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            >
              <option value="">Select an account...</option>
              {(accountsData?.data || []).map((a: any) => (
                <option key={a._id} value={a._id}>
                  {a.name} {a.state ? `(${a.state})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-muted" />
              Primary Contact *
            </label>
            <select
              required
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
            >
              <option value="">Select a contact...</option>
              {(contactsData?.data || []).map((c: any) => (
                <option key={c._id} value={c._id}>
                  {c.firstName} {c.lastName} ({c.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          {type === 'quote' ? (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted" />
                Quote Validity Expiry Date *
              </label>
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  Issue Date *
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  Payment Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Approval Warning Alert */}
      {(hasHighDiscount || hasHighValue) && (
        <div className="bg-[#FFFAEB] dark:bg-[#7A2E0E]/20 border border-[#FEDF89] dark:border-[#B54708]/40 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#B54708] shrink-0 mt-0.5" />
          <div className="text-xs text-[#7A2E0E] dark:text-[#FEDF89]">
            <p className="font-semibold text-sm">Requires Manager Approval Before Sending</p>
            <p className="mt-0.5">
              {hasHighDiscount && '• Line discount exceeds 15% threshold. '}
              {hasHighValue && '• Total amount exceeds ₹10,00,000 threshold. '}
              Sales users will place this {type} into <strong>Pending Approval</strong> upon sending.
            </p>
          </div>
        </div>
      )}

      {/* Line Items Table */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Line Items</h3>
            <p className="text-xs text-muted">Add products from your catalog or define custom line items.</p>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 font-semibold text-muted">
                <th className="py-2.5 px-3 w-56">Catalog / Item Name</th>
                <th className="py-2.5 px-3 w-48">Description</th>
                <th className="py-2.5 px-3 w-20">Qty</th>
                <th className="py-2.5 px-3 w-28">Unit Price (₹)</th>
                <th className="py-2.5 px-3 w-24">Disc (%)</th>
                <th className="py-2.5 px-3 w-24">Tax Rate</th>
                <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, idx) => {
                const lineRaw = (it.qty || 0) * (it.unitPrice || 0);
                const lineDisc = Math.round((lineRaw * (it.discountPct || 0)) / 100);
                const lineTaxable = Math.max(0, lineRaw - lineDisc);
                const lineTax = Math.round((lineTaxable * (it.taxRate || 0)) / 100);
                const lineTotal = lineTaxable + lineTax;

                return (
                  <tr key={idx} className="hover:bg-[#F9F9FB] dark:hover:bg-[#202025]/40 transition-colors">
                    {/* Catalog Picker + Item Name */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-1.5">
                        <select
                          value={it.product || ''}
                          onChange={(e) => handleSelectProduct(idx, e.target.value)}
                          className="w-full px-2 py-1 text-[11px] bg-card border border-border rounded-lg text-muted focus:outline-hidden"
                        >
                          <option value="">-- Choose from Catalog --</option>
                          {(productsData?.data || []).map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({p.sku}) - {formatINR(p.unitPrice)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          placeholder="Item name *"
                          value={it.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          className="w-full px-2.5 py-1 text-xs bg-transparent border border-border rounded-lg font-medium text-foreground focus:outline-hidden"
                        />
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-2.5 px-3">
                      <textarea
                        rows={2}
                        placeholder="Description..."
                        value={it.description}
                        onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-transparent border border-border rounded-lg text-muted focus:outline-hidden resize-none"
                      />
                    </td>

                    {/* Qty */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="1"
                        required
                        value={it.qty}
                        onChange={(e) => handleUpdateItem(idx, 'qty', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 text-xs bg-transparent border border-border rounded-lg text-foreground focus:outline-hidden"
                      />
                    </td>

                    {/* Unit Price (in Rupees) */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={paiseToRupees(it.unitPrice)}
                        onChange={(e) =>
                          handleUpdateItem(idx, 'unitPrice', rupeesToPaise(parseFloat(e.target.value) || 0))
                        }
                        className="w-full px-2 py-1 text-xs bg-transparent border border-border rounded-lg text-foreground focus:outline-hidden font-medium"
                      />
                    </td>

                    {/* Discount % */}
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={it.discountPct}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'discountPct', parseFloat(e.target.value) || 0)
                          }
                          className={`w-full pr-5 pl-2 py-1 text-xs bg-transparent border rounded-lg focus:outline-hidden ${
                            (it.discountPct || 0) > 15
                              ? 'border-orange-500 font-bold text-orange-600'
                              : 'border-border text-foreground'
                          }`}
                        />
                        <span className="absolute right-2 top-1 text-muted text-[10px]">%</span>
                      </div>
                    </td>

                    {/* Tax Rate % */}
                    <td className="py-2.5 px-3">
                      <select
                        value={it.taxRate}
                        onChange={(e) => handleUpdateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-hidden"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18% (Standard)</option>
                        <option value="28">28%</option>
                      </select>
                    </td>

                    {/* Amount */}
                    <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                      {formatINR(lineTotal)}
                    </td>

                    {/* Delete */}
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="p-1 text-muted hover:text-red-500 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals Panel & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Notes and Terms */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Client Notes (Visible on Document)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Thanks for your business! Please review the scope of work."
              className="w-full px-3 py-2 text-xs bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Terms & Conditions
            </label>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Standard payment terms, validity window..."
              className="w-full px-3 py-2 text-xs bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
            />
          </div>
        </div>

        {/* Live Totals Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted pb-2 border-b border-border">
            Live Computed Totals
          </h3>

          <div className="flex justify-between text-xs py-1 text-muted">
            <span>Subtotal (Gross)</span>
            <span className="font-semibold text-foreground">{formatINR(liveTotals.subtotal)}</span>
          </div>

          {liveTotals.discountTotal > 0 && (
            <div className="flex justify-between text-xs py-1 text-[#027A48] dark:text-[#6CE9A6]">
              <span>Discount</span>
              <span className="font-semibold">- {formatINR(liveTotals.discountTotal)}</span>
            </div>
          )}

          <div className="flex justify-between text-xs py-1 text-muted border-t border-border pt-2">
            <span>Taxable Amount</span>
            <span className="font-semibold text-foreground">{formatINR(liveTotals.taxableTotal)}</span>
          </div>

          {taxMode === 'intra' ? (
            <>
              <div className="flex justify-between text-xs py-0.5 text-muted">
                <span>CGST (Central GST)</span>
                <span className="font-medium text-foreground">{formatINR(liveTotals.cgstTotal)}</span>
              </div>
              <div className="flex justify-between text-xs py-0.5 text-muted">
                <span>SGST (State GST)</span>
                <span className="font-medium text-foreground">{formatINR(liveTotals.sgstTotal)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-xs py-0.5 text-muted">
              <span>IGST (Integrated GST)</span>
              <span className="font-medium text-foreground">{formatINR(liveTotals.igstTotal)}</span>
            </div>
          )}

          <div className="flex justify-between text-base font-bold text-foreground border-t-2 border-border pt-3">
            <span>Total Payable Amount</span>
            <span>{formatINR(liveTotals.total)}</span>
          </div>

          {/* Amount in Indian Words */}
          <div className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1E1E24]/60 border border-border text-xs text-muted italic">
            <span className="font-semibold not-italic block text-[10px] text-foreground uppercase tracking-wider">
              Amount in words:
            </span>
            {liveTotals.amountInWords}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-muted hover:text-foreground rounded-xl border border-border hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Cancel & Back
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          {isSaving ? 'Saving...' : `Save ${type === 'quote' ? 'Quote' : 'Invoice'}`}
        </button>
      </div>
    </form>
  );
};
