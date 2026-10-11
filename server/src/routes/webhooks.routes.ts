import { Router, Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { LeadSource } from '../models/LeadSource.js';
import { LeadEvent } from '../models/LeadEvent.js';
import {
  constantTimeCompare,
  hashSecret,
} from '../utils/cryptoHelper.js';
import {
  processInboundLeadEvent,
  InboundLeadPayload,
} from '../services/leadAttributionService.js';
import { runWithTenantContext } from '../utils/tenantContext.js';
import { logger } from '../utils/logger.js';

export const webhooksRouter = Router();

// Strict Rate Limiting for inbound public webhook ingest
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests/minute per IP
  message: { message: 'Too many webhook requests from this IP, please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter Rate Limiting for public website form submissions (prevent spam bot flooding)
const formSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 submissions per IP in 15 minutes
  message: { message: 'Form submission rate limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// JSON Body parser with strict size limit (256 KB)
const webhookBodyLimit = express.json({ limit: '256kb' });

// =========================================================================
// 1. GENERIC WEBHOOK INTAKE: POST /hooks/generic/:webhookId
// =========================================================================
webhooksRouter.post(
  '/generic/:webhookId',
  webhookLimiter,
  webhookBodyLimit,
  async (req: Request, res: Response) => {
    try {
      const { webhookId } = req.params;

      // 1. Resolve tenant strictly from unguessable webhookId (never trust client payload)
      const source = await runWithTenantContext({ isBypassTenant: true }, async () => {
        return LeadSource.findOne({
          webhookId,
          type: 'generic_webhook',
        });
      });

      if (!source) {
        res.status(404).json({ message: 'Lead intake endpoint not found' });
        return;
      }

      if (source.status === 'paused') {
        res.status(403).json({ message: 'Lead intake for this source is currently paused' });
        return;
      }

      // 2. Constant-time API Key Verification
      const providedApiKey = (req.headers['x-api-key'] as string) || '';
      if (!providedApiKey) {
        res.status(401).json({ message: 'Missing x-api-key header' });
        return;
      }

      const providedHash = hashSecret(providedApiKey);
      const expectedHash = source.config?.apiKeyHash || '';

      if (!expectedHash || !constantTimeCompare(providedHash, expectedHash)) {
        res.status(401).json({ message: 'Invalid API key' });
        return;
      }

      // 3. Extract or compute providerLeadId for idempotency
      const body = req.body || {};
      const idempotencyKey =
        (req.headers['x-idempotency-key'] as string) ||
        body.providerLeadId ||
        body.id ||
        body.lead_id ||
        body.leadId ||
        crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

      await runWithTenantContext({ tenantId: source.tenantId.toString() }, async () => {
        // 4. Idempotency Check: repeated delivery must not create a duplicate
        const existingEvent = await LeadEvent.findOne({
          source: source._id,
          providerLeadId: idempotencyKey,
        });

        if (existingEvent) {
          // Return 200 fast to acknowledge provider delivery without re-processing
          source.counters.duplicates += 1;
          await source.save();
          res.status(200).json({
            success: true,
            eventId: existingEvent._id,
            status: 'duplicate',
            message: 'Webhook event previously received and processed',
          });
          return;
        }

        // 5. Persist raw event immediately
        const isTest = Boolean(body.isTest || body.test || req.headers['x-test-event'] === 'true');
        const leadEvent = await LeadEvent.create({
          tenantId: source.tenantId,
          source: source._id,
          providerLeadId: idempotencyKey,
          status: 'received',
          rawPayload: body,
          isTest,
        });

        source.counters.received += 1;
        await source.save();

        // 6. Return 200 fast to provider
        res.status(200).json({
          success: true,
          eventId: leadEvent._id,
          status: 'received',
        });

        // 7. Background asynchronous processing using mapped fields
        const mapping = source.config?.fieldMapping || {};

        const getMapped = (crmField: string): any => {
          if (mapping[crmField] && body[mapping[crmField]] !== undefined) {
            return body[mapping[crmField]];
          }
          for (const [inKey, outField] of Object.entries(mapping)) {
            if (outField === crmField && body[inKey] !== undefined) {
              return body[inKey];
            }
          }
          return undefined;
        };

        const mappedLead: InboundLeadPayload = {
          name: getMapped('name') || body.full_name || body.fullName || body.name,
          email: getMapped('email') || body.contact_email || body.emailAddress || body.email,
          phone: getMapped('phone') || body.mobile || body.phoneNumber || body.phone,
          company: getMapped('company') || body.company || body.companyName || body.organization,
          value: Number(getMapped('value') || body.value) || 0,
          notes: getMapped('notes') || body.notes || '',
          custom: {},
          channel: 'api',
          campaign: body.campaign
            ? typeof body.campaign === 'object'
              ? body.campaign
              : { name: String(body.campaign), externalId: body.campaignId }
            : body.campaignId
            ? { externalId: String(body.campaignId) }
            : undefined,
          utm: {
            source: body.utm_source || body.utmSource,
            medium: body.utm_medium || body.utmMedium,
            campaign: body.utm_campaign || body.utmCampaign,
            term: body.utm_term || body.utmTerm,
            content: body.utm_content || body.utmContent,
          },
          clickIds: {
            gclid: body.gclid,
            fbclid: body.fbclid,
          },
          landingPage: body.landingPage || body.landing_page,
          referrer: body.referrer,
          consent: {
            given: Boolean(body.consent || body.optIn || body.consentGiven),
            text: body.consentText,
            at: new Date(),
            via: 'generic_webhook',
          },
          isTest,
        };

        // Handle custom mapped keys in both directions
        Object.entries(mapping).forEach(([k, v]) => {
          if (k.startsWith('custom.')) {
            const customKey = k.replace('custom.', '');
            if (body[v as string] !== undefined) mappedLead.custom![customKey] = body[v as string];
          } else if (typeof v === 'string' && v.startsWith('custom.')) {
            const customKey = v.replace('custom.', '');
            if (body[k] !== undefined) mappedLead.custom![customKey] = body[k];
          }
        });

        processInboundLeadEvent(leadEvent._id, mappedLead).catch((err) => {
          logger.error('[GenericWebhook] Background processing failed:', err);
        });
      });
    } catch (err: any) {
      logger.error('[GenericWebhook] Error handling inbound webhook:', err);
      res.status(500).json({ message: 'Internal error processing webhook' });
    }
  }
);

// =========================================================================
// 2. WEBSITE FORM INTAKE & HOSTED/EMBEDDED ENDPOINTS
// =========================================================================

// GET /f/:formId or /api/hooks/f/:formId - Fetch public form schema (zero sensitive tenant details)
webhooksRouter.get(['/:formId', '/f/:formId'], async (req: Request, res: Response) => {
  try {
    const { formId } = req.params;
    const source = await runWithTenantContext({ isBypassTenant: true }, async () => {
      return LeadSource.findOne({
        webhookId: formId,
        type: 'website_form',
      });
    });

    if (!source || source.status !== 'active') {
      res.status(404).json({ message: 'Form is not available or inactive' });
      return;
    }

    // Check allowed domains if Origin is present
    const origin = req.headers.origin || req.headers.referer;
    const allowedDomains: string[] = source.config?.allowedDomains || [];
    if (allowedDomains.length > 0 && origin) {
      try {
        const originHost = new URL(origin).hostname;
        const isAllowed = allowedDomains.some(
          (d) => d === originHost || originHost.endsWith(`.${d}`) || d === '*'
        );
        if (!isAllowed) {
          res.status(403).json({ message: 'Origin domain not permitted for this form' });
          return;
        }
      } catch (_) {}
    }

    res.json({
      formId: source.webhookId,
      name: source.name,
      fields: source.config?.fields || [
        { field: 'name', label: 'Full Name', required: true },
        { field: 'email', label: 'Work Email', required: true },
        { field: 'phone', label: 'Phone Number', required: true },
      ],
      consentCheckboxText:
        source.config?.consentCheckboxText ||
        'I consent to receive calls and email updates regarding Flowdesk products.',
      successMessage:
        source.config?.successMessage || 'Thank you! We will get in touch with you shortly.',
      redirectUrl: source.config?.redirectUrl || null,
      turnstileEnabled: Boolean(source.config?.turnstileEnabled),
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to retrieve form details' });
  }
});

// POST /f/:formId/submit or /api/hooks/f/:formId/submit - Handle public form submission
webhooksRouter.post(
  ['/:formId/submit', '/f/:formId/submit'],
  formSubmitLimiter,
  express.json({ limit: '64kb' }),
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const source = await runWithTenantContext({ isBypassTenant: true }, async () => {
        return LeadSource.findOne({
          webhookId: formId,
          type: 'website_form',
        });
      });

      if (!source || source.status !== 'active') {
        res.status(404).json({ message: 'Form is not available' });
        return;
      }

      // Check allowed domains
      const origin = req.headers.origin || req.headers.referer;
      const allowedDomains: string[] = source.config?.allowedDomains || [];
      if (allowedDomains.length > 0 && origin) {
        try {
          const originHost = new URL(origin).hostname;
          const isAllowed = allowedDomains.some(
            (d) => d === originHost || originHost.endsWith(`.${d}`) || d === '*'
          );
          if (!isAllowed) {
            res.status(403).json({ message: 'Origin domain not allowed' });
            return;
          }
        } catch (_) {}
      }

      const body = req.body || {};

      // 1. Anti-spam Honeypot Check: hidden field trap
      // If filled by automated bot scripts, silently return 200 without creating lead
      if (body._hp_trap || body.website_hp || body._honeypot || body._flowdesk_hp) {
        logger.info(`[WebsiteForm] Honeypot trap triggered for form ${formId}`);
        res.status(200).json({
          success: true,
          message: source.config?.successMessage || 'Submission received',
        });
        return;
      }

      await runWithTenantContext({ tenantId: source.tenantId.toString() }, async () => {
        // 2. Provider ID / Idempotency Key
        const submissionId = `form_${formId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        // 3. Persist raw LeadEvent
        const isTest = Boolean(body.isTest);
        const leadEvent = await LeadEvent.create({
          tenantId: source.tenantId,
          source: source._id,
          providerLeadId: submissionId,
          status: 'received',
          rawPayload: body,
          isTest,
        });

        source.counters.received += 1;
        await source.save();

        // 4. Return fast response to visitor
        res.status(200).json({
          success: true,
          message: source.config?.successMessage || 'Thank you! We will get in touch shortly.',
          redirectUrl: source.config?.redirectUrl || null,
        });

        // 5. Asynchronous Lead Creation
        const customData: Record<string, any> = {};
        Object.keys(body).forEach((key) => {
          if (key.startsWith('custom_') || key.startsWith('custom.')) {
            const cleanKey = key.replace(/^custom[_.]/, '');
            customData[cleanKey] = body[key];
          }
        });

        const leadPayload: InboundLeadPayload = {
          name: body.name || body.fullName || 'Website Prospect',
          email: body.email,
          phone: body.phone,
          company: body.company || 'Website Inquiry',
          value: Number(body.value) || 0,
          notes: body.notes || body.message || '',
          custom: customData,
          channel: 'website_form',
          formName: source.name,
          campaign: body.campaign
            ? typeof body.campaign === 'object'
              ? body.campaign
              : { name: String(body.campaign) }
            : body.utm_campaign
            ? { name: String(body.utm_campaign) }
            : undefined,
          utm: {
            source: body.utm_source || body.utmSource,
            medium: body.utm_medium || body.utmMedium,
            campaign: body.utm_campaign || body.utmCampaign,
            term: body.utm_term || body.utmTerm,
            content: body.utm_content || body.utmContent,
          },
          clickIds: {
            gclid: body.gclid,
            fbclid: body.fbclid,
          },
          landingPage: body.landingPage || req.headers.referer,
          referrer: body.referrer || req.headers.referer,
          consent: {
            given: Boolean(body.consent),
            text: source.config?.consentCheckboxText,
            at: new Date(),
            via: 'website_form',
          },
          isTest,
        };

        processInboundLeadEvent(leadEvent._id, leadPayload).catch((err) => {
          logger.error('[WebsiteForm] Background lead creation failed:', err);
        });
      });
    } catch (err: any) {
      logger.error('[WebsiteForm] Submission error:', err);
      res.status(500).json({ message: 'Submission failed' });
    }
  }
);
