import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  EyeOff,
} from 'lucide-react';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../api/phase3.js';
import { Product, ProductUnit } from '../types/index.js';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';

export const ProductsPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    unitPriceRupees: 0,
    taxRate: 18,
    unit: 'nos' as ProductUnit,
    active: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      success('Product created successfully');
      handleCloseDrawer();
    },
    onError: (err: any) => {
      error(err.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      success('Product updated successfully');
      handleCloseDrawer();
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update product');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      success('Product deleted successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete product');
    },
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      description: '',
      unitPriceRupees: 0,
      taxRate: 18,
      unit: 'nos',
      active: true,
    });
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      description: p.description || '',
      unitPriceRupees: paiseToRupees(p.unitPrice),
      taxRate: p.taxRate,
      unit: p.unit,
      active: p.active,
    });
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) {
      error('Name and SKU are required');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      description: formData.description.trim(),
      unitPrice: rupeesToPaise(Number(formData.unitPriceRupees)),
      taxRate: Number(formData.taxRate),
      unit: formData.unit,
      active: formData.active,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleActive = (p: Product) => {
    updateMutation.mutate({
      id: p._id,
      payload: { active: !p.active },
    });
  };

  const handleDelete = (p: Product) => {
    if (confirm(`Are you sure you want to delete product "${p.name}"? Products linked to quotes or invoices cannot be deleted.`)) {
      deleteMutation.mutate(p._id);
    }
  };

  const products = (data?.data || []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive =
      filterActive === 'all'
        ? true
        : filterActive === 'active'
        ? p.active
        : !p.active;
    return matchesSearch && matchesActive;
  });

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      {/* Header Banner */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Package className="w-6 h-6 text-foreground" />
              Products & Catalog
            </h1>
            <p className="text-sm text-muted mt-1">
              Manage your billable products, service rates, SKUs, and default tax rates.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </Reveal>

      {/* Filter and Search Bar */}
      <Reveal direction="down" delay={0.05}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground placeholder:text-muted"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted font-medium">Status:</span>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-xl text-foreground font-medium focus:outline-hidden"
            >
              <option value="all">All Products</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </Reveal>

      {/* Products Table Card */}
      <Reveal direction="up" delay={0.1}>
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] dark:bg-[#202025] flex items-center justify-center text-muted mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No products found</h3>
              <p className="text-xs text-muted mt-1 max-w-sm">
                {searchTerm
                  ? 'No products matched your search criteria.'
                  : 'Get started by creating your first catalog product or service item.'}
              </p>
              {!searchTerm && (
                <button
                  onClick={handleOpenCreate}
                  className="mt-4 px-3.5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-medium hover:bg-neutral-800 transition-colors"
                >
                  Create Product
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 text-xs font-semibold text-muted">
                    <th className="py-3 px-4">Product & Description</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Unit Price</th>
                    <th className="py-3 px-4">Tax (GST)</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => (
                    <tr
                      key={p._id}
                      className="hover:bg-[#F9F9FB] dark:hover:bg-[#202025]/50 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted line-clamp-1 mt-0.5">{p.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-medium text-foreground">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {formatINR(p.unitPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-muted">
                        {p.taxRate}%
                      </td>
                      <td className="py-3.5 px-4 uppercase text-xs font-medium text-muted">
                        {p.unit}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#ECFDF3] text-[#027A48] dark:bg-[#027A48]/20 dark:text-[#6CE9A6]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4F4F5] text-muted dark:bg-[#27272A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleActive(p)}
                            title={p.active ? 'Deactivate product' : 'Activate product'}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit product"
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#27272A] transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            title="Delete product"
                            className="p-1.5 rounded-lg text-muted hover:text-[#B42318] hover:bg-[#FDE4E4]/40 dark:hover:bg-[#B42318]/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>

      {/* Create / Edit Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDrawer}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-black dark:bg-white text-white dark:text-black">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                      </h2>
                      <p className="text-xs text-muted">
                        Configure pricing, SKU, and tax rates.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseDrawer}
                    className="p-1.5 rounded-lg text-muted hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Product / Service Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Enterprise License, Consulting Hours"
                      className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      SKU (Unique Identifier) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. PROD-001, SERV-CONSULT"
                      className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional brief description of what this item includes"
                      className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Unit Price (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={formData.unitPriceRupees}
                        onChange={(e) =>
                          setFormData({ ...formData, unitPriceRupees: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                      />
                      <span className="text-[10px] text-muted mt-1 block">
                        Stored in paise: {rupeesToPaise(Number(formData.unitPriceRupees))} paise
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Tax Rate (GST %)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.taxRate}
                        onChange={(e) =>
                          setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-transparent border border-border rounded-xl focus:outline-hidden focus:ring-1 focus:ring-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Billing Unit
                      </label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value as ProductUnit })}
                        className="w-full px-3.5 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
                      >
                        <option value="nos">Numbers (nos)</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="months">Months</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer py-2">
                        <input
                          type="checkbox"
                          checked={formData.active}
                          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                          className="w-4 h-4 rounded text-black focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-foreground">Active Catalog Item</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
                    <button
                      type="button"
                      onClick={handleCloseDrawer}
                      className="px-4 py-2 text-xs font-medium text-muted hover:text-foreground rounded-xl border border-border hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="px-5 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black rounded-xl hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {editingProduct ? 'Save Changes' : 'Create Product'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
