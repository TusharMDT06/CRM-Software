import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
} from 'lucide-react';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../api/phase3.js';
import { Notification } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();
  const queryClient = useQueryClient();

  const [unreadFilter, setUnreadFilter] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notificationsAll', unreadFilter, page],
    queryFn: () => fetchNotifications({ unread: unreadFilter, page, limit: 25 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsAll'] });
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationsAll'] });
      queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
      success('All notifications marked as read');
    },
  });

  const notifications = data?.data || [];
  const meta = data?.meta;

  const handleNotificationClick = (n: Notification) => {
    if (!n.readAt) {
      markReadMutation.mutate(n._id);
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quote_accepted':
      case 'invoice_paid':
      case 'deal_won':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'invoice_overdue':
      case 'task_overdue':
      case 'deal_lost':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'quote_needs_approval':
        return <Clock className="w-5 h-5 text-orange-500" />;
      case 'quote_viewed':
        return <FileText className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-neutral-500" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full gap-6">
      {/* Header */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-foreground" />
              Notifications
            </h1>
            <p className="text-sm text-muted mt-1">
              Activity alerts across deals, quotes, overdue invoices, and assigned tasks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All as Read
            </button>
          </div>
        </div>
      </Reveal>

      {/* Filter Tabs */}
      <Reveal direction="down" delay={0.05}>
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => {
              setUnreadFilter(false);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              !unreadFilter
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'text-muted hover:text-foreground'
            }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => {
              setUnreadFilter(true);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              unreadFilter
                ? 'bg-black dark:bg-white text-white dark:text-black'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Unread Only {meta?.unreadCount ? `(${meta.unreadCount})` : ''}
          </button>
        </div>
      </Reveal>

      {/* List */}
      <Reveal direction="up" delay={0.1}>
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted">
              {unreadFilter ? 'You have no unread notifications.' : 'No notifications found.'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 flex items-start gap-4 cursor-pointer transition-colors ${
                    !n.readAt
                      ? 'bg-[#F9F9FB] dark:bg-[#202025]/60 hover:bg-[#F4F4F5]'
                      : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 opacity-80'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-card border border-border shadow-2xs shrink-0">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-foreground">{n.title}</h3>
                      <span className="text-[11px] text-muted shrink-0">
                        {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                  {!n.readAt && (
                    <span className="w-2 h-2 rounded-full bg-[#F07B2A] shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
};
