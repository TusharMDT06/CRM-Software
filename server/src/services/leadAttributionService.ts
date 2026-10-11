import { Types } from 'mongoose';
import { Lead, ILead, MarketingChannel } from '../models/Lead.js';
import { Contact, IContact } from '../models/Contact.js';
import { LeadSource, ILeadSource } from '../models/LeadSource.js';
import { LeadEvent, ILeadEvent } from '../models/LeadEvent.js';
import { Campaign } from '../models/Campaign.js';
import { Tenant } from '../models/Tenant.js';
import { Activity } from '../models/Activity.js';
import { sendNotification } from '../utils/notificationService.js';
import { eventBus } from '../utils/eventBus.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { logger } from '../utils/logger.js';

export interface InboundLeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  value?: number;
  notes?: string;
  custom?: Record<string, any>;
  owner?: Types.ObjectId | string;
  // Attribution
  channel?: MarketingChannel;
  campaign?: { externalId?: string; name?: string };
  adSet?: { externalId?: string; name?: string };
  ad?: { externalId?: string; name?: string };
  formName?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  clickIds?: {
    gclid?: string;
    fbclid?: string;
  };
  landingPage?: string;
  referrer?: string;
  consent?: {
    given: boolean;
    text?: string;
    at?: Date;
    via?: string;
  };
  isTest?: boolean;
}

/**
 * Normalizes email by trimming and lowercasing.
 */
export function normalizeEmail(email?: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Normalizes phone numbers to E.164 standard.
 * Default country: India (+91), configurable per tenant.
 */
export function normalizePhone(phone?: string, defaultCountry = 'IN'): string {
  if (!phone) return '';
  const raw = phone.trim();

  // If already starts with '+', clean any internal spaces/dashes
  if (raw.startsWith('+')) {
    const digitsOnly = raw.slice(1).replace(/\D/g, '');
    return `+${digitsOnly}`;
  }

  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (defaultCountry === 'IN') {
    // 10-digit Indian standard mobile number: 9876543210 -> +919876543210
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    // 11 digits starting with 0: 09876543210 -> +919876543210
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    // 12 digits starting with 91: 919876543210 -> +919876543210
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
  }

  // Fallback if not matching special pattern but has at least 7 digits
  return `+${digits}`;
}

/**
 * Finds or auto-creates a Campaign record for the given tenant & externalId/name
 */
export async function findOrCreateCampaign(
  tenantId: Types.ObjectId,
  channel: MarketingChannel,
  campaignData?: { externalId?: string; name?: string }
): Promise<any | null> {
  if (!campaignData || (!campaignData.externalId && !campaignData.name)) {
    return null;
  }

  const externalId = campaignData.externalId || campaignData.name || 'unknown_campaign';
  const name = campaignData.name || externalId;

  try {
    let campaign = await Campaign.findOne({
      tenantId,
      channel,
      externalId,
    });

    if (!campaign) {
      campaign = await Campaign.create({
        tenantId,
        channel,
        externalId,
        name,
        firstSeenAt: new Date(),
      });
    }

    return campaign;
  } catch (err: any) {
    logger.warn('[LeadAttribution] Error finding or creating campaign:', { error: err?.message || String(err) });
    return null;
  }
}

/**
 * Shared deduplication and normalization matcher.
 * Matches existing Lead or Contact within the tenant.
 */
export async function findMatchingLeadOrContact(
  tenantId: Types.ObjectId,
  normalizedEmail: string,
  normalizedPhone: string
): Promise<
  | { type: 'open_lead'; lead: ILead }
  | { type: 'recent_lost_lead'; lead: ILead }
  | { type: 'old_lost_lead'; lead: ILead }
  | { type: 'existing_contact'; contact: IContact }
  | { type: 'none' }
> {
  const queryConditions: any[] = [];
  if (normalizedEmail) {
    queryConditions.push({ email: normalizedEmail });
  }
  if (normalizedPhone) {
    queryConditions.push({ phone: normalizedPhone });
  }

  if (queryConditions.length === 0) {
    return { type: 'none' };
  }

  // 1. Search for matching Lead
  const matchingLeads = await Lead.find({
    tenantId,
    $or: queryConditions,
  }).sort({ updatedAt: -1 });

  for (const lead of matchingLeads) {
    if (lead.status !== 'converted' && lead.status !== 'lost') {
      return { type: 'open_lead', lead };
    }
    if (lead.status === 'lost') {
      const daysSinceLost = (Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLost > 30) {
        return { type: 'old_lost_lead', lead };
      } else {
        return { type: 'recent_lost_lead', lead };
      }
    }
  }

  // 2. Search for matching Contact
  const matchingContact = await Contact.findOne({
    tenantId,
    $or: queryConditions,
  }).sort({ updatedAt: -1 });

  if (matchingContact) {
    return { type: 'existing_contact', contact: matchingContact };
  }

  return { type: 'none' };
}

/**
 * Background worker to process a persisted LeadEvent.
 * Handles deduplication, normalization, attribution, owner routing, and timeline updates.
 */
export async function processInboundLeadEvent(
  eventId: Types.ObjectId | string,
  extractedLeadData?: InboundLeadPayload
): Promise<{ success: boolean; leadId?: Types.ObjectId; status: string; error?: string }> {
  const event = await runWithTenantContext({ isBypassTenant: true }, async () => {
    return LeadEvent.findById(eventId);
  });
  if (!event) {
    return { success: false, status: 'failed', error: 'LeadEvent not found' };
  }

  return runWithTenantContext({ tenantId: event.tenantId.toString() }, async () => {
    const source = await LeadSource.findById(event.source);
    if (!source) {
      event.status = 'failed';
      event.error = 'LeadSource not found';
      await event.save();
      return { success: false, status: 'failed', error: 'LeadSource not found' };
    }

    event.attempts += 1;

  try {
    const tenant = await Tenant.findById(event.tenantId);
    const defaultCountry = tenant?.settings?.defaultCountry || 'IN';
    const createLeadForExistingCustomers = Boolean(
      tenant?.settings?.createLeadForExistingCustomers
    );

    // Payload extraction
    const raw = extractedLeadData || (event.rawPayload as InboundLeadPayload);
    const normalizedEmail = normalizeEmail(raw.email);
    const normalizedPhone = normalizePhone(raw.phone, defaultCountry);

    // Determine default marketing channel from source type
    let channel: MarketingChannel = raw.channel || 'other';
    if (!raw.channel) {
      if (source.type === 'meta_lead_ads') channel = 'facebook';
      else if (source.type === 'google_ads') channel = 'google_ads';
      else if (source.type === 'website_form') channel = 'website_form';
      else if (source.type === 'generic_webhook') channel = 'api';
    }

    // Auto-create or link campaign if present
    if (raw.campaign) {
      await findOrCreateCampaign(event.tenantId, channel, raw.campaign);
    }

    // Deduplication check
    const match = await findMatchingLeadOrContact(
      event.tenantId,
      normalizedEmail,
      normalizedPhone
    );

    // Scenario A: Open Lead or Recent Lost Lead (< 30 days) -> Repeat Inquiry (NO DUPLICATE)
    if (match.type === 'open_lead' || match.type === 'recent_lost_lead') {
      const existingLead = match.lead;
      existingLead.inquiryCount = (existingLead.inquiryCount || 1) + 1;
      existingLead.lastInquiryAt = new Date();

      // Update attribution details if new inquiry provides richer source
      if (raw.campaign?.name) existingLead.campaign = raw.campaign;
      if (raw.utm?.campaign) existingLead.utm = { ...existingLead.utm, ...raw.utm };

      await existingLead.save();

      // Log "Repeat inquiry" timeline activity
      await Activity.create({
        tenantId: event.tenantId,
        type: 'system',
        subject: 'Repeat inquiry received',
        body: `Repeat inquiry #${existingLead.inquiryCount} via ${channel}${
          raw.campaign?.name ? ` (Campaign: ${raw.campaign.name})` : ''
        }`,
        entityType: 'lead',
        entityId: existingLead._id,
        createdBy: existingLead.owner,
        occurredAt: new Date(),
      });

      // Notify the lead owner
      if (existingLead.owner) {
        await sendNotification({
          userId: existingLead.owner,
          type: 'lead_repeat_inquiry',
          title: `Repeat inquiry for ${existingLead.name}`,
          body: `Inquiry #${existingLead.inquiryCount} arrived via ${channel}${
            raw.campaign?.name ? ` [${raw.campaign.name}]` : ''
          }.`,
          link: `/leads/${existingLead._id}`,
          entityType: 'lead',
          entityId: existingLead._id.toString(),
        });
      }

      // Update counters
      source.counters.duplicates += 1;
      source.lastLeadAt = new Date();
      await source.save();

      event.status = 'duplicate';
      event.lead = existingLead._id;
      await event.save();

      return { success: true, leadId: existingLead._id, status: 'duplicate' };
    }

    // Scenario B: Existing Contact
    if (match.type === 'existing_contact') {
      const contact = match.contact;

      // Log inquiry activity on contact timeline
      await Activity.create({
        tenantId: event.tenantId,
        type: 'system',
        subject: 'Inbound marketing inquiry from existing contact',
        body: `Inquiry received via ${channel}${
          raw.campaign?.name ? ` (Campaign: ${raw.campaign.name})` : ''
        }`,
        entityType: 'contact',
        entityId: contact._id,
        createdBy: contact.owner,
        occurredAt: new Date(),
      });

      // Notify contact owner
      if (contact.owner) {
        await sendNotification({
          userId: contact.owner,
          type: 'lead_repeat_inquiry',
          title: `New inquiry from contact ${contact.firstName} ${contact.lastName}`,
          body: `Inquiry received via ${channel}.`,
          link: `/contacts/${contact._id}`,
          entityType: 'contact',
          entityId: contact._id.toString(),
        });
      }

      if (!createLeadForExistingCustomers) {
        source.counters.duplicates += 1;
        source.lastLeadAt = new Date();
        await source.save();

        event.status = 'ignored';
        await event.save();
        return { success: true, status: 'ignored' };
      }
      // If setting is enabled, fall through to create a new lead
    }

    // Scenario C: New Lead (or Old Lost Lead > 30 days)
    const ownerId = raw.owner
      ? new Types.ObjectId(raw.owner)
      : source.createdBy;

    const newLead = await Lead.create({
      tenantId: event.tenantId,
      name: raw.name || 'New Inbound Lead',
      email: normalizedEmail || `lead_${Date.now()}@placeholder.in`,
      phone: normalizedPhone || '',
      company: raw.company || 'Individual / Inbound',
      source: 'website', // Keep existing legacy enum field working seamlessly
      status: 'new',
      value: raw.value || 0,
      notes: raw.notes || '',
      custom: raw.custom || {},
      owner: ownerId,
      // Phase 5 Attribution Fields
      channel,
      campaign: raw.campaign,
      adSet: raw.adSet,
      ad: raw.ad,
      formName: raw.formName,
      utm: raw.utm,
      clickIds: raw.clickIds,
      landingPage: raw.landingPage,
      referrer: raw.referrer,
      consent: raw.consent || { given: false },
      inquiryCount: 1,
      lastInquiryAt: new Date(),
      firstContactAt: null,
      isTest: Boolean(raw.isTest || event.isTest),
    });

    // Initial creation timeline activity
    await Activity.create({
      tenantId: event.tenantId,
      type: 'system',
      subject: 'Lead created via automated capture',
      body: `Captured via ${channel}${
        raw.campaign?.name ? ` (Campaign: ${raw.campaign.name})` : ''
      }${raw.formName ? ` | Form: ${raw.formName}` : ''}${
        newLead.isTest ? ' [TEST LEAD]' : ''
      }`,
      entityType: 'lead',
      entityId: newLead._id,
      createdBy: ownerId,
      occurredAt: new Date(),
    });

    // Notify assigned owner
    if (ownerId) {
      await sendNotification({
        userId: ownerId,
        type: 'lead_assigned',
        title: `New Lead: ${newLead.name}`,
        body: `Assigned via ${channel}${
          raw.campaign?.name ? ` [${raw.campaign.name}]` : ''
        }.`,
        link: `/leads/${newLead._id}`,
        entityType: 'lead',
        entityId: newLead._id.toString(),
      });
    }

    // Emit event bus
    eventBus.emit('lead:created', {
      lead: newLead,
      tenantId: event.tenantId,
      channel,
      isTest: newLead.isTest,
    });

    // Update source counters
    source.counters.created += 1;
    source.lastLeadAt = new Date();
    await source.save();

    event.status = 'processed';
    event.lead = newLead._id;
    await event.save();

    return { success: true, leadId: newLead._id, status: 'processed' };
  } catch (err: any) {
    logger.error('[LeadAttribution] Processing failed for event:', { error: err?.message || String(err) });
    event.status = 'failed';
    event.error = err.message || 'Unknown processing error';
    await event.save();

    source.counters.failed += 1;
    source.lastError = event.error ?? null;
    await source.save();

    return { success: false, status: 'failed', error: event.error ?? undefined };
  }
  });
}
