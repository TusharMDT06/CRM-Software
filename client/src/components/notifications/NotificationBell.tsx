import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  fetchUnreadNotificationCount,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../api/phase3.js';
import { Notification } from '../../types/index.js';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Polling unread count every 30 seconds (paused when tab hidden by react-query defaults)
  const { data: countData } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: () => fetchUnreadNotificationCount(),
    refetchInterval: 30000,
  });

  // 2. Fetch list when popover opens
  const { data: listData } = useQuery({
    queryKey: ['notificationsListTop'],
    queryFn: () => fetchNotifications({ limit: 20 }),
    enabled: isOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
      queryClient.invalidateQueries({ queryKey: ['notificationsListTop'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
      queryClient.invalidateQueries({ queryKey: ['notificationsListTop'] });
    },
  });

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = countData?.unreadCount || 0;
  const notifications = listData?.data || [];

  const handleNotificationClick = (n: Notification) => {
    if (!n.readAt) {
      markReadMutation.mutate(n._id);
    }
    setIsOpen(false);
    if (n.link) {
      navigate(n.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quote_accepted':
      case 'invoice_paid':
      case 'deal_won':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'invoice_overdue':
      case 'task_overdue':
      case 'deal_lost':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'quote_needs_approval':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'quote_viewed':
        return <FileText className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-neutral-500" />;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        className="p-2 rounded-xl border border-border text-muted hover:text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors relative"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#F07B2A] text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col"
          >
            {/* Popover Header */}
            <div className="p-3.5 border-b border-border flex items-center justify-between bg-[#FAFAFA] dark:bg-[#1E1E24]/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-[#F07B2A]/10 text-[#F07B2A]">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  className="text-[11px] font-semibold text-muted hover:text-foreground inline-flex items-center gap-1 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                      !n.readAt
                        ? 'bg-[#F9F9FB] dark:bg-[#202025]/60 hover:bg-[#F4F4F5] dark:hover:bg-[#202025]'
                        : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 opacity-75'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-muted shrink-0">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    </div>
                    {!n.readAt && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F07B2A] shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Popover Footer */}
            <div className="p-2.5 border-t border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="text-xs font-semibold text-foreground hover:underline inline-flex items-center gap-1"
              >
                View all notifications
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
