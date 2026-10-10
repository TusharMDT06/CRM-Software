import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Info,
  FileText,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { EmailTemplate } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { formatINR } from '../../utils/formatters.js';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'lead' | 'contact' | 'account' | 'deal';
  entityId: string;
  recipientEmail?: string;
  contextData?: {
    lead?: any;
    contact?: any;
    account?: any;
    deal?: any;
  };
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  recipientEmail = '',
  contextData = {},
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [to, setTo] = useState(recipientEmail);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [smtpWarning, setSmtpWarning] = useState<string | null>(null);
  const [mailtoUrl, setMailtoUrl] = useState<string>('');
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync recipientEmail when prop changes
  useEffect(() => {
    if (recipientEmail) setTo(recipientEmail);
  }, [recipientEmail]);

  // Fetch email config
  const { data: emailConfig } = useQuery<{ isConfigured: boolean; isTestDomain: boolean }>({
    queryKey: ['email-config'],
    queryFn: async () => {
      const res = await api.get('/emails/config');
      return res.data;
    },
    enabled: isOpen,
  });

  // Fetch templates
  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await api.get('/emails/templates');
      return res.data;
    },
    enabled: isOpen,
  });

  // Handle template selection
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tmpl = templates.find((t) => t._id === templateId);
    if (tmpl) {
      setSubject(tmpl.subject);
      setBody(tmpl.body);
    }
  };

  // Merge context calculation
  const mergeTokens = useMemo(() => {
    const contact = contextData.contact || {};
    const account = contextData.account || {};
    const deal = contextData.deal || {};
    const lead = contextData.lead || {};

    return {
      '{{contact.firstName}}': contact.firstName || '',
      '{{contact.lastName}}': contact.lastName || '',
      '{{account.name}}': account.name || (contact.account?.name ?? ''),
      '{{deal.title}}': deal.title || '',
      '{{deal.amount}}': deal.amount ? formatINR(deal.amount) : '',
      '{{owner.name}}': user?.name || '',
      '{{lead.name}}': lead.name || '',
      '{{lead.company}}': lead.company || '',
    };
  }, [contextData, user]);

  // Insert token at cursor
  const handleInsertToken = (token: string) => {
    if (!textareaRef.current) {
      setBody((prev) => prev + token);
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextBody = body.substring(0, start) + token + body.substring(end);
    setBody(nextBody);
    setFieldMenuOpen(false);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // Live preview resolver with highlight for unresolved tokens
  const resolvedContent = useMemo(() => {
    const replaceInText = (text: string) => {
      let resolved = text;
      Object.entries(mergeTokens).forEach(([token, val]) => {
        if (val) {
          resolved = resolved.split(token).join(val);
        }
      });
      return resolved;
    };

    const resolvedSubject = replaceInText(subject);
    const resolvedBody = replaceInText(body);

    // Identify unresolved tokens
    const tokenRegex = /{{[\w.]+}}/g;
    const unresolvedTokens = Array.from(
      new Set([
        ...(resolvedSubject.match(tokenRegex) || []),
        ...(resolvedBody.match(tokenRegex) || []),
      ])
    );

    return {
      resolvedSubject,
      resolvedBody,
      unresolvedTokens,
    };
  }, [subject, body, mergeTokens]);

  // Send Mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/emails/send', {
        to,
        subject,
        body,
        entityType,
        entityId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
      success('Email sent successfully');
      handleClose();
    },
    onError: (err: any) => {
      if (err.status === 503 || err.response?.status === 503) {
        const errorData = err.response?.data || {};
        setSmtpWarning(
          errorData.message ||
            'SMTP email service is not configured. You can open your default email app or log the email as sent manually.'
        );
        const encodedSubject = encodeURIComponent(resolvedContent.resolvedSubject);
        const encodedBody = encodeURIComponent(resolvedContent.resolvedBody);
        setMailtoUrl(`mailto:${encodeURIComponent(to)}?subject=${encodedSubject}&body=${encodedBody}`);
      } else {
        error(err.message || 'Failed to send email');
      }
    },
  });

  // Log Sent Mutation (Fallback for 503)
  const logSentMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/emails/log-sent', {
        to,
        subject: resolvedContent.resolvedSubject,
        body: resolvedContent.resolvedBody,
        entityType,
        entityId,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
      success('Email logged to timeline');
      handleClose();
    },
    onError: (err: any) => {
      error(err.message || 'Failed to log email');
    },
  });

  const handleClose = () => {
    setSmtpWarning(null);
    setMailtoUrl('');
    setShowPreview(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Compose Email"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs text-muted hover:text-foreground font-medium flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F07B2A]" />
            <span>{showPreview ? 'Hide Preview' : 'Show Live Merge Preview'}</span>
          </button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => sendMutation.mutate()}
              isLoading={sendMutation.isPending}
              disabled={!to.trim() || !subject.trim() || !body.trim()}
            >
              <Send className="w-4 h-4" />
              <span>Send Email</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Test Mode Banner */}
        {emailConfig?.isTestDomain && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>Test mode: emails can only be delivered to your own Resend account email until you verify a domain.</span>
          </div>
        )}

        {/* Fallback Warning Notice (503 Fallback) */}
        {smtpWarning && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold">{smtpWarning}</p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  Your email draft has been prepared with all merge tags resolved. Choose an action below:
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={mailtoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in my email app</span>
              </a>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => logSentMutation.mutate()}
                isLoading={logSentMutation.isPending}
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Log as sent to timeline</span>
              </Button>
            </div>
          </div>
        )}

        {/* Template Selector Bar */}
        <div className="flex items-center justify-between gap-3 p-2.5 bg-[#F8F8FA] dark:bg-[#1E1E24] rounded-xl border border-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="w-4 h-4 text-muted shrink-0" />
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full text-xs bg-transparent text-foreground border-none focus:outline-none cursor-pointer"
            >
              <option value="">Load an email template...</option>
              {templates.map((tmpl) => (
                <option key={tmpl._id} value={tmpl._id}>
                  {tmpl.name} ({tmpl.category}) {tmpl.shared ? '• Shared' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Merge Field Inserter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFieldMenuOpen(!fieldMenuOpen)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-card border border-border text-foreground hover:bg-[#F4F4F5] dark:hover:bg-[#202025]"
            >
              <span>Insert Field</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </button>

            {fieldMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-50 py-1 text-xs">
                {Object.keys(mergeTokens).map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => handleInsertToken(token)}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] dark:hover:bg-[#202025] text-foreground font-mono text-[11px]"
                  >
                    {token}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">To *</label>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Subject *</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Proposal for {{account.name}} / Follow up"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Message Body *</label>
            <textarea
              ref={textareaRef}
              rows={8}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{contact.firstName}},&#10;&#10;Following up on our discussion regarding {{deal.title}}..."
              className="w-full px-3 py-2 text-sm font-sans bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-y"
            />
          </div>
        </div>

        {/* Live Preview Card */}
        {showPreview && (
          <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1A1A20] rounded-xl border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F07B2A]" />
                Live Merge Preview
              </span>
              {resolvedContent.unresolvedTokens.length > 0 && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  {resolvedContent.unresolvedTokens.length} unresolved tokens
                </span>
              )}
            </div>

            <div className="text-xs space-y-1.5">
              <div>
                <span className="text-muted font-medium">Subject: </span>
                <span className="text-foreground font-semibold">
                  {resolvedContent.resolvedSubject || <span className="text-muted/60 italic">—</span>}
                </span>
              </div>
              <div className="pt-1.5 border-t border-border/50 text-foreground/90 whitespace-pre-wrap leading-relaxed text-xs">
                {resolvedContent.resolvedBody || <span className="text-muted/60 italic">No message body yet.</span>}
              </div>
            </div>

            {resolvedContent.unresolvedTokens.length > 0 && (
              <div className="pt-2 border-t border-border/40 text-[11px] text-amber-700 dark:text-amber-300">
                <span>Unresolved tokens: </span>
                <span className="font-mono">{resolvedContent.unresolvedTokens.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
