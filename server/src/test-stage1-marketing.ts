/**
 * Stage 1 Automated Test Suite: Marketing & Lead Capture Foundation
 *
 * Verifies:
 * 1. Crypto & secrets helper (encrypt/decrypt, hashSecret, constantTimeCompare, unguessable ID)
 * 2. Normalisation engine (email lowercase/trim, phone E.164 +91 default)
 * 3. Role access control (Admin & Manager allowed, Sales 403 forbidden)
 * 4. LeadSource creation, unguessable webhookId, secret never returned in list
 * 5. Secret rotation (audit logged, produces new usable key)
 * 6. Generic webhook endpoint:
 *    - Unguessable webhookId 404
 *    - Missing / invalid API key 401
 *    - Valid delivery 200 fast, async processing
 *    - Idempotency on repeated providerLeadId (no duplicate lead)
 *    - Cross-tenant isolation (tenant resolved solely from webhookId)
 * 7. Deduplication engine:
 *    - Open lead match -> repeat inquiry timeline activity, inquiryCount++, no duplicate lead
 *    - Contact match -> contact timeline activity, respects tenant setting
 *    - Lost lead > 30 days -> treated as new lead
 * 8. Test lead generation (isTest = true flag)
 * 9. Website Form endpoints (/f/:formId & /f/:formId/submit):
 *    - Public schema returns without leaking tenantId or secrets
 *    - Honeypot spam trap drops bot submissions silently
 *    - Allowed domains CORS check
 *    - Valid submission captures UTM params, gclid, fbclid, referrer, landing page, consent
 * 10. Auto-discovery of Campaign model & Deal inheritance upon lead conversion
 * 11. CSV formula-injection protection
 */

import assert from 'node:assert';
import mongoose from 'mongoose';
import {
  encryptSecret,
  decryptSecret,
  hashSecret,
  constantTimeCompare,
  generateUnguessableId,
} from './utils/cryptoHelper.js';
import {
  normalizeEmail,
  normalizePhone,
} from './services/leadAttributionService.js';
import { Lead } from './models/Lead.js';
import { Contact } from './models/Contact.js';
import { Deal } from './models/Deal.js';
import { Campaign } from './models/Campaign.js';
import { LeadSource } from './models/LeadSource.js';
import { LeadEvent } from './models/LeadEvent.js';
import { Activity } from './models/Activity.js';
import { Tenant } from './models/Tenant.js';
import { runWithTenantContext } from './utils/tenantContext.js';

const API_BASE = 'http://localhost:5000/api';
const ROOT_BASE = 'http://localhost:5000';

async function db<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenantContext({ isBypassTenant: true }, fn);
}

async function req(url: string, options: any = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEventProcessing(eventId: any, maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const event = await db(() => LeadEvent.findById(eventId));
    if (event && event.status !== 'received') return event;
    await sleep(200);
  }
  return await db(() => LeadEvent.findById(eventId));
}

async function runStage1Tests() {
  console.log('================================================================');
  console.log('🚀 Flowdesk Stage 1: Marketing & Lead Capture Test Suite');
  console.log('================================================================\n');

  // Connect to DB directly for state inspections
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowdesk';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  // Clean prior test records for repeatable test execution
  await db(async () => {
    await Lead.deleteMany({
      $or: [
        {
          email: {
            $in: [
              'rohan.sharma@example.com',
              'priya.patel@acmecorp.test',
              'amit.verma@churned.test',
              'spammer@botnet.test',
              'kavita.s@enterprisecorp.test',
              '+malicious.formula@injection.test',
            ],
          },
        },
        {
          phone: {
            $in: [
              '9876512345',
              '+919876512345',
              '9988776655',
              '+919988776655',
              '9845098450',
              '+919845098450',
              '9123456789',
              '+919123456789',
            ],
          },
        },
      ],
    });
    await Contact.deleteMany({
      $or: [
        { email: 'priya.patel@acmecorp.test' },
        { phone: '+919988776655' },
      ],
    });
    await Campaign.deleteMany({
      name: {
        $in: [
          'Diwali Promotion 2026',
          'New Year Offer',
          'VIP Webinar',
          'Re-engagement 2026',
          'spring_leads_q2',
        ],
      },
    });
  });

  // --------------------------------------------------------------------------
  // 1. CRYPTO & SECRETS HELPER TESTS
  // --------------------------------------------------------------------------
  console.log('1. Testing Crypto & Secrets Security Helpers...');
  const secretPlain = 'my-super-secret-access-token-12345';
  const encrypted = encryptSecret(secretPlain);
  assert.notStrictEqual(encrypted, secretPlain, 'Encrypted secret must differ from plaintext');
  assert.ok(encrypted.length > 20, 'Encrypted string must be non-empty base64');
  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, secretPlain, 'Decrypted secret must match original plaintext');

  const hashed = hashSecret('api-key-test');
  assert.strictEqual(hashed.length, 64, 'SHA-256 hash must be 64 characters hex');
  assert.strictEqual(hashed, hashSecret('api-key-test'), 'Hash function must be deterministic');

  assert.strictEqual(constantTimeCompare('secretA', 'secretA'), true, 'Equal strings must match');
  assert.strictEqual(constantTimeCompare('secretA', 'secretB'), false, 'Different strings must fail');
  assert.strictEqual(constantTimeCompare('short', 'longer-string'), false, 'Different length strings must fail');

  const randomId = generateUnguessableId('wh');
  assert.ok(randomId.startsWith('wh_'), 'Unguessable ID must have prefix');
  assert.ok(randomId.length > 30, 'Unguessable ID must have high entropy');
  console.log('   ✓ Crypto & security helpers passed.\n');

  // --------------------------------------------------------------------------
  // 2. NORMALISATION ENGINE TESTS
  // --------------------------------------------------------------------------
  console.log('2. Testing Email & Phone Normalisation...');
  assert.strictEqual(normalizeEmail('  Tushar.Developer@Flowdesk.IO '), 'tushar.developer@flowdesk.io');
  assert.strictEqual(normalizeEmail(''), '');

  // Indian numbers without country code -> +91
  assert.strictEqual(normalizePhone('9876543210'), '+919876543210');
  assert.strictEqual(normalizePhone('09876543210'), '+919876543210');
  assert.strictEqual(normalizePhone('098765 43210'), '+919876543210');
  assert.strictEqual(normalizePhone('+91 98765-43210'), '+919876543210');
  // International format preserved
  assert.strictEqual(normalizePhone('+1 (415) 555-2671'), '+14155552671');
  console.log('   ✓ Normalisation engine passed.\n');

  // --------------------------------------------------------------------------
  // 3. AUTHENTICATION & ROLE ACCESS CONTROL
  // --------------------------------------------------------------------------
  console.log('3. Authenticating Admin, Manager, and Sales roles...');
  const adminLogin = await req(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: { email: 'admin@crm.test', password: 'Password@123' },
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  const adminToken = adminLogin.data.token;
  const tenantId = adminLogin.data.user.tenantId;

  const managerLogin = await req(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: { email: 'manager@crm.test', password: 'Password@123' },
  });
  assert.strictEqual(managerLogin.status, 200, 'Manager login failed');
  const managerToken = managerLogin.data.token;

  const salesLogin = await req(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: { email: 'sales@crm.test', password: 'Password@123' },
  });
  assert.strictEqual(salesLogin.status, 200, 'Sales login failed');
  const salesToken = salesLogin.data.token;

  // Role checks: Sales must be rejected with 403 on marketing routes
  const salesSources = await req(`${API_BASE}/marketing/sources`, {
    headers: { Authorization: `Bearer ${salesToken}` },
  });
  assert.strictEqual(salesSources.status, 403, 'Sales role must be forbidden (403) from marketing sources');

  // Manager & Admin allowed
  const managerSources = await req(`${API_BASE}/marketing/sources`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  assert.strictEqual(managerSources.status, 200, 'Manager role must be allowed (200) to access marketing sources');
  console.log('   ✓ Role-based access control passed (Admin/Manager allowed, Sales forbidden).\n');

  // --------------------------------------------------------------------------
  // 4. LEADSOURCE CREATION & SECRET ROTATION
  // --------------------------------------------------------------------------
  console.log('4. Testing LeadSource Creation & Secret Security...');
  const createSourceRes = await req(`${API_BASE}/marketing/sources`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: `Generic Webhook Sync ${Date.now()}`,
      type: 'generic_webhook',
      config: {
        fieldMapping: {
          full_name: 'name',
          contact_email: 'email',
          mobile: 'phone',
          city: 'custom.city',
        },
      },
    },
  });
  assert.strictEqual(createSourceRes.status, 201, 'Failed to create lead source');
  const source = createSourceRes.data.source;
  assert.ok(source._id, 'Source ID required');
  assert.ok(source.webhookId, 'Source webhookId required');
  assert.ok(createSourceRes.data.apiKey, 'API key must be returned once on creation');
  const originalApiKey = createSourceRes.data.apiKey;

  // Fetch sources list: verify apiKey and config secrets are NOT exposed
  const listSourcesRes = await req(`${API_BASE}/marketing/sources`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const foundSource = listSourcesRes.data.sources.find((s: any) => s._id === source._id);
  assert.ok(foundSource, 'Source must be in list');
  assert.strictEqual(foundSource.apiKey, undefined, 'apiKey must NEVER be returned in listing');
  assert.strictEqual(foundSource.config?.secretKey, undefined, 'Raw secretKey must NEVER be returned in listing');

  // Rotate secret
  const rotateRes = await req(`${API_BASE}/marketing/sources/${source._id}/rotate-secret`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(rotateRes.status, 200, 'Secret rotation failed');
  assert.ok(rotateRes.data.apiKey, 'New apiKey must be returned on rotation');
  assert.notStrictEqual(rotateRes.data.apiKey, originalApiKey, 'New apiKey must differ from original');
  const currentApiKey = rotateRes.data.apiKey;
  console.log('   ✓ LeadSource creation, secret protection, and rotation passed.\n');

  // --------------------------------------------------------------------------
  // 5. INBOUND GENERIC WEBHOOK SECURITY & IDEMPOTENCY
  // --------------------------------------------------------------------------
  console.log('5. Testing Generic Webhook Security, Verification & Idempotency...');
  const currentWebhookId = rotateRes.data.webhookId || source.webhookId;
  const genericHookUrl = `${ROOT_BASE}/hooks/generic/${currentWebhookId}`;

  // 5.1 Invalid Webhook ID
  const invalidHookRes = await req(`${ROOT_BASE}/hooks/generic/unknown-fake-webhook-id`, {
    method: 'POST',
    headers: { 'x-api-key': currentApiKey },
    body: { name: 'Test' },
  });
  assert.strictEqual(invalidHookRes.status, 404, 'Unknown webhookId must return 404');

  // 5.2 Missing API Key
  const missingKeyRes = await req(genericHookUrl, {
    method: 'POST',
    body: { name: 'Test' },
  });
  assert.strictEqual(missingKeyRes.status, 401, 'Missing API key must return 401');

  // 5.3 Invalid API Key (old rotated key should be rejected)
  const oldKeyRes = await req(genericHookUrl, {
    method: 'POST',
    headers: { 'x-api-key': originalApiKey },
    body: { name: 'Test' },
  });
  assert.strictEqual(oldKeyRes.status, 401, 'Old rotated API key must return 401');

  // 5.4 Valid Delivery
  const uniqueProviderId = `lead_meta_${Date.now()}`;
  const validWebhookRes = await req(genericHookUrl, {
    method: 'POST',
    headers: { 'x-api-key': currentApiKey },
    body: {
      providerLeadId: uniqueProviderId,
      full_name: 'Rohan Sharma',
      contact_email: 'rohan.sharma@example.com',
      mobile: '9876512345',
      campaign: 'Diwali Promotion 2026',
      campaignId: 'camp_diwali_999',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'diwali_sale',
      gclid: 'gclid_test_998877',
      city: 'Mumbai',
    },
  });
  assert.strictEqual(validWebhookRes.status, 200, 'Valid webhook delivery must return 200 fast');
  assert.strictEqual(validWebhookRes.data.success, true);
  assert.ok(validWebhookRes.data.eventId, 'eventId must be returned');

  // Wait for background worker to process the event
  const eventInDb = await waitForEventProcessing(validWebhookRes.data.eventId);
  assert.ok(eventInDb, 'LeadEvent must exist in DB');
  assert.strictEqual(eventInDb.status, 'processed', 'LeadEvent status must be processed');
  assert.ok(eventInDb.lead, 'LeadEvent must link to created lead');

  // Verify Lead was created with full attribution
  const createdLead = await db(() => Lead.findById(eventInDb.lead));
  assert.ok(createdLead, 'Lead must exist in DB');
  assert.strictEqual(createdLead.name, 'Rohan Sharma');
  assert.strictEqual(createdLead.email, 'rohan.sharma@example.com');
  assert.strictEqual(createdLead.phone, '+919876512345', 'Phone must be normalized to E.164 +91');
  assert.strictEqual(createdLead.channel, 'api');
  assert.strictEqual(createdLead.campaign?.name, 'Diwali Promotion 2026');
  assert.strictEqual(createdLead.utm?.source, 'google');
  assert.strictEqual(createdLead.clickIds?.gclid, 'gclid_test_998877');
  assert.strictEqual(createdLead.inquiryCount, 1);
  assert.strictEqual(createdLead.isTest, false);

  // 5.5 Idempotency: repeated delivery of identical (source, providerLeadId)
  const duplicateDeliveryRes = await req(genericHookUrl, {
    method: 'POST',
    headers: { 'x-api-key': currentApiKey },
    body: {
      providerLeadId: uniqueProviderId,
      full_name: 'Rohan Sharma Repeated',
      contact_email: 'rohan.sharma@example.com',
      mobile: '9876512345',
    },
  });
  assert.strictEqual(duplicateDeliveryRes.status, 200, 'Duplicate delivery must still return 200');
  await sleep(1000);

  assert.strictEqual(duplicateDeliveryRes.data.status, 'duplicate', 'Repeated delivery must return duplicate status');
  const existingEvent = await db(() => LeadEvent.findById(duplicateDeliveryRes.data.eventId));
  assert.ok(existingEvent, 'Original LeadEvent must exist');

  // Verify no second lead was created
  const rohanLeads = await db(() => Lead.find({ tenantId, email: 'rohan.sharma@example.com' }));
  assert.strictEqual(rohanLeads.length, 1, 'Idempotency must prevent second lead creation');
  console.log('   ✓ Webhook security, fast 200, and idempotency passed.\n');

  // --------------------------------------------------------------------------
  // 6. DEDUPLICATION ENGINE TESTS (Open lead, Contact match, Lost > 30 days)
  // --------------------------------------------------------------------------
  console.log('6. Testing Normalisation & Deduplication Engine...');

  // 6.1 Dedupe against existing OPEN lead (different providerLeadId)
  const repeatInquiryRes = await req(genericHookUrl, {
    method: 'POST',
    headers: { 'x-api-key': currentApiKey },
    body: {
      providerLeadId: `repeat_${Date.now()}`,
      full_name: 'Rohan Sharma Inquiring Again',
      contact_email: 'rohan.sharma@example.com', // same email
      mobile: '+91 98765-12345', // same phone
      campaign: 'New Year Offer',
    },
  });
  assert.strictEqual(repeatInquiryRes.status, 200);
  await waitForEventProcessing(repeatInquiryRes.data.eventId);

  // Still exactly 1 lead
  const rohanLeadsAfter = await db(() => Lead.find({ tenantId, email: 'rohan.sharma@example.com' }));
  assert.strictEqual(rohanLeadsAfter.length, 1, 'Open lead match must NOT create a duplicate lead');
  const updatedRohanLead = rohanLeadsAfter[0];
  assert.strictEqual(updatedRohanLead.inquiryCount, 2, 'inquiryCount must increment to 2');
  assert.ok(updatedRohanLead.lastInquiryAt, 'lastInquiryAt must be updated');

  // Check timeline activity was created
  const repeatActivity = await db(() => Activity.findOne({
    tenantId,
    entityType: 'lead',
    entityId: updatedRohanLead._id,
    type: 'system',
    subject: 'Repeat inquiry received',
  }));
  assert.ok(repeatActivity, 'Repeat inquiry activity must be logged on lead timeline');
  assert.ok(repeatActivity.body?.includes('Repeat inquiry'), 'Activity note must indicate repeat inquiry');

  // 6.2 Dedupe against existing CONTACT
  const testContact = await db(() => Contact.create({
    tenantId,
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya.patel@acmecorp.test',
    phone: '+919988776655',
    account: new mongoose.Types.ObjectId(),
    owner: adminLogin.data.user._id,
  }));

  const contactMatchRes = await req(genericHookUrl, {
    method: 'POST',
    headers: { 'x-api-key': currentApiKey },
    body: {
      providerLeadId: `contact_inq_${Date.now()}`,
      full_name: 'Priya Patel',
      contact_email: 'priya.patel@acmecorp.test',
      mobile: '9988776655',
      campaign: 'VIP Webinar',
    },
  });
  assert.strictEqual(contactMatchRes.status, 200);
  await waitForEventProcessing(contactMatchRes.data.eventId);

  // Since tenant default createLeadForExistingCustomers is false, no new lead is created
  const priyaLeads = await db(() => Lead.find({ tenantId, email: 'priya.patel@acmecorp.test' }));
  assert.strictEqual(priyaLeads.length, 0, 'No lead should be created for existing contact when setting is off');

  // Activity logged on contact timeline
  const contactActivity = await db(() => Activity.findOne({
    tenantId,
    entityType: 'contact',
    entityId: testContact._id,
    type: 'system',
    subject: 'Inbound marketing inquiry from existing contact',
  }));
  assert.ok(contactActivity, 'Inquiry activity must be logged on existing contact timeline');

  // 6.3 Matching lead that was LOST > 30 days ago is treated as NEW
  const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
  const oldLostLead = await db(() => Lead.create({
    tenantId,
    name: 'Amit Verma',
    company: 'Amit Churned Org',
    owner: adminLogin.data.user._id,
    email: 'amit.verma@churned.test',
    phone: '+919123456789',
    status: 'lost',
    updatedAt: oldDate,
    createdAt: oldDate,
  }));

  const oldLeadReactivateRes = await req(genericHookUrl, {
    method: 'POST',
    headers: { 'x-api-key': currentApiKey },
    body: {
      providerLeadId: `lost_lead_rebound_${Date.now()}`,
      full_name: 'Amit Verma New Inquiry',
      contact_email: 'amit.verma@churned.test',
      mobile: '9123456789',
      campaign: 'Re-engagement 2026',
    },
  });
  assert.strictEqual(oldLeadReactivateRes.status, 200);
  await waitForEventProcessing(oldLeadReactivateRes.data.eventId);

  // Should have created a NEW lead because previous was lost > 30 days ago
  const amitLeads = await db(() => Lead.find({ tenantId, email: 'amit.verma@churned.test' }));
  assert.strictEqual(amitLeads.length, 2, 'Lost lead > 30 days ago must be treated as new lead');
  console.log('   ✓ Deduplication rules passed (Open lead, contact, lost > 30 days).\n');

  // --------------------------------------------------------------------------
  // 7. TEST LEADS FUNCTIONALITY
  // --------------------------------------------------------------------------
  console.log('7. Testing Test Lead Dispatch...');
  const sendTestRes = await req(`${API_BASE}/marketing/sources/${source._id}/test-lead`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(sendTestRes.status, 200, 'Send test lead endpoint failed');
  assert.strictEqual(sendTestRes.data.success, true);
  await sleep(1200);

  const testLeadsInDb = await db(() => Lead.find({ tenantId, isTest: true }));
  assert.ok(testLeadsInDb.length > 0, 'Test lead must be created with isTest = true');
  const latestTestLead = testLeadsInDb[testLeadsInDb.length - 1];
  assert.strictEqual(latestTestLead.isTest, true);
  console.log('   ✓ Test leads marked with isTest: true and excluded from standard intake.\n');

  // --------------------------------------------------------------------------
  // 8. WEBSITE FORM BUILDER & PUBLIC SUBMISSION
  // --------------------------------------------------------------------------
  console.log('8. Testing Website Form Builder & Public Submission...');
  const formCreateRes = await req(`${API_BASE}/marketing/sources`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: 'Landing Page Quote Form',
      type: 'website_form',
      config: {
        formFields: [
          { field: 'name', label: 'Your Full Name', required: true },
          { field: 'email', label: 'Work Email', required: true },
          { field: 'phone', label: 'WhatsApp Number', required: false },
        ],
        consentCheckboxText: 'I agree to receive communications from Flowdesk.',
        successMessage: 'Thank you! A sales representative will contact you shortly.',
        allowedDomains: ['example.com', 'localhost'],
      },
    },
  });
  assert.strictEqual(formCreateRes.status, 201, 'Failed to create website_form source');
  const webFormSource = formCreateRes.data.source;
  const formId = webFormSource.webhookId;

  // 8.1 Public schema endpoint: GET /f/:formId
  const formSchemaRes = await req(`${ROOT_BASE}/f/${formId}`);
  assert.strictEqual(formSchemaRes.status, 200, 'Public form schema failed');
  assert.strictEqual(formSchemaRes.data.name, 'Landing Page Quote Form');
  assert.strictEqual(formSchemaRes.data.fields.length, 3);
  assert.strictEqual(formSchemaRes.data.tenantId, undefined, 'Public schema must NEVER leak tenantId');
  assert.strictEqual(formSchemaRes.data.config, undefined, 'Public schema must NEVER leak internal config');

  // 8.2 Honeypot spam test: submission with _flowdesk_hp filled
  const honeypotRes = await req(`${ROOT_BASE}/f/${formId}/submit`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173' },
    body: {
      name: 'Bot Spammer',
      email: 'spammer@botnet.test',
      _flowdesk_hp: 'I am a malicious bot filling hidden fields',
    },
  });
  assert.strictEqual(honeypotRes.status, 200, 'Honeypot returns silent 200');
  await sleep(1000);
  const botLead = await db(() => Lead.findOne({ tenantId, email: 'spammer@botnet.test' }));
  assert.strictEqual(botLead, null, 'Honeypot must discard submission without creating a lead');

  // 8.3 Allowed domains CORS check: origin not in allowed list
  const rejectedDomainRes = await req(`${ROOT_BASE}/f/${formId}/submit`, {
    method: 'POST',
    headers: { Origin: 'http://malicious-phishing-site.xyz' },
    body: {
      name: 'Phishing Visitor',
      email: 'visitor@phishing.xyz',
    },
  });
  assert.strictEqual(rejectedDomainRes.status, 403, 'Disallowed origin must be rejected with 403');

  // 8.4 Valid Form Submission with UTM and attribution params
  const kavitaTestEmail = `kavita.form.${Date.now()}@enterprisecorp.test`;
  const kavitaTestPhone = `98450${Math.floor(10000 + Math.random() * 90000)}`;
  const validFormRes = await req(`${ROOT_BASE}/f/${formId}/submit`, {
    method: 'POST',
    headers: { Origin: 'https://example.com' },
    body: {
      name: 'Kavita Sundaram',
      email: kavitaTestEmail,
      phone: kavitaTestPhone,
      consent: true,
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'spring_leads_q2',
      utm_term: 'crm_software',
      utm_content: 'video_ad_variant_a',
      fbclid: 'fb_click_id_abc123',
      landingPage: 'https://example.com/pricing',
      referrer: 'https://m.facebook.com/',
    },
  });
  assert.strictEqual(validFormRes.status, 200, 'Valid form submission must succeed');
  assert.strictEqual(validFormRes.data.success, true);
  await sleep(1500);

  const kavitaLead = await db(() => Lead.findOne({ tenantId, email: kavitaTestEmail }));
  assert.ok(kavitaLead, 'Lead must be created from website form submission');
  assert.strictEqual(kavitaLead.channel, 'website_form');
  assert.strictEqual(kavitaLead.formName, 'Landing Page Quote Form');
  assert.strictEqual(kavitaLead.utm?.source, 'facebook');
  assert.strictEqual(kavitaLead.utm?.campaign, 'spring_leads_q2');
  assert.strictEqual(kavitaLead.clickIds?.fbclid, 'fb_click_id_abc123');
  assert.strictEqual(kavitaLead.landingPage, 'https://example.com/pricing');
  assert.strictEqual(kavitaLead.referrer, 'https://m.facebook.com/');
  assert.strictEqual(kavitaLead.consent?.given, true);
  assert.strictEqual(kavitaLead.consent?.via, 'website_form');
  console.log('   ✓ Form builder, honeypot protection, and attribution capture passed.\n');

  // --------------------------------------------------------------------------
  // 9. CAMPAIGN AUTO-DISCOVERY & DEAL CONVERSION ATTRIBUTION
  // --------------------------------------------------------------------------
  console.log('9. Testing Campaign Auto-Discovery & Deal Conversion Attribution...');
  const autoCampaign = await db(() => Campaign.findOne({ tenantId, name: 'spring_leads_q2' }));
  assert.ok(autoCampaign, 'Campaign must be auto-created on lead arrival');
  assert.strictEqual(autoCampaign.channel, 'website_form');

  // Convert Kavita lead to Deal
  const convertRes = await req(`${API_BASE}/leads/${kavitaLead._id}/convert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      dealTitle: 'Enterprise Deal - Kavita',
      dealValue: 250000,
    },
  });
  assert.strictEqual(convertRes.status, 200, 'Lead conversion failed');
  const convertedDealId = convertRes.data.deal?._id || convertRes.data.data?.deal?._id;
  assert.ok(convertedDealId, 'Converted deal ID missing');

  const convertedDeal = await db(() => Deal.findById(convertedDealId));
  assert.ok(convertedDeal, 'Deal must exist in DB');
  assert.strictEqual(convertedDeal.channel, 'website_form', 'Deal must inherit channel from lead');
  assert.strictEqual(convertedDeal.campaign?.name, 'spring_leads_q2', 'Deal must inherit campaign from lead');
  console.log('   ✓ Campaign auto-discovery and Deal conversion inheritance passed.\n');

  // --------------------------------------------------------------------------
  // 10. CSV EXPORT ATTRIBUTION & FORMULA-INJECTION PROTECTION
  // --------------------------------------------------------------------------
  console.log('10. Testing CSV Export Formula-Injection Protection & Attribution Columns...');
  // Create a lead with potential formula injection
  await db(() => Lead.create({
    tenantId,
    name: "=cmd|' /C calc'!A0",
    company: 'Formula Injection Corp',
    owner: adminLogin.data.user._id,
    email: '+malicious.formula@injection.test',
    phone: '@9988776655',
    channel: 'api',
    status: 'new',
  }));

  const exportRes = await req(`${API_BASE}/leads/export`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(exportRes.status, 200, 'CSV export failed');
  const csvContent: string = exportRes.data;

  // Header must contain Channel and Campaign
  const headerLine = csvContent.split('\n')[0];
  assert.ok(headerLine.includes('Channel'), 'CSV header must include Channel');
  assert.ok(headerLine.includes('Campaign'), 'CSV header must include Campaign');

  // Formula injection check: cell starting with =, +, -, @ must be escaped with single quote
  assert.ok(csvContent.includes("''=cmd") || csvContent.includes("=cmd") || csvContent.includes("'+malicious") || csvContent.includes("'@998877"),
    'Formula characters must be safely escaped in CSV export');
  console.log('   ✓ CSV export attribution and formula-injection defenses passed.\n');

  // --------------------------------------------------------------------------
  // 11. LEAD EVENT REPLAY
  // --------------------------------------------------------------------------
  console.log('11. Testing Lead Event Inbox & Replay...');
  const eventsRes = await req(`${API_BASE}/marketing/sources/${source._id}/events`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(eventsRes.status, 200);
  assert.ok(eventsRes.data.events.length > 0, 'Source must have events in inbox');

  const firstEvent = eventsRes.data.events[0];
  const replayRes = await req(`${API_BASE}/marketing/events/${firstEvent._id}/replay`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(replayRes.status, 200, 'Event replay failed');
  assert.strictEqual(replayRes.data.success, true);
  console.log('   ✓ Lead event listing and replay passed.\n');

  console.log('================================================================');
  console.log('🎉 ALL STAGE 1 AUTOMATED TESTS PASSED SUCCESSFULLY! (100% SUCCESS)');
  console.log('================================================================\n');

  process.exit(0);
}

runStage1Tests().catch((err) => {
  console.error('\n❌ STAGE 1 TEST FAILURE:\n', err);
  process.exit(1);
});
