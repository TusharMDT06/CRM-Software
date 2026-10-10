import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Phone,
  Calendar,
  Mail,
  CheckCircle2,
  TrendingUp,
  Info,
} from 'lucide-react';
import { Activity, ActivityType } from '../../types/index.js';
import { api } from '../../api/client.js';
import { formatDate } from '../../utils/formatters.js';

export const RecentActivityCard: React.FC = () => {
  const navigate = useNavigate();

  const { data: responseData, isLoading } = useQuery({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const res = await api.get('/activities?limit=8');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const activities: Activity[] = responseData?.data || [];

  const getTypeConfig = (type: ActivityType) => {
    switch (type) {
      case 'note':
        return {
          icon: FileText,
          bg: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
        };
      case 'call':
        return {
          icon: Phone,
          bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        };
      case 'meeting':
        return {
          icon: Calendar,
          bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
        };
      case 'email':
        return {
          icon: Mail,
          bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
        };
      case 'task':
        return {
          icon: CheckCircle2,
          bg: 'bg-[#FDEBDD] text-[#F07B2A] dark:bg-[#F07B2A]/20 dark:text-[#F07B2A]',
        };
      case 'stage_change':
        return {
          icon: TrendingUp,
          bg: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
        };
      case 'system':
      default:
        return {
          icon: Info,
          bg: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
        };
    }
  };

  const getEntityRoute = (entityType: string, entityId: string) => {
    switch (entityType) {
      case 'lead':
        return `/leads/${entityId}`;
      case 'contact':
        return `/contacts/${entityId}`;
      case 'account':
        return `/accounts/${entityId}`;
      case 'deal':
        return `/deals/${entityId}`;
      default:
        return '/dashboard';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(isoString);
  };

  return (
    <div className="p-5 bg-card rounded-card border border-border shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
        <span className="text-[11px] text-muted font-medium">Last 8 events</span>
      </div>

      <div className="space-y-2.5">
        {isLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-[#F4F4F5] dark:bg-[#202025] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">No recent activity logged.</p>
        ) : (
          activities.map((act) => {
            const cfg = getTypeConfig(act.type);
            const Icon = cfg.icon;
            const author = typeof act.createdBy === 'object' ? act.createdBy : null;
            const authorName = author?.name || 'System';

            return (
              <div
                key={act._id}
                onClick={() => navigate(getEntityRoute(act.entityType, act.entityId))}
                className="p-2.5 rounded-xl border border-border/70 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors cursor-pointer group bg-card"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${cfg.bg}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground group-hover:text-brand transition-colors line-clamp-1 leading-snug">
                      {act.subject}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted">
                      <span className="truncate max-w-[120px]">By {authorName}</span>
                      <span title={new Date(act.occurredAt || act.createdAt).toLocaleString('en-IN')}>
                        {formatRelativeTime(act.occurredAt || act.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
