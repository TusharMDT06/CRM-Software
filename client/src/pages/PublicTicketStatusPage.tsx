import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Send, AlertCircle } from 'lucide-react';
import { fetchPublicTicketStatus, replyToPublicTicket } from '../api/tickets.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { useToast } from '../context/ToastContext.js';

export const PublicTicketStatusPage: React.FC = () => {
  const { publicToken } = useParams<{ publicToken: string }>();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [replyBody, setReplyBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-ticket-status', publicToken],
    queryFn: () => fetchPublicTicketStatus(publicToken!),
    enabled: !!publicToken,
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) => replyToPublicTicket(publicToken!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-ticket-status', publicToken] });
      success('Your reply has been sent to the support team.');
      setReplyBody('');
    },
    onError: (err: any) => {
      error(err.message || 'Failed to send reply. Please try again.');
    },
  });

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) {
      error('Please enter a message before sending.');
      return;
    }
    replyMutation.mutate(replyBody.trim());
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="info">New</Badge>;
      case 'open':
        return <Badge variant="success">In Progress</Badge>;
      case 'pending':
        return <Badge variant="warning">Waiting on Information</Badge>;
      case 'resolved':
        return <Badge variant="purple">Resolved</Badge>;
      case 'closed':
        return <Badge variant="neutral">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6 flex flex-col justify-center max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!data?.ticket) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Ticket Not Found</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
          This tracking link may be invalid or has expired. Please verify the URL from your email confirmation.
        </p>
      </div>
    );
  }

  const { ticket, messages, companyName } = data;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-sm shadow-sm">
              <LifeBuoy className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <span className="font-semibold text-sm text-neutral-900 dark:text-white">
                {companyName || 'Flowdesk CRM'}
              </span>
              <span className="text-xs text-neutral-500 block">Customer Support</span>
            </div>
          </div>
        </div>

        {/* Ticket Header Card */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <div>
              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                Ticket #{ticket.number}
              </span>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white mt-2">
                {ticket.subject}
              </h1>
            </div>

            <div className="sm:text-right">
              {renderStatusBadge(ticket.status)}
              <span className="text-xs text-neutral-500 block mt-1.5">
                Opened {new Date(ticket.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </div>
        </div>

        {/* Message Thread */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 px-1">
            Updates & Conversation ({messages?.length || 0})
          </h3>

          {messages?.map((msg) => (
            <div
              key={msg._id}
              className={`p-5 rounded-2xl border transition-all ${
                msg.isAgent
                  ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm'
                  : 'bg-neutral-100/70 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-2 border-b border-neutral-100 dark:border-neutral-800/60 pb-2">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {msg.isAgent ? `${msg.authorName} (Support Agent)` : 'You (Customer)'}
                </span>
                <span>{new Date(msg.createdAt).toLocaleString()}</span>
              </div>

              <div className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
                {msg.body}
              </div>
            </div>
          ))}
        </div>

        {/* Customer Reply Composer */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            Send a Follow-up Message
          </h3>

          <form onSubmit={handleReplySubmit} className="space-y-3">
            <textarea
              rows={4}
              required
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Type your message, additional details, or response here..."
              className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none resize-none"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={replyMutation.isPending}
              >
                <Send className="w-4 h-4 mr-1.5" />
                <span>Send Message</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
