import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Phone,
  Calendar,
  Mail,
  CheckCircle2,
  TrendingUp,
  Info,
  Clock,
  Trash2,
  Send,
  ChevronDown,
} from 'lucide-react';
import { Activity, ActivityType, ActivityOutcome } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Button } from '../ui/Button.js';
import { formatDate } from '../../utils/formatters.js';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION } from '../../lib/motion.js';

interface TimelineTabProps {
  entityType: 'lead' | 'contact' | 'account' | 'deal';
  entityId: string;
  defaultFilter?: ActivityType;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  entityType,
  entityId,
  defaultFilter,
}) => {
  const { user, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  // Composer state
  const [activeType, setActiveType] = useState<'note' | 'call' | 'meeting'>(
    defaultFilter === 'note' ? 'note' : 'note'
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [durationMins, setDurationMins] = useState<number>(15);
  const [outcome, setOutcome] = useState<ActivityOutcome>('connected');

  // Page limit for pagination
  const [page, setPage] = useState(1);

  // Fetch activities
  const { data: responseData, isLoading } = useQuery({
    queryKey: ['activities', entityType, entityId, page],
    queryFn: async () => {
      const res = await api.get(
        `/activities?entityType=${entityType}&entityId=${entityId}&page=${page}&limit=20`
      );
      return res.data;
    },
  });

  const activities: Activity[] = responseData?.data || [];
  const pagination = responseData?.pagination;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        type: activeType,
        subject: subject.trim() || `${activeType.toUpperCase()} - ${new Date().toLocaleDateString()}`,
        body: body.trim(),
        entityType,
        entityId,
        occurredAt: new Date(occurredAt).toISOString(),
      };
      if (activeType === 'call' || activeType === 'meeting') {
        payload.durationMins = durationMins;
      }
      if (activeType === 'call') {
        payload.outcome = outcome;
      }
      const res = await api.post('/activities', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
      success('Activity logged successfully');
      setSubject('');
      setBody('');
      setOccurredAt(new Date().toISOString().slice(0, 16));
    },
    onError: (err: any) => {
      error(err.message || 'Failed to log activity');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/activities/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
      success('Activity deleted');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to delete activity');
    },
  });

  // Relative time helper
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

  // Type styling and icon config
  const getTypeConfig = (type: ActivityType) => {
    switch (type) {
      case 'note':
        return {
          icon: FileText,
          bg: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
          label: 'Note',
        };
      case 'call':
        return {
          icon: Phone,
          bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
          label: 'Call',
        };
      case 'meeting':
        return {
          icon: Calendar,
          bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
          label: 'Meeting',
        };
      case 'email':
        return {
          icon: Mail,
          bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
          label: 'Email',
        };
      case 'task':
        return {
          icon: CheckCircle2,
          bg: 'bg-[#FDEBDD] text-[#F07B2A] dark:bg-[#F07B2A]/20 dark:text-[#F07B2A]',
          label: 'Task',
        };
      case 'stage_change':
        return {
          icon: TrendingUp,
          bg: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
          label: 'Stage Change',
        };
      case 'system':
      default:
        return {
          icon: Info,
          bg: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
          label: 'System',
        };
    }
  };

  // Group activities by date
  const groupedActivities: Record<string, Activity[]> = {};
  activities.forEach((act) => {
    const actDate = new Date(act.occurredAt || act.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let key = actDate.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (actDate.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (actDate.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    }

    if (!groupedActivities[key]) {
      groupedActivities[key] = [];
    }
    groupedActivities[key].push(act);
  });

  return (
    <div className="space-y-6">
      {/* Activity Composer */}
      {(!defaultFilter || defaultFilter === 'note') && (
        <div className="bg-card border border-border rounded-card p-4 shadow-sm space-y-3">
          {/* Segmented Control */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F4F4F5] dark:bg-[#202025] rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveType('note')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeType === 'note'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Note</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType('call')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeType === 'call'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Log Call</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveType('meeting')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeType === 'meeting'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Log Meeting</span>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-2.5">
            <input
              type="text"
              placeholder={
                activeType === 'note'
                  ? 'Note title or summary...'
                  : activeType === 'call'
                  ? 'Call summary or topic...'
                  : 'Meeting topic or agenda...'
              }
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />

            <textarea
              rows={3}
              placeholder="Add details, next steps, or key takeaways..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div>
                  <label className="text-muted block text-[10px] uppercase font-semibold mb-0.5">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className="px-2 py-1 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none"
                  />
                </div>

                {(activeType === 'call' || activeType === 'meeting') && (
                  <div>
                    <label className="text-muted block text-[10px] uppercase font-semibold mb-0.5">
                      Duration (mins)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={durationMins}
                      onChange={(e) => setDurationMins(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    />
                  </div>
                )}

                {activeType === 'call' && (
                  <div>
                    <label className="text-muted block text-[10px] uppercase font-semibold mb-0.5">
                      Outcome
                    </label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as ActivityOutcome)}
                      className="px-2 py-1 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none"
                    >
                      <option value="connected">Connected</option>
                      <option value="no_answer">No Answer</option>
                      <option value="left_message">Left Message</option>
                    </select>
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => createMutation.mutate()}
                isLoading={createMutation.isPending}
                disabled={!body.trim() && !subject.trim()}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Log {activeType === 'note' ? 'Note' : activeType === 'call' ? 'Call' : 'Meeting'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">Loading activity timeline...</div>
        ) : activities.length === 0 ? (
          <div className="bg-card border border-border rounded-card p-8 text-center">
            <Clock className="w-8 h-8 text-muted/60 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-foreground">No activities recorded yet</h4>
            <p className="text-xs text-muted mt-1">
              Activities, notes, calls, and system events will appear chronologically here.
            </p>
          </div>
        ) : (
          Object.entries(groupedActivities).map(([dayGroup, dayActivities]) => (
            <div key={dayGroup} className="space-y-3">
              {/* Day header sticky / divider */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted tracking-wider uppercase px-2 py-0.5 bg-[#F4F4F5] dark:bg-[#202025] rounded-md">
                  {dayGroup}
                </span>
                <div className="h-[1px] flex-1 bg-border/60" />
              </div>

              {/* Items for this day */}
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                {dayActivities.map((act) => {
                  const cfg = getTypeConfig(act.type);
                  const Icon = cfg.icon;
                  const author = typeof act.createdBy === 'object' ? act.createdBy : null;
                  const authorName = author?.name || 'System';
                  const canManage =
                    isAdmin ||
                    isManager ||
                    (user && author && author._id === user._id);

                  return (
                    <motion.div
                      key={act._id}
                      initial={reducedMotion ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: MOTION.easing.easeOut }}
                      className="relative group"
                    >
                      {/* Timeline icon node */}
                      <div
                        className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-card ${cfg.bg}`}
                      >
                        <Icon className="w-3 h-3" />
                      </div>

                      {/* Timeline card */}
                      <div className="bg-card border border-border rounded-card p-3.5 shadow-sm hover:border-border/80 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {act.subject}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg}`}
                            >
                              {cfg.label}
                            </span>
                            {act.outcome && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-muted">
                                {act.outcome.replace('_', ' ')}
                              </span>
                            )}
                            {act.durationMins && (
                              <span className="text-[10px] text-muted flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {act.durationMins}m
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className="text-xs text-muted hover:text-foreground cursor-help"
                              title={new Date(act.occurredAt || act.createdAt).toLocaleString('en-IN')}
                            >
                              {formatRelativeTime(act.occurredAt || act.createdAt)}
                            </span>

                            {canManage && act.type !== 'system' && act.type !== 'stage_change' && (
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(act._id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-500 rounded transition-all"
                                title="Delete activity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {act.body && (
                          <div className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {act.body}
                          </div>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted">
                          <span>By {authorName}</span>
                          <span>{formatDate(act.occurredAt || act.createdAt)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Load More Pagination */}
        {pagination && pagination.page < pagination.totalPages && (
          <div className="text-center pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Load older activities</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
