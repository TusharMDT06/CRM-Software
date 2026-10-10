import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Save } from 'lucide-react';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../api/phase3.js';
import { useToast } from '../context/ToastContext.js';
import { Reveal } from '../components/motion/Motion.js';

const NOTIFICATION_LABELS: Record<string, { title: string; desc: string }> = {
  task_assigned: { title: 'Task Assigned', desc: 'When a task is assigned to you' },
  task_due_today: { title: 'Task Due Today', desc: 'Morning 8:00 AM daily summary of tasks due today' },
  task_overdue: { title: 'Task Overdue', desc: 'When an open task passes its due date' },
  deal_assigned: { title: 'Deal Assigned', desc: 'When you are assigned as the owner of a deal' },
  deal_won: { title: 'Deal Won', desc: 'When a deal you own is successfully won' },
  deal_lost: { title: 'Deal Lost', desc: 'When a deal you own is marked as lost' },
  quote_viewed: { title: 'Quote Viewed', desc: 'When a customer opens and views your quote proposal' },
  quote_accepted: { title: 'Quote Accepted', desc: 'When a customer formally accepts a quote online' },
  quote_declined: { title: 'Quote Declined', desc: 'When a customer declines a quote proposal' },
  quote_needs_approval: { title: 'Quote Needs Approval', desc: 'When a discount >15% or value >₹10L requires manager review' },
  quote_approved: { title: 'Quote Approved', desc: 'When a manager approves your pending quote' },
  quote_rejected: { title: 'Quote Rejected', desc: 'When a manager rejects your quote' },
  invoice_paid: { title: 'Invoice Paid', desc: 'When a payment is recorded for an invoice' },
  invoice_overdue: { title: 'Invoice Overdue', desc: 'When an invoice balance passes the due date without settlement' },
  workflow_disabled: { title: 'Workflow Disabled', desc: 'When an automation exceeds 50 runs/min safety limit' },
  import_finished: { title: 'Import Finished', desc: 'When a batch CSV import finishes processing' },
};

export const NotificationSettingsPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [preferences, setPreferences] = useState<Record<string, { inApp: boolean; email: boolean }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: () => fetchNotificationPreferences(),
  });

  useEffect(() => {
    if (data?.preferences) {
      setPreferences(data.preferences);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (prefs: any) => updateNotificationPreferences(prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      success('Notification preferences saved successfully');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update preferences');
    },
  });

  const handleToggle = (type: string, channel: 'inApp' | 'email') => {
    setPreferences((prev) => {
      const current = prev[type] || { inApp: true, email: false };
      return {
        ...prev,
        [type]: {
          ...current,
          [channel]: !current[channel],
        },
      };
    });
  };

  const handleSave = () => {
    updateMutation.mutate(preferences);
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="h-10 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-xl w-64" />
        <div className="h-96 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full gap-6">
      {/* Header */}
      <Reveal direction="down">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-foreground" />
              Notification Preferences
            </h1>
            <p className="text-sm text-muted mt-1">
              Choose which alerts you want to receive in-app and via email.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </Reveal>

      {/* Table */}
      <Reveal direction="up" delay={0.05}>
        <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-[#FAFAFA] dark:bg-[#1E1E24]/60 text-xs font-semibold text-muted">
                <th className="py-3 px-5">Event Category</th>
                <th className="py-3 px-4 text-center w-28">In-App</th>
                <th className="py-3 px-4 text-center w-28">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(NOTIFICATION_LABELS).map(([typeKey, meta]) => {
                const pref = preferences[typeKey] || { inApp: true, email: false };

                return (
                  <tr key={typeKey} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-foreground text-xs sm:text-sm">
                        {meta.title}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {meta.desc}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={pref.inApp}
                        onChange={() => handleToggle(typeKey, 'inApp')}
                        className="w-4 h-4 rounded text-black focus:ring-0 cursor-pointer"
                      />
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={pref.email}
                        onChange={() => handleToggle(typeKey, 'email')}
                        className="w-4 h-4 rounded text-black focus:ring-0 cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  );
};
