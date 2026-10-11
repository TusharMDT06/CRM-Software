import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { LifeBuoy, Send, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { submitPublicTicket } from '../api/tickets.js';
import { Button } from '../components/ui/Button.js';
import { useToast } from '../context/ToastContext.js';

export const PublicSupportPortalPage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { error } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');

  const [submittedData, setSubmittedData] = useState<{
    ticketNumber: string;
    publicToken: string;
  } | null>(null);

  const submitMutation = useMutation({
    mutationFn: (payload: any) => submitPublicTicket(tenantSlug || 'flowdesk', payload),
    onSuccess: (data) => {
      setSubmittedData({
        ticketNumber: data.ticketNumber,
        publicToken: data.publicToken,
      });
    },
    onError: (err: any) => {
      error(err.message || 'Failed to submit support request. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !description.trim()) {
      error('Please complete all required fields.');
      return;
    }

    submitMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      website: websiteHoneypot, // Honeypot anti-bot
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-xl mx-auto shadow-md mb-4">
            <LifeBuoy className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Customer Support Portal
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Submit your inquiry or issue and our team will get back to you shortly.
          </p>
        </div>

        {submittedData ? (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 shadow-sm text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                Ticket Submitted Successfully!
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                Your support request has been logged as Ticket #
                <span className="font-mono font-bold text-neutral-900 dark:text-white">
                  {submittedData.ticketNumber}
                </span>
                . A confirmation email has also been sent to <strong>{email}</strong>.
              </p>
            </div>

            <div className="pt-4">
              <Link
                to={`/support/status/${submittedData.publicToken}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity w-full sm:w-auto"
              >
                <span>Track Ticket Status</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot field - invisible to humans */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  value={websiteHoneypot}
                  onChange={(e) => setWebsiteHoneypot(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Company Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Summary of the issue"
                  className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none cursor-pointer"
                >
                  <option value="low">Low - General inquiry</option>
                  <option value="medium">Medium - Minor inconvenience</option>
                  <option value="high">High - Feature broken</option>
                  <option value="urgent">Urgent - Business critical / System down</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={5}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe what happened, steps to reproduce, or what you need assistance with..."
                  className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none resize-none"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                  isLoading={submitMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  <span>Submit Support Request</span>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-neutral-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Protected by Flowdesk automated SLA tracking and spam verification</span>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
