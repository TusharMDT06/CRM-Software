import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';
import { CommandPalette } from './CommandPalette.js';
import { ImpersonationBanner } from '../common/ImpersonationBanner.js';
import { CopilotPanel } from '../ai/CopilotPanel.js';
import { getAiStatus } from '../../api/ai.js';
import { useRealtime } from '../../hooks/useRealtime.js';

const SIDEBAR_COLLAPSED_KEY = 'flowdesk_sidebar_collapsed';

export const AppLayout: React.FC = () => {
  // Activate Socket.IO realtime sync across the application
  useRealtime();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const location = useLocation();

  useEffect(() => {
    getAiStatus()
      .then((status) => {
        if (status.isConfigured && status.aiEnabled) {
          setAiEnabled(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {}
      return next;
    });
  };

  // Determine page title based on path
  const getPageInfo = () => {
    const path = location.pathname;
    if (path.startsWith('/leads')) return { title: 'Leads', subtitle: 'Pipeline prospects & qualified contacts' };
    if (path.startsWith('/contacts')) return { title: 'Contacts', subtitle: 'Customer representatives & stakeholders' };
    if (path.startsWith('/accounts')) return { title: 'Accounts', subtitle: 'Organizations & client enterprise records' };
    if (path.startsWith('/deals')) return { title: 'Deals Kanban', subtitle: 'Active opportunities across sales pipeline stages' };
    if (path.startsWith('/tasks')) return { title: 'Tasks', subtitle: 'Action items, follow-ups & due schedules' };
    if (path.startsWith('/team')) return { title: 'Team Management', subtitle: 'Manage CRM members, roles & permissions' };
    return { title: 'Dashboard', subtitle: 'Revenue growth, active deals & pipeline metrics' };
  };

  const { title, subtitle } = getPageInfo();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Ctrl+B or Cmd+B to toggle sidebar (like VS Code / Notion)
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-2 sm:p-4 md:p-6 lg:p-8 flex items-center justify-center">
      {/* App Shell Container */}
      <div className="w-full max-w-[1600px] h-[94vh] bg-card rounded-container border border-border shadow-sm flex flex-col overflow-hidden relative">
        <ImpersonationBanner />

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex h-full">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
            />
          </div>

        {/* Mobile Sidebar Drawer */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-64 bg-card z-10 shadow-2xl">
              <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <TopBar
            title={title}
            subtitle={subtitle}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            onOpenCopilot={aiEnabled ? () => setCopilotOpen(true) : undefined}
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-card-subtle">
            <Outlet />
          </main>
        </div>
        </div>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Right-Side Collapsible Copilot Panel */}
      <CopilotPanel
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </div>
  );
};
