import React, { useState, useEffect } from 'react';
import { Search, Sun, Moon, Menu, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { NotificationBell } from '../notifications/NotificationBell.js';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onOpenCommandPalette: () => void;
  onOpenMobileSidebar: () => void;
  onOpenCopilot?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  onOpenCommandPalette,
  onOpenMobileSidebar,
  onOpenCopilot,
}) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [syncTime, setSyncTime] = useState('Last synced just now');

  useEffect(() => {
    const timer = setInterval(() => {
      const minutes = Math.floor((Date.now() % 3600000) / 60000) % 5 + 1;
      setSyncTime(`Last synced ${minutes} min ago`);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0 gap-4">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-muted hover:text-foreground rounded-lg border border-border"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">
            {title}
          </h1>
          <p className="text-[11px] text-muted mt-1 font-normal">
            {subtitle || syncTime}
          </p>
        </div>
      </div>

      {/* Right: Search bar (Ctrl+K), Dark mode toggle, Avatar */}
      <div className="flex items-center gap-3">
        {/* Rounded search field opening command palette */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-full border border-border bg-[#F4F4F5] dark:bg-[#202025] text-xs text-muted hover:text-foreground hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors w-64 justify-between"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search or jump to...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-card border border-border text-[10px] font-medium text-foreground">
            Ctrl K
          </kbd>
        </button>

        {/* Mobile search button */}
        <button
          onClick={onOpenCommandPalette}
          className="sm:hidden p-2 rounded-xl text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025]"
          aria-label="Open command search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Copilot AI Trigger Button */}
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors shadow-sm"
            title="Open Flowdesk Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Copilot</span>
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Phase 3 Notification Bell */}
        <NotificationBell />

        {/* User Avatar */}
        <div
          title={user?.name}
          className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-medium text-xs select-none shadow-sm"
        >
          {getInitials(user?.name)}
        </div>
      </div>
    </header>
  );
};
