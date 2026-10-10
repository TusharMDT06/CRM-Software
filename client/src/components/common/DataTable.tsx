import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton.js';
import { Pagination } from '../../types/index.js';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION } from '../../lib/motion.js';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  sort?: string;
  onSortChange?: (newSort: string) => void;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
  emptyState?: React.ReactNode;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  storageKey?: string;
}

export function DataTable<T extends { _id: string }>({
  columns,
  data,
  isLoading,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  sort,
  onSortChange,
  pagination,
  onPageChange,
  onRowClick,
  emptyState,
  filterSlot,
  actionSlot,
  storageKey,
}: DataTableProps<T>) {
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch (_) {}
    }
    return columns.map((c) => c.key);
  });

  const reducedMotion = useReducedMotion();
  const isFirstMountRef = React.useRef(true);

  React.useEffect(() => {
    isFirstMountRef.current = false;
  }, []);

  // Ensure new columns are added if columns definition changes
  useEffect(() => {
    if (!storageKey) {
      setVisibleColumnKeys(columns.map((c) => c.key));
    }
  }, [columns, storageKey]);

  const toggleColumn = (key: string) => {
    let next: string[];
    if (visibleColumnKeys.includes(key)) {
      if (visibleColumnKeys.length <= 1) return; // Keep at least one column
      next = visibleColumnKeys.filter((k) => k !== key);
    } else {
      next = [...visibleColumnKeys, key];
    }
    setVisibleColumnKeys(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {}
    }
  };

  const visibleColumns = storageKey
    ? columns.filter((c) => visibleColumnKeys.includes(c.key))
    : columns;

  const currentSortField = sort?.split(':')[0];
  const currentSortOrder = sort?.split(':')[1];

  const handleHeaderClick = (colKey: string, sortable?: boolean) => {
    if (!sortable || !onSortChange) return;
    if (currentSortField === colKey) {
      onSortChange(`${colKey}:${currentSortOrder === 'asc' ? 'desc' : 'asc'}`);
    } else {
      onSortChange(`${colKey}:asc`);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
          />
        </div>

        {/* Right: Filters, Column Chooser & Action Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {filterSlot}

          {/* Columns Visibility Menu */}
          {storageKey && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnMenuOpen(!columnMenuOpen)}
                className={`p-2 rounded-xl border border-border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  columnMenuOpen
                    ? 'bg-card text-foreground border-black dark:border-white shadow-xs'
                    : 'bg-card text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025]'
                }`}
                title="Choose visible columns"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </button>

              {columnMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-card border border-border rounded-xl shadow-lg z-50 p-2 text-xs space-y-1">
                  <div className="px-2 py-1 font-semibold text-[11px] text-muted uppercase tracking-wider border-b border-border/60">
                    Toggle Columns
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-0.5 pt-1">
                    {columns.map((c) => {
                      const isVis = visibleColumnKeys.includes(c.key);
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => toggleColumn(c.key)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
                        >
                          <span className="truncate">{c.header}</span>
                          {isVis && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {actionSlot}
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-border rounded-card bg-card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={visibleColumns.length} />
        ) : data.length === 0 ? (
          <div className="p-8">{emptyState}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 text-xs font-medium text-muted uppercase tracking-wider">
                  {visibleColumns.map((col) => {
                    const isSorted = currentSortField === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={() => handleHeaderClick(col.key, col.sortable)}
                        className={`py-3.5 px-5 select-none ${col.className || ''} ${
                          col.sortable ? 'cursor-pointer hover:text-foreground transition-colors' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.header}</span>
                          {col.sortable && (
                            <span className="text-muted/60">
                              {isSorted ? (
                                currentSortOrder === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-foreground" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-foreground" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((item, index) => {
                  const isFirstTen = index < 10;
                  const isFirstMount = isFirstMountRef.current && !reducedMotion;

                  const initial = isFirstMount && isFirstTen ? { opacity: 0, y: -4 } : { opacity: 0 };
                  const animate = { opacity: 1, y: 0 };
                  const transition =
                    isFirstMount && isFirstTen
                      ? { duration: 0.25, delay: index * 0.03, ease: MOTION.easing.easeOut }
                      : { duration: 0.12 };

                  return (
                    <motion.tr
                      key={item._id}
                      initial={reducedMotion ? false : initial}
                      animate={reducedMotion ? false : animate}
                      transition={reducedMotion ? undefined : transition}
                      onClick={() => onRowClick && onRowClick(item)}
                      className={`transition-colors duration-100 ${
                        onRowClick ? 'cursor-pointer hover:bg-[#F8F8FA] dark:hover:bg-[#202026]' : ''
                      }`}
                    >
                      {visibleColumns.map((col) => (
                        <td key={col.key} className={`py-3 px-5 text-foreground text-sm ${col.className || ''}`}>
                          {col.render ? col.render(item) : ((item as any)[col.key] ?? '-')}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-border flex items-center justify-between text-xs text-muted bg-[#FAFAFA] dark:bg-[#1C1C22]">
            <span>
              Showing <span className="font-medium text-foreground">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-medium text-foreground">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-medium text-foreground">{pagination.total}</span> records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange && onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-foreground font-medium">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange && onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
