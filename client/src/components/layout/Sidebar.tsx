import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users2,
  Contact,
  Building2,
  Kanban,
  CheckSquare,
  Package,
  FileText,
  Receipt,
  Zap,
  Mail,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Building,
  Bell,
  Settings,
  LogOut,
  X,
  LifeBuoy,
  Sparkles,
  Radio,
  FileInput,
  Target,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  FolderArchive,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface SidebarProps {
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile, collapsed = false, onToggleCollapse }) => {
  const { user, isAdmin, isManager, isPlatformAdmin, tenant, logout } = useAuth();

  const sections = [
    {
      title: 'Admin',
      items: [
        ...(isPlatformAdmin ? [{ to: '/platform', label: 'Platform Admin', icon: Shield }] : []),
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/reports', label: 'Reports', icon: BarChart3 },
        ...(isAdmin ? [{ to: '/audit-log', label: 'Audit Log', icon: ShieldAlert }] : []),
        ...(isAdmin ? [{ to: '/team', label: 'Team', icon: ShieldCheck }] : []),
        ...(isAdmin ? [{ to: '/settings/company', label: 'Company Settings', icon: Building }] : []),
        ...(isAdmin ? [{ to: '/settings/ai', label: 'AI Intelligence', icon: Sparkles }] : []),
        { to: '/settings/notifications', label: 'Notifications', icon: Bell },
        ...(isAdmin ? [{ to: '/settings/custom-fields', label: 'Custom Fields', icon: Settings }] : []),
      ],
    },
    {
      title: 'Sales',
      items: [
        { to: '/leads', label: 'Leads', icon: Users2 },
        { to: '/contacts', label: 'Contacts', icon: Contact },
        { to: '/accounts', label: 'Accounts', icon: Building2 },
        { to: '/deals', label: 'Deals', icon: Kanban },
        { to: '/forecasts', label: 'Forecasts', icon: TrendingUp },
        { to: '/documents', label: 'Documents', icon: FolderArchive },
        { to: '/tasks', label: 'Tasks', icon: CheckSquare },
        { to: '/products', label: 'Products', icon: Package },
      ],
    },
    {
      title: 'Billing',
      items: [
        { to: '/quotes', label: 'Quotes', icon: FileText },
        { to: '/invoices', label: 'Invoices', icon: Receipt },
      ],
    },
    {
      title: 'Support',
      items: [
        { to: '/tickets', label: 'Tickets', icon: LifeBuoy },
      ],
    },
    {
      title: 'Automation',
      items: [
        ...(isAdmin || isManager ? [{ to: '/automations', label: 'Automations', icon: Zap }] : []),
        { to: '/templates', label: 'Templates', icon: Mail },
      ],
    },
    ...(isAdmin || isManager
      ? [
          {
            title: 'Marketing',
            items: [
              { to: '/marketing/sources', label: 'Sources', icon: Radio },
              { to: '/marketing/forms', label: 'Forms', icon: FileInput },
              { to: '/marketing/campaigns', label: 'Campaigns', icon: Target },
            ],
          },
        ]
      : []),
  ];

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 60 : 256 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="h-full flex flex-col justify-between border-r border-border bg-card shrink-0 select-none overflow-hidden relative"
      style={{ minWidth: collapsed ? 60 : 256 }}
    >
      {/* Inner scrollable content */}
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {/* Top: Logo & Grouped Nav */}
        <div className="flex flex-col gap-5 p-4 pb-2">
          {/* Logo and Brand + Toggle */}
          <div className="flex items-center justify-between px-1 pt-1">
            {/* Logo icon always visible */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-semibold text-sm shadow-sm shrink-0">
                <span className="text-[#F07B2A] mr-0.5 font-bold">F</span>D
              </div>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div
                    key="brand-text"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <span className="text-base font-semibold tracking-tight text-foreground flex items-center gap-1.5 whitespace-nowrap">
                      Flowdesk
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#FDEBDD] text-[#F07B2A] dark:bg-[#F07B2A]/20">
                        CRM
                      </span>
                    </span>
                    {tenant && (
                      <div className="text-[10px] text-muted truncate max-w-[120px] font-medium">
                        {tenant.name}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Toggle collapse button (desktop only) */}
            {!onCloseMobile && onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={`p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors shrink-0 ${collapsed ? 'mx-auto' : ''}`}
              >
                {collapsed ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Close button for mobile drawer */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-1.5 rounded-lg text-muted hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Grouped Navigation Sections */}
          <div className="flex flex-col gap-4">
            {sections.map((sec) => {
              if (sec.items.length === 0) return null;

              return (
                <div key={sec.title} className="flex flex-col gap-1">
                  {/* Section label: visible only when expanded */}
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.div
                        key={`label-${sec.title}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted whitespace-nowrap"
                      >
                        {sec.title}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Section divider when collapsed */}
                  {collapsed && (
                    <div className="mx-3 mb-1 border-t border-border/60" />
                  )}

                  <nav className="flex flex-col gap-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={onCloseMobile}
                          title={collapsed ? item.label : undefined}
                          className={`relative flex items-center gap-3 py-1.5 rounded-xl text-xs transition-colors ${
                            collapsed ? 'px-0 justify-center mx-1' : 'px-3'
                          }`}
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && (
                                <motion.div
                                  layoutId="sidebar-active-pill"
                                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                  className="absolute inset-0 rounded-xl bg-[#F4F4F5] border border-border shadow-2xs dark:bg-[#202025]"
                                />
                              )}
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 relative z-10 transition-colors ${
                                  isActive ? 'text-foreground' : 'text-muted'
                                }`}
                              />
                              <AnimatePresence initial={false}>
                                {!collapsed && (
                                  <motion.span
                                    key={`label-${item.to}`}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className={`relative z-10 transition-colors whitespace-nowrap ${
                                      isActive ? 'text-foreground font-bold' : 'text-muted'
                                    }`}
                                  >
                                    {item.label}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </nav>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom: User Card & Logout */}
        <div className="pt-4 border-t border-border mt-auto mx-4 mb-4">
          <div
            className={`flex items-center p-2 rounded-xl hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors ${
              collapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-full bg-[#111111] dark:bg-neutral-800 text-white flex items-center justify-center font-medium text-xs shrink-0 border border-border"
                title={collapsed ? user?.name : undefined}
              >
                {getInitials(user?.name)}
              </div>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div
                    key="user-info"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                    className="min-w-0"
                  >
                    <p className="text-xs font-semibold text-foreground truncate leading-snug">
                      {user?.name || 'User'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded font-bold bg-[#ECECEF] text-[#6B6B76] dark:bg-[#2A2A32] dark:text-[#A1A1AA]">
                        {user?.role}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {!collapsed && (
              <button
                onClick={() => logout()}
                title="Log out"
                className="p-1.5 text-muted hover:text-[#B42318] hover:bg-[#FDE4E4]/50 dark:hover:bg-[#B42318]/20 rounded-lg transition-colors ml-1 shrink-0"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={() => logout()}
              title="Log out"
              className="w-full mt-1 flex items-center justify-center p-1.5 text-muted hover:text-[#B42318] hover:bg-[#FDE4E4]/50 dark:hover:bg-[#B42318]/20 rounded-lg transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
};
