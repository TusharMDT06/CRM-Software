import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Edit,
  Save,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { getMarketingCampaigns, updateMarketingCampaign } from '../../api/marketing.js';
import { CampaignItem, MarketingChannel } from '../../types/index.js';
import { useToast } from '../../context/ToastContext.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { PageTransition } from '../../components/motion/PageTransition.js';
import { Reveal } from '../../components/motion/Reveal.js';

export const CampaignsPage: React.FC = () => {
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [editCampaign, setEditCampaign] = useState<CampaignItem | null>(null);
  const [editedName, setEditedName] = useState('');

  const { data: campaigns = [], isLoading, refetch } = useQuery<CampaignItem[]>({
    queryKey: ['marketingCampaigns'],
    queryFn: getMarketingCampaigns,
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editCampaign) return;
      return updateMarketingCampaign(editCampaign._id, editedName);
    },
    onSuccess: () => {
      success('Campaign name updated successfully');
      setEditCampaign(null);
      queryClient.invalidateQueries({ queryKey: ['marketingCampaigns'] });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to update campaign');
    },
  });

  const getChannelBadge = (channel: MarketingChannel) => {
    switch (channel) {
      case 'google_ads':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Google Ads
          </span>
        );
      case 'facebook':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Facebook
          </span>
        );
      case 'instagram':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            Instagram
          </span>
        );
      case 'website_form':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Website
          </span>
        );
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            WhatsApp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
            {channel || 'Other'}
          </span>
        );
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Top Header */}
      <Reveal delay={0}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Target className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Marketing Campaigns
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Campaigns auto-discovered from inbound Google Ads, Meta Ads, and website UTM tags.
            </p>
          </div>

          <Button variant="secondary" size="md" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </Reveal>

      {/* Campaigns Table */}
      {isLoading ? (
        <div className="h-64 bg-card border border-border rounded-2xl animate-pulse" />
      ) : campaigns.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">No Campaigns Recorded Yet</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Campaigns are automatically created whenever an inbound lead carries a campaign ID or name from Google Ads, Meta, or UTM parameters.
            </p>
          </div>
        </Reveal>
      ) : (
        <Reveal delay={0.1}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/10 border-b border-border text-[11px] text-muted uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Campaign Name</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">External ID</th>
                    <th className="py-3 px-4 text-center">Attributed Leads</th>
                    <th className="py-3 px-4">First Seen</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {campaigns.map((camp) => (
                    <tr key={camp._id} className="hover:bg-muted/5 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{camp.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditCampaign(camp);
                              setEditedName(camp.name);
                            }}
                            className="p-1 text-muted hover:text-foreground rounded transition-colors"
                            title="Edit campaign name"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{getChannelBadge(camp.channel)}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted">
                        {camp.externalId}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-semibold text-foreground px-2 py-0.5 rounded-full bg-card border border-border/80 text-[11px]">
                          {camp.leadCount || 0} leads
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted text-[11px]">
                        {new Date(camp.firstSeenAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`/leads?campaign=${encodeURIComponent(camp.name)}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-xs"
                        >
                          <span>View Leads</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      )}

      {/* Edit Campaign Modal */}
      <Modal
        isOpen={Boolean(editCampaign)}
        onClose={() => setEditCampaign(null)}
        title="Edit Campaign Name"
      >
        {editCampaign && (
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] text-muted block mb-1">
                Channel: {editCampaign.channel} • External ID: {editCampaign.externalId}
              </span>
              <label className="font-semibold text-foreground block mb-1">Display Name</label>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-border">
              <Button variant="secondary" size="md" onClick={() => setEditCampaign(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!editedName.trim() || editMutation.isPending}
                isLoading={editMutation.isPending}
                onClick={() => editMutation.mutate()}
                className="gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Name</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  );
};
