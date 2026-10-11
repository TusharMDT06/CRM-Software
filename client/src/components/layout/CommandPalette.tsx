import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { modalVariants, backdropVariants } from '../../lib/motion.js';
import {
  Search,
  LayoutDashboard,
  Users2,
  Contact,
  Building2,
  Kanban,
  CheckSquare,
  ShieldCheck,
  Mail,
  BarChart3,
  Settings,
  PlusCircle,
  Moon,
  Sun,
  LogOut,
  X,
  Sparkles,
  Loader2,
  ArrowRight,
  Tag,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import {
  searchWithNaturalLanguage,
  getAiStatus,
  NlSearchData,
  NlFilterChip,
} from '../../api/ai.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateDrawer?: (type: 'lead' | 'deal' | 'task' | 'contact' | 'account') => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenCreateDrawer,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [nlResults, setNlResults] = useState<NlSearchData | null>(null);
  const [activeChips, setActiveChips] = useState<NlFilterChip[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);

  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    getAiStatus()
      .then((status) => {
        if (status.isConfigured && status.aiEnabled) {
          setAiAvailable(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleRunNlSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const data = await searchWithNaturalLanguage(searchQuery.trim());
      setNlResults(data);
      setActiveChips(data.chips || []);
    } catch (err: any) {
      console.error('NL search error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRemoveChip = (indexToRemove: number) => {
    const updated = activeChips.filter((_, idx) => idx !== indexToRemove);
    setActiveChips(updated);
  };

  const commands = [
    // Navigation
    {
      category: 'Pages',
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: LayoutDashboard,
      action: () => navigate('/dashboard'),
    },
    {
      category: 'Pages',
      id: 'nav-leads',
      label: 'Go to Leads',
      icon: Users2,
      action: () => navigate('/leads'),
    },
    {
      category: 'Pages',
      id: 'nav-contacts',
      label: 'Go to Contacts',
      icon: Contact,
      action: () => navigate('/contacts'),
    },
    {
      category: 'Pages',
      id: 'nav-accounts',
      label: 'Go to Accounts',
      icon: Building2,
      action: () => navigate('/accounts'),
    },
    {
      category: 'Pages',
      id: 'nav-deals',
      label: 'Go to Deals (Kanban)',
      icon: Kanban,
      action: () => navigate('/deals'),
    },
    {
      category: 'Pages',
      id: 'nav-tasks',
      label: 'Go to Tasks',
      icon: CheckSquare,
      action: () => navigate('/tasks'),
    },
    {
      category: 'Pages',
      id: 'nav-templates',
      label: 'Go to Email Templates',
      icon: Mail,
      action: () => navigate('/templates'),
    },
    {
      category: 'Pages',
      id: 'nav-reports',
      label: 'Go to Reports & Analytics',
      icon: BarChart3,
      action: () => navigate('/reports'),
    },
    ...(isAdmin
      ? [
          {
            category: 'Pages',
            id: 'nav-team',
            label: 'Go to Team Management',
            icon: ShieldCheck,
            action: () => navigate('/team'),
          },
          {
            category: 'Pages',
            id: 'nav-settings',
            label: 'Go to Custom Fields Settings',
            icon: Settings,
            action: () => navigate('/settings/custom-fields'),
          },
        ]
      : []),

    // Quick Actions
    {
      category: 'Actions',
      id: 'action-new-lead',
      label: 'New Lead',
      icon: PlusCircle,
      action: () => {
        if (onOpenCreateDrawer) onOpenCreateDrawer('lead');
        else navigate('/leads?action=create');
      },
    },
    {
      category: 'Actions',
      id: 'action-new-deal',
      label: 'Create Deal',
      icon: PlusCircle,
      action: () => {
        if (onOpenCreateDrawer) onOpenCreateDrawer('deal');
        else navigate('/deals?action=create');
      },
    },
    {
      category: 'Actions',
      id: 'action-new-task',
      label: 'Add Task',
      icon: PlusCircle,
      action: () => {
        if (onOpenCreateDrawer) onOpenCreateDrawer('task');
        else navigate('/tasks?action=create');
      },
    },
    {
      category: 'Actions',
      id: 'action-new-contact',
      label: 'Add Contact',
      icon: PlusCircle,
      action: () => {
        if (onOpenCreateDrawer) onOpenCreateDrawer('contact');
        else navigate('/contacts?action=create');
      },
    },
    {
      category: 'Actions',
      id: 'action-new-account',
      label: 'Add Account',
      icon: PlusCircle,
      action: () => {
        if (onOpenCreateDrawer) onOpenCreateDrawer('account');
        else navigate('/accounts?action=create');
      },
    },

    // Preferences
    {
      category: 'Preferences',
      id: 'pref-theme',
      label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      icon: theme === 'dark' ? Sun : Moon,
      action: () => toggleTheme(),
    },
    {
      category: 'Preferences',
      id: 'pref-logout',
      label: 'Log out',
      icon: LogOut,
      action: () => logout(),
    },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery('');
          // open triggered from AppLayout
        }
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filtered, selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette Container */}
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-card border border-border w-full max-w-xl rounded-card shadow-2xl overflow-hidden z-10"
          >
        {/* Search header */}
        <div className="flex items-center px-4 py-3.5 border-b border-border gap-2.5">
          {aiMode ? (
            <Sparkles className="w-4 h-4 text-primary shrink-0 animate-pulse" />
          ) : (
            <Search className="w-4 h-4 text-muted shrink-0" />
          )}

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && aiMode) {
                e.preventDefault();
                handleRunNlSearch(query);
              }
            }}
            placeholder={
              aiMode
                ? "Search natural language: e.g. 'hot leads', 'deals over 5 lakh'..."
                : 'Type a command or search...'
            }
            autoFocus
            className="w-full bg-transparent text-foreground placeholder:text-muted text-sm focus:outline-none"
          />

          {aiAvailable && (
            <button
              type="button"
              onClick={() => {
                setAiMode(!aiMode);
                setNlResults(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                aiMode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card-subtle text-muted hover:text-foreground border border-border'
              }`}
              title="Toggle Natural Language Search"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Mode</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-foreground rounded transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AI Natural Language Mode Body */}
        {aiMode ? (
          <div className="max-h-80 overflow-y-auto">
            {aiLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-muted text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Interpreting search filter with Gemini...</span>
              </div>
            ) : nlResults ? (
              <div className="divide-y divide-border/40">
                {/* Explanation and Filter Chips */}
                <div className="p-3 bg-primary/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{nlResults.explanation}</span>
                    <span className="text-[10px] text-muted">
                      {nlResults.total} result{nlResults.total === 1 ? '' : 's'}
                    </span>
                  </div>

                  {activeChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeChips.map((chip, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-card border border-primary/30 text-foreground shadow-xs"
                        >
                          <Tag className="w-2.5 h-2.5 text-primary" />
                          <span>{chip.label}</span>
                          <button
                            onClick={() => handleRemoveChip(idx)}
                            className="text-muted hover:text-rose-500 ml-0.5"
                            title="Remove filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Result records list */}
                <div className="p-2 space-y-1">
                  {nlResults.results.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted">
                      No records matched these filtered criteria.
                    </div>
                  ) : (
                    nlResults.results.map((rec: any) => (
                      <div
                        key={rec._id}
                        onClick={() => {
                          navigate(`/${nlResults.entity}/${rec._id}`);
                          onClose();
                        }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-foreground">
                            {rec.name || rec.title || rec.subject}
                          </p>
                          <p className="text-[11px] text-muted">
                            {rec.company || rec.email || rec.stage || rec.status}
                            {rec.value ? ` • ₹${rec.value.toLocaleString('en-IN')}` : ''}
                            {rec.amount ? ` • ₹${rec.amount.toLocaleString('en-IN')}` : ''}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Suggestion Prompts */
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted">
                  Type any natural language query and press Enter. Try these:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'hot leads from last month',
                    'deals over 5 lakh closing this week',
                    'qualified prospects in Mumbai',
                    'urgent open tickets',
                  ].map((sugg) => (
                    <button
                      key={sugg}
                      onClick={() => {
                        setQuery(sugg);
                        handleRunNlSearch(sugg);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg border border-border bg-card hover:bg-card-subtle text-foreground text-left transition-colors"
                    >
                      "{sugg}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Commands Results List */
          <div className="max-h-80 overflow-y-auto p-2 divide-y divide-border/40">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">No commands found</div>
            ) : (
              filtered.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-sm transition-colors ${
                      isSelected
                        ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                        : 'text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0 opacity-80" />
                      <span>{item.label}</span>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'text-white/70 dark:text-black/70'
                          : 'text-muted bg-[#ECECEF] dark:bg-[#2A2A32]'
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[#FAFAFA] dark:bg-[#1C1C22] border-t border-border flex items-center justify-between text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-card border border-border rounded text-[10px]">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-card border border-border rounded text-[10px]">↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px]">↵</kbd> select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px]">esc</kbd> close
            </span>
          </div>
        </div>
      </motion.div>
    </div>
    )}
  </AnimatePresence>
  );
};
