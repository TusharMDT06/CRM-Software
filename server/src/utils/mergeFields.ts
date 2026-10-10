import { formatINR } from './formatters.js';

export interface MergeContext {
  contact?: { firstName?: string; lastName?: string; email?: string };
  account?: { name?: string; industry?: string };
  deal?: { title?: string; amount?: number };
  lead?: { name?: string; company?: string };
  owner?: { name?: string; email?: string };
}

export function resolveMergeFields(templateText: string, context: MergeContext): string {
  if (!templateText) return '';

  return templateText.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, fieldPath) => {
    switch (fieldPath) {
      case 'contact.firstName':
        return context.contact?.firstName || '';
      case 'contact.lastName':
        return context.contact?.lastName || '';
      case 'account.name':
        return context.account?.name || '';
      case 'deal.title':
        return context.deal?.title || '';
      case 'deal.amount':
        return context.deal?.amount !== undefined ? formatINR(context.deal.amount) : '';
      case 'lead.name':
        return context.lead?.name || '';
      case 'lead.company':
        return context.lead?.company || '';
      case 'owner.name':
        return context.owner?.name || '';
      default:
        return match; // preserve unknown tokens
    }
  });
}
