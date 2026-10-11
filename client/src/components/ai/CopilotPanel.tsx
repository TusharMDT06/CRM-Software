import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  History,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Mail,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  streamCopilotChat,
  getAiConversations,
  getAiConversation,
  deleteAiConversation,
  clearAiConversations,
  confirmAiAction,
  dismissAiAction,
  submitAiFeedback,
  ProposedAction,
  CopilotMessage,
  CopilotConversationSummary,
} from '../../api/ai.js';

interface CopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entityType?: 'lead' | 'contact' | 'account' | 'deal' | 'ticket';
  entityId?: string;
  contextRecord?: any;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  contextRecord,
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [conversations, setConversations] = useState<CopilotConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, 'up' | 'down'>>({});
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user conversation list
  const loadConversations = async () => {
    try {
      const data = await getAiConversations();
      setConversations(data || []);
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, activeTool]);

  const handleStartNewConversation = () => {
    setConversationId(undefined);
    setMessages([]);
    setActiveTool(null);
    setHistoryOpen(false);
  };

  const handleSelectConversation = async (convId: string) => {
    try {
      const conv = await getAiConversation(convId);
      if (conv) {
        setConversationId(conv._id);
        setMessages(conv.messages || []);
      }
      setHistoryOpen(false);
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await deleteAiConversation(convId);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (conversationId === convId) {
        handleStartNewConversation();
      }
    } catch {
      // non-blocking
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isStreaming) return;

    const userMsg: CopilotMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsStreaming(true);
    setActiveTool(null);

    let partialAiText = '';
    const aiMsgId = `m_${Date.now()}`;

    // Add empty model placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        role: 'model',
        content: '',
      },
    ]);

    await streamCopilotChat({
      message: text.trim(),
      conversationId,
      entityType,
      entityId,
      contextRecord,
      onChunk: (chunk) => {
        partialAiText += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: partialAiText } : m))
        );
      },
      onToolCall: (call) => {
        setActiveTool(call.name);
      },
      onToolResult: () => {
        setActiveTool(null);
      },
      onProposedAction: (action) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, proposedAction: action } : m))
        );
      },
      onDone: (data) => {
        setConversationId(data.conversationId);
        setIsStreaming(false);
        setActiveTool(null);
        loadConversations();
      },
      onError: (err) => {
        setIsStreaming(false);
        setActiveTool(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `The AI couldn't answer this one. (${err.message || 'Please try again'})`,
                }
              : m
          )
        );
      },
    });
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFeedback = async (msgId: string, rating: 'up' | 'down', textPreview: string) => {
    try {
      await submitAiFeedback({
        feature: 'copilot',
        rating,
        responsePreview: textPreview.substring(0, 200),
      });
      setFeedbackSent((prev) => ({ ...prev, [msgId]: rating }));
    } catch {
      // non-blocking
    }
  };

  const handleConfirmAction = async (action: ProposedAction) => {
    if (!conversationId) return;
    setConfirmingActionId(action.id);
    try {
      const res = await confirmAiAction(conversationId, action.id);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.proposedAction?.id === action.id) {
            return {
              ...m,
              proposedAction: {
                ...m.proposedAction,
                status: 'confirmed',
                executedResult: res.result,
              },
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      alert(`Action execution failed: ${err.message}`);
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleDismissAction = async (action: ProposedAction) => {
    if (!conversationId) return;
    try {
      await dismissAiAction(conversationId, action.id);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.proposedAction?.id === action.id) {
            return {
              ...m,
              proposedAction: {
                ...m.proposedAction,
                status: 'dismissed',
              },
            };
          }
          return m;
        })
      );
    } catch {
      // non-blocking
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="w-full max-w-[460px] h-full bg-card border-l border-border shadow-2xl flex flex-col z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-16 px-5 border-b border-border flex items-center justify-between shrink-0 bg-card">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">Flowdesk Copilot</h3>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-medium">
                    Gemini 2.0
                  </span>
                </div>
                <p className="text-[11px] text-muted">AI-powered CRM intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setHistoryOpen((prev) => !prev)}
                title="Conversation History"
                className={`p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-subtle transition-colors ${
                  historyOpen ? 'bg-card-subtle text-foreground' : ''
                }`}
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={handleStartNewConversation}
                title="New Chat"
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-subtle transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                title="Close"
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-subtle transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Context Badge (if viewing a record) */}
          {entityType && contextRecord && (
            <div className="px-5 py-2 bg-primary/5 border-b border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-primary">Context:</span>
                <span className="text-foreground font-medium truncate">
                  {contextRecord.name || contextRecord.title || contextRecord.subject || `${entityType} record`}
                </span>
              </div>
              <span className="text-[10px] text-muted capitalize">{entityType}</span>
            </div>
          )}

          {/* History Drawer Overlay */}
          {historyOpen ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-card-subtle">
              <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
                <span className="text-xs font-semibold text-foreground">Saved Conversations</span>
                {conversations.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear all conversation history?')) {
                        clearAiConversations();
                        setConversations([]);
                        handleStartNewConversation();
                      }
                    }}
                    className="text-[11px] text-rose-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>

              {conversations.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">No past conversations saved yet.</div>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => handleSelectConversation(c._id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                      c._id === conversationId
                        ? 'border-primary bg-primary/5 font-medium text-foreground'
                        : 'border-border bg-card hover:bg-card/70 text-foreground'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="truncate font-medium">{c.title}</p>
                      <span className="text-[10px] text-muted">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, c._id)}
                      className="p-1 rounded text-muted hover:text-rose-500 opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Chat Messages Area */
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center px-4 space-y-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">How can I assist your pipeline today?</h4>
                    <p className="text-xs text-muted mt-1 max-w-xs">
                      Ask questions about leads, aggregate revenue, draft emails, or analyze pipeline risks.
                    </p>
                  </div>

                  {/* Quick Action Tiles */}
                  <div className="grid grid-cols-2 gap-2 w-full pt-2">
                    <button
                      onClick={() => handleSendMessage('Summarise this record and key facts')}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-card-subtle text-left text-xs transition-colors flex flex-col gap-1.5 shadow-sm group"
                    >
                      <FileText className="w-4 h-4 text-blue-500 group-hover:scale-105 transition-transform" />
                      <span className="font-semibold text-foreground">Summarise record</span>
                      <span className="text-[10px] text-muted">Key facts & next steps</span>
                    </button>

                    <button
                      onClick={() => handleSendMessage('Draft a follow-up email to this prospect')}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-card-subtle text-left text-xs transition-colors flex flex-col gap-1.5 shadow-sm group"
                    >
                      <Mail className="w-4 h-4 text-emerald-500 group-hover:scale-105 transition-transform" />
                      <span className="font-semibold text-foreground">Draft email</span>
                      <span className="text-[10px] text-muted">Personalized follow-up</span>
                    </button>

                    <button
                      onClick={() => handleSendMessage('Predict deal outcome and identify roadblocks')}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-card-subtle text-left text-xs transition-colors flex flex-col gap-1.5 shadow-sm group"
                    >
                      <TrendingUp className="w-4 h-4 text-amber-500 group-hover:scale-105 transition-transform" />
                      <span className="font-semibold text-foreground">Predict deal outcome</span>
                      <span className="text-[10px] text-muted">Win likelihood & trends</span>
                    </button>

                    <button
                      onClick={() => handleSendMessage('Show all at-risk deals in our pipeline right now')}
                      className="p-3 rounded-xl border border-border bg-card hover:bg-card-subtle text-left text-xs transition-colors flex flex-col gap-1.5 shadow-sm group"
                    >
                      <ShieldAlert className="w-4 h-4 text-rose-500 group-hover:scale-105 transition-transform" />
                      <span className="font-semibold text-foreground">Show at-risk deals</span>
                      <span className="text-[10px] text-muted">Stagnant & overdue</span>
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {/* User message */}
                    {msg.role === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-xs font-normal shadow-sm">
                        {msg.content}
                      </div>
                    ) : (
                      /* Model message */
                      <div className="max-w-[92%] space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold text-muted px-1.5 py-0.5 rounded bg-card-subtle border border-border">
                            AI generated
                          </span>
                        </div>

                        <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3.5 text-xs text-foreground shadow-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                          {isStreaming && idx === messages.length - 1 && (
                            <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse align-middle" />
                          )}
                        </div>

                        {/* Proposed Action Card (if any) */}
                        {msg.proposedAction && (
                          <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs space-y-2 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-primary flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" /> Proposed Action
                              </span>
                              <span
                                className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${
                                  msg.proposedAction.status === 'confirmed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    : msg.proposedAction.status === 'dismissed'
                                    ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                }`}
                              >
                                {msg.proposedAction.status}
                              </span>
                            </div>

                            <p className="font-medium text-foreground">{msg.proposedAction.title}</p>
                            <p className="text-[11px] text-muted">{msg.proposedAction.description}</p>

                            {msg.proposedAction.status === 'pending' ? (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => handleConfirmAction(msg.proposedAction!)}
                                  disabled={confirmingActionId === msg.proposedAction.id}
                                  className="flex-1 py-1.5 px-3 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                                >
                                  {confirmingActionId === msg.proposedAction.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  Confirm Action
                                </button>
                                <button
                                  onClick={() => handleDismissAction(msg.proposedAction!)}
                                  className="py-1.5 px-3 rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-subtle font-medium text-xs flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Dismiss
                                </button>
                              </div>
                            ) : msg.proposedAction.status === 'confirmed' ? (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 pt-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Action executed & logged as ai_assisted
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Actions: Copy & Thumbs Up/Down Feedback */}
                        {msg.content && !isStreaming && (
                          <div className="flex items-center gap-2 text-muted text-[11px] pt-1">
                            <button
                              onClick={() => handleCopy(msg.content, idx)}
                              className="flex items-center gap-1 hover:text-foreground transition-colors p-1"
                              title="Copy response"
                            >
                              {copiedIndex === idx ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copy
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleFeedback(msg.id, 'up', msg.content)}
                              className={`p-1 hover:text-foreground transition-colors ${
                                feedbackSent[msg.id] === 'up' ? 'text-primary' : ''
                              }`}
                              title="Good response"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>

                            <button
                              onClick={() => handleFeedback(msg.id, 'down', msg.content)}
                              className={`p-1 hover:text-foreground transition-colors ${
                                feedbackSent[msg.id] === 'down' ? 'text-rose-500' : ''
                              }`}
                              title="Poor response"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Tool Execution Pulse Indicator */}
              {activeTool && (
                <div className="flex items-center gap-2 text-xs text-primary px-3 py-1.5 rounded-lg bg-primary/10 w-fit animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Executing {activeTool.replace('_', ' ')}...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Footer Input Box */}
          <div className="p-3.5 border-t border-border bg-card shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask Copilot anything..."
                disabled={isStreaming}
                className="flex-1 bg-card-subtle border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isStreaming}
                className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center shadow-sm"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
            <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-muted">
              <span>Always verify CRM write proposals</span>
              <span>Encrypted & scoped</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
