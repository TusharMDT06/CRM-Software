import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Account } from './models/Account.js';
import { Contact } from './models/Contact.js';
import { Deal } from './models/Deal.js';
import { Lead } from './models/Lead.js';
import { Task } from './models/Task.js';
import { Activity } from './models/Activity.js';
import { EmailTemplate } from './models/EmailTemplate.js';
import { FieldDefinition } from './models/FieldDefinition.js';
import { Product } from './models/Product.js';
import { CompanySettings } from './models/CompanySettings.js';
import { Counter } from './models/Counter.js';
import { Quote } from './models/Quote.js';
import { Invoice } from './models/Invoice.js';
import { Payment } from './models/Payment.js';
import { Workflow } from './models/Workflow.js';
import { WorkflowRun } from './models/WorkflowRun.js';
import { Notification } from './models/Notification.js';
import { NotificationPreference } from './models/NotificationPreference.js';
import { Tenant, DEFAULT_PLAN_LIMITS } from './models/Tenant.js';
import { calculateDocumentTotals } from './utils/moneyHelper.js';
import { runWithTenantContext } from './utils/tenantContext.js';

dotenv.config();

export async function runSeed() {
  console.log('[Seed] Starting database seeding...');
  await connectDB();

  const defaultTenant = await runWithTenantContext({ isBypassTenant: true }, async () => {
    // Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      Account.deleteMany({}),
      Contact.deleteMany({}),
      Deal.deleteMany({}),
      Lead.deleteMany({}),
      Task.deleteMany({}),
      Activity.deleteMany({}),
      EmailTemplate.deleteMany({}),
      FieldDefinition.deleteMany({}),
      Counter.deleteMany({}),
      Product.deleteMany({}),
      CompanySettings.deleteMany({}),
      Quote.deleteMany({}),
      Invoice.deleteMany({}),
      Payment.deleteMany({}),
      Workflow.deleteMany({}),
      WorkflowRun.deleteMany({}),
      Notification.deleteMany({}),
      NotificationPreference.deleteMany({}),
    ]);
    console.log('[Seed] Cleared existing data.');

    let tenant = await Tenant.findOne({ slug: 'default' });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Flowdesk Technologies',
        slug: 'default',
        status: 'active',
        plan: 'pro',
        limits: { ...DEFAULT_PLAN_LIMITS.pro },
      });
    }
    return tenant;
  });

  await runWithTenantContext({ tenantId: defaultTenant._id.toString() }, async () => {
    // 1. Create Users
    const passwordHash = await bcrypt.hash('Password@123', 10);

    const [adminUser, managerUser, salesUser, salesUser2, disabledUser] = await Promise.all([
      User.create({
        name: 'Aarav Sharma',
        email: 'admin@crm.test',
        passwordHash,
        role: 'admin',
        active: true,
        isVerified: true,
        tenantId: defaultTenant._id,
      }),
      User.create({
        name: 'Priya Patel',
        email: 'manager@crm.test',
        passwordHash,
        role: 'manager',
        active: true,
        isVerified: true,
        tenantId: defaultTenant._id,
      }),
      User.create({
        name: 'Rohan Mehta',
        email: 'sales@crm.test',
        passwordHash,
        role: 'sales',
        active: true,
        isVerified: true,
        tenantId: defaultTenant._id,
      }),
      User.create({
        name: 'Ananya Iyer',
        email: 'sales2@crm.test',
        passwordHash,
        role: 'sales',
        active: true,
        isVerified: true,
        tenantId: defaultTenant._id,
      }),
      User.create({
        name: 'Vikram Malhotra',
        email: 'disabled@crm.test',
        passwordHash,
        role: 'sales',
        active: false,
        isVerified: true,
        tenantId: defaultTenant._id,
      }),
    ]);

    console.log('[Seed] Created users: admin, manager, sales, sales2, disabled.');

  // 2. Custom Field Definitions (3 per entity)
  const customFieldsData = [
    // Lead Custom Fields
    {
      entity: 'lead',
      key: 'budget_range',
      label: 'Budget Range',
      type: 'select',
      options: ['Under ₹10L', '₹10L - ₹50L', '₹50L - ₹1Cr', '₹1Cr+'],
      required: false,
      order: 0,
      active: true,
    },
    {
      entity: 'lead',
      key: 'urgency',
      label: 'Project Urgency',
      type: 'select',
      options: ['Immediate (30 days)', 'This Quarter', 'Exploring / Next Year'],
      required: false,
      order: 1,
      active: true,
    },
    {
      entity: 'lead',
      key: 'partner_referral_id',
      label: 'Partner Referral ID',
      type: 'text',
      options: [],
      required: false,
      order: 2,
      active: true,
    },

    // Contact Custom Fields
    {
      entity: 'contact',
      key: 'linkedin_url',
      label: 'LinkedIn Profile',
      type: 'url',
      options: [],
      required: false,
      order: 0,
      active: true,
    },
    {
      entity: 'contact',
      key: 'decision_maker',
      label: 'Decision Maker',
      type: 'checkbox',
      options: [],
      required: false,
      order: 1,
      active: true,
    },
    {
      entity: 'contact',
      key: 'preferred_channel',
      label: 'Preferred Channel',
      type: 'select',
      options: ['Email', 'Phone Call', 'WhatsApp'],
      required: false,
      order: 2,
      active: true,
    },

    // Account Custom Fields
    {
      entity: 'account',
      key: 'gst_number',
      label: 'GST Number',
      type: 'text',
      options: [],
      required: false,
      order: 0,
      active: true,
    },
    {
      entity: 'account',
      key: 'client_tier',
      label: 'Strategic Tier',
      type: 'select',
      options: ['Tier 1 (Enterprise)', 'Tier 2 (Mid-Market)', 'Tier 3 (SMB)'],
      required: false,
      order: 1,
      active: true,
    },
    {
      entity: 'account',
      key: 'annual_revenue_cr',
      label: 'Annual Revenue (Cr)',
      type: 'number',
      options: [],
      required: false,
      order: 2,
      active: true,
    },

    // Deal Custom Fields
    {
      entity: 'deal',
      key: 'discount_pct',
      label: 'Approved Discount (%)',
      type: 'number',
      options: [],
      required: false,
      order: 0,
      active: true,
    },
    {
      entity: 'deal',
      key: 'po_number',
      label: 'PO / Reference Code',
      type: 'text',
      options: [],
      required: false,
      order: 1,
      active: true,
    },
    {
      entity: 'deal',
      key: 'target_onboarding_date',
      label: 'Target Go-Live Date',
      type: 'date',
      options: [],
      required: false,
      order: 2,
      active: true,
    },
  ];

  await FieldDefinition.insertMany(customFieldsData);
  console.log('[Seed] Created 12 custom field definitions (3 per entity).');

  // 3. Email Templates (5 templates)
  const emailTemplatesData = [
    {
      name: 'Initial Discovery Reachout',
      category: 'intro',
      subject: 'Quick connection: {{lead.company}} & Flowdesk',
      body: `Hi {{lead.name}},

I came across {{lead.company}} and was really impressed by your rapid expansion in the market.

At Flowdesk, we help fast-growing organizations simplify their sales operations, eliminate manual tracking, and close deals 30% faster.

Would you have 10 minutes this Thursday for a brief introductory conversation?

Best regards,
{{owner.name}}`,
      shared: true,
      owner: adminUser._id,
    },
    {
      name: 'Post-Demo Follow Up & Architecture Overview',
      category: 'follow_up',
      subject: 'Following up on our demo: {{deal.title}}',
      body: `Hi {{contact.firstName}},

Thank you for your valuable time today exploring Flowdesk with the team at {{account.name}}.

As discussed, I have attached our security architecture whitepaper and compliance documentation for {{deal.title}}.

Please let me know if any other stakeholders would like a tailored walkthrough. Looking forward to our next steps!

Warm regards,
{{owner.name}}`,
      shared: true,
      owner: managerUser._id,
    },
    {
      name: 'Executive Commercial Proposal',
      category: 'proposal',
      subject: 'Commercial Proposal: {{deal.title}} for {{account.name}}',
      body: `Dear {{contact.firstName}},

Please find our comprehensive proposal for {{deal.title}}, finalized at {{deal.amount}}.

This includes:
- Enterprise platform license for all team members
- Dedicated Customer Success Manager
- Guaranteed 99.95% uptime SLA
- Priority Indian data residency compliance

We are ready to expedite onboarding upon signature. Feel free to reach out with any questions.

Sincerely,
{{owner.name}}`,
      shared: true,
      owner: salesUser._id,
    },
    {
      name: 'Welcome & Onboarding Kickoff',
      category: 'thank_you',
      subject: 'Welcome to Flowdesk - {{account.name}} Kickoff!',
      body: `Hi {{contact.firstName}},

We are thrilled to officially welcome {{account.name}} to Flowdesk!

Our implementation team has initiated workspace provisioning for {{deal.title}}. Our primary onboarding specialist will be in touch shortly to coordinate the kickoff session.

Thank you for your trust and partnership!

Best regards,
{{owner.name}}`,
      shared: true,
      owner: salesUser._id,
    },
    {
      name: 'Quarterly Check-In & Value Review',
      category: 'other',
      subject: 'Quarterly touchpoint with {{account.name}}',
      body: `Hi {{contact.firstName}},

I wanted to check in and see how everything is progressing with {{account.name}}'s rollout of Flowdesk.

We recently released several new reporting features and workflow enhancements that might benefit your daily team throughput. Would love to set up a quick 15-minute sync.

Best regards,
{{owner.name}}`,
      shared: false,
      owner: salesUser._id,
    },
  ];

  await EmailTemplate.insertMany(emailTemplatesData);
  console.log('[Seed] Created 5 rich email templates.');

  // 4. Create Realistic Indian Accounts with Custom Fields
  const accountsData = [
    {
      name: 'Tata Digital Solutions',
      industry: 'Enterprise Software',
      website: 'https://tatadigital.com',
      phone: '+91 22 6665 8282',
      city: 'Mumbai',
      employees: 1450,
      owner: salesUser._id,
      custom: {
        gst_number: '27AABCT3518Q1ZS',
        client_tier: 'Tier 1 (Enterprise)',
        annual_revenue_cr: 2400,
      },
    },
    {
      name: 'Razorpay Technologies',
      industry: 'FinTech & Payments',
      website: 'https://razorpay.com',
      phone: '+91 80 4666 9999',
      city: 'Bengaluru',
      employees: 920,
      owner: salesUser._id,
      custom: {
        gst_number: '29AABCR8812K1Z9',
        client_tier: 'Tier 1 (Enterprise)',
        annual_revenue_cr: 1800,
      },
    },
    {
      name: 'Reliance Retail Infra',
      industry: 'Retail & Logistics',
      website: 'https://relianceretail.com',
      phone: '+91 22 3555 4000',
      city: 'Navi Mumbai',
      employees: 3800,
      owner: managerUser._id,
      custom: {
        gst_number: '27AABCR4589L1Z2',
        client_tier: 'Tier 1 (Enterprise)',
        annual_revenue_cr: 12500,
      },
    },
    {
      name: 'Zerodha Broking',
      industry: 'Financial Services',
      website: 'https://zerodha.com',
      phone: '+91 80 4718 1888',
      city: 'Bengaluru',
      employees: 480,
      owner: salesUser2._id,
      custom: {
        gst_number: '29AABCZ1245P1Z8',
        client_tier: 'Tier 1 (Enterprise)',
        annual_revenue_cr: 2100,
      },
    },
    {
      name: 'Zomato Enterprise',
      industry: 'Food Tech & Quick Commerce',
      website: 'https://zomato.com',
      phone: '+91 124 415 7777',
      city: 'Gurugram',
      employees: 1600,
      owner: salesUser._id,
      custom: {
        gst_number: '07AABCZ9944M1Z5',
        client_tier: 'Tier 2 (Mid-Market)',
        annual_revenue_cr: 980,
      },
    },
    {
      name: 'Freshworks India',
      industry: 'Cloud CRM & SaaS',
      website: 'https://freshworks.com',
      phone: '+91 44 6667 8000',
      city: 'Chennai',
      employees: 1100,
      owner: adminUser._id,
      custom: {
        gst_number: '33AABCF4410H1ZZ',
        client_tier: 'Tier 2 (Mid-Market)',
        annual_revenue_cr: 650,
      },
    },
    {
      name: 'BrowserStack Labs',
      industry: 'Developer Tools',
      website: 'https://browserstack.com',
      phone: '+91 22 6123 9000',
      city: 'Mumbai',
      employees: 420,
      owner: salesUser2._id,
      custom: {
        gst_number: '27AABCB9191D1ZQ',
        client_tier: 'Tier 2 (Mid-Market)',
        annual_revenue_cr: 420,
      },
    },
    {
      name: 'Delhivery Logistics',
      industry: 'Supply Chain Logistics',
      website: 'https://delhivery.com',
      phone: '+91 124 671 9500',
      city: 'Gurugram',
      employees: 2200,
      owner: managerUser._id,
      custom: {
        gst_number: '07AABCD8833E1Z1',
        client_tier: 'Tier 1 (Enterprise)',
        annual_revenue_cr: 3200,
      },
    },
  ];

  const accounts = await Account.insertMany(accountsData);
  console.log(`[Seed] Created ${accounts.length} accounts.`);

  // 5. Create Realistic Contacts with Custom Fields
  const contactsData = [
    {
      firstName: 'Kavita',
      lastName: 'Reddy',
      email: 'kavita.reddy@tatadigital.com',
      phone: '+91 98201 54321',
      jobTitle: 'VP of Engineering',
      account: accounts[0]._id,
      owner: salesUser._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/kavita-reddy-tata',
        decision_maker: true,
        preferred_channel: 'Email',
      },
    },
    {
      firstName: 'Siddharth',
      lastName: 'Verma',
      email: 'siddharth@razorpay.com',
      phone: '+91 98450 11223',
      jobTitle: 'Head of Infrastructure',
      account: accounts[1]._id,
      owner: salesUser._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/siddharth-verma-razorpay',
        decision_maker: true,
        preferred_channel: 'Phone Call',
      },
    },
    {
      firstName: 'Rajesh',
      lastName: 'Ambani',
      email: 'rajesh.a@relianceretail.com',
      phone: '+91 98199 44332',
      jobTitle: 'Director of Procurement',
      account: accounts[2]._id,
      owner: managerUser._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/rajesh-ambani-retail',
        decision_maker: true,
        preferred_channel: 'Email',
      },
    },
    {
      firstName: 'Nikhil',
      lastName: 'Kamath',
      email: 'nikhil.k@zerodha.com',
      phone: '+91 98860 77889',
      jobTitle: 'Chief Strategy Officer',
      account: accounts[3]._id,
      owner: salesUser2._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/nikhil-kamath',
        decision_maker: true,
        preferred_channel: 'WhatsApp',
      },
    },
    {
      firstName: 'Deepinder',
      lastName: 'Goyal',
      email: 'deepinder@zomato.com',
      phone: '+91 98110 33445',
      jobTitle: 'VP of Commercial Operations',
      account: accounts[4]._id,
      owner: salesUser._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/deepinder-goyal-ops',
        decision_maker: true,
        preferred_channel: 'WhatsApp',
      },
    },
    {
      firstName: 'Girish',
      lastName: 'Mathrubootham',
      email: 'girish@freshworks.com',
      phone: '+91 98400 99881',
      jobTitle: 'VP Global Accounts',
      account: accounts[5]._id,
      owner: adminUser._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/girish-freshworks',
        decision_maker: true,
        preferred_channel: 'Email',
      },
    },
    {
      firstName: 'Ritesh',
      lastName: 'Arora',
      email: 'ritesh@browserstack.com',
      phone: '+91 98200 66778',
      jobTitle: 'Director of Platform Engineering',
      account: accounts[6]._id,
      owner: salesUser2._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/ritesh-arora-bs',
        decision_maker: true,
        preferred_channel: 'Phone Call',
      },
    },
    {
      firstName: 'Sahil',
      lastName: 'Barua',
      email: 'sahil@delhivery.com',
      phone: '+91 98100 22334',
      jobTitle: 'Head of Supply Chain Tech',
      account: accounts[7]._id,
      owner: managerUser._id,
      custom: {
        linkedin_url: 'https://linkedin.com/in/sahil-delhivery',
        decision_maker: false,
        preferred_channel: 'Email',
      },
    },
  ];

  const contacts = await Contact.insertMany(contactsData);
  console.log(`[Seed] Created ${contacts.length} contacts.`);

  // 6. Create Leads with Custom Fields across multiple sources
  const leadsData = [
    {
      name: 'Aditya Birla Chemicals - Sunita Rao',
      email: 'sunita.rao@adityabirla.com',
      phone: '+91 98205 12345',
      company: 'Aditya Birla Chemicals',
      source: 'website',
      status: 'new',
      value: 1850000,
      notes: 'Interested in enterprise license for 80 field agents. Requesting demo.',
      owner: salesUser._id,
      custom: {
        budget_range: '₹10L - ₹50L',
        urgency: 'This Quarter',
        partner_referral_id: 'REF-ABC-2026',
      },
    },
    {
      name: 'Paytm Payment Services - Manish Kapoor',
      email: 'manish.k@paytm.com',
      phone: '+91 98111 65432',
      company: 'Paytm Payments',
      source: 'referral',
      status: 'contacted',
      value: 3400000,
      notes: 'Initial discovery call completed. Pitch deck sent.',
      owner: salesUser._id,
      custom: {
        budget_range: '₹10L - ₹50L',
        urgency: 'Immediate (30 days)',
        partner_referral_id: 'REF-PAYTM-99',
      },
    },
    {
      name: 'Nykaa E-Retail - Pooja Singhania',
      email: 'pooja.s@nykaa.com',
      phone: '+91 98210 98765',
      company: 'Nykaa Lifestyle',
      source: 'event',
      status: 'qualified',
      value: 2200000,
      notes: 'Met at SaaSBoomi 2026 conference. Strong fit for omnichannel sales.',
      owner: salesUser2._id,
      custom: {
        budget_range: '₹10L - ₹50L',
        urgency: 'Immediate (30 days)',
        partner_referral_id: 'SAASBOOMI-26',
      },
    },
    {
      name: 'Lenskart Automation - Tarun Jain',
      email: 'tarun.j@lenskart.com',
      phone: '+91 98104 33221',
      company: 'Lenskart Solutions',
      source: 'social',
      status: 'new',
      value: 1450000,
      notes: 'LinkedIn InMail response regarding workflow automation.',
      owner: salesUser._id,
      custom: {
        budget_range: '₹10L - ₹50L',
        urgency: 'Exploring / Next Year',
        partner_referral_id: '',
      },
    },
    {
      name: 'Titan Company - Arvind Swaminathan',
      email: 'arvind.s@titan.co.in',
      phone: '+91 98452 77112',
      company: 'Titan Industries',
      source: 'referral',
      status: 'contacted',
      value: 4800000,
      notes: 'Evaluating migration from legacy Salesforce setup.',
      owner: managerUser._id,
      custom: {
        budget_range: '₹50L - ₹1Cr',
        urgency: 'This Quarter',
        partner_referral_id: '',
      },
    },
    {
      name: 'Swiggy Instamart - Devendra Joshi',
      email: 'devendra.j@swiggy.in',
      phone: '+91 98801 88223',
      company: 'Swiggy Enterprise',
      source: 'email',
      status: 'converted',
      value: 2750000,
      notes: 'Converted successfully into enterprise deal.',
      owner: salesUser._id,
      custom: {
        budget_range: '₹10L - ₹50L',
        urgency: 'Immediate (30 days)',
        partner_referral_id: 'CONV-SWIGGY-01',
      },
    },
    {
      name: 'Byju Learning - Harish Nair',
      email: 'harish.n@byjus.com',
      phone: '+91 98451 99002',
      company: 'Think & Learn',
      source: 'website',
      status: 'lost',
      value: 950000,
      notes: 'Budget freeze on edtech tooling.',
      owner: salesUser._id,
      custom: {
        budget_range: 'Under ₹10L',
        urgency: 'Exploring / Next Year',
        partner_referral_id: '',
      },
    },
    {
      name: 'Groww Technologies - Deepak Goyal',
      email: 'deepak.g@groww.in',
      phone: '+91 98455 11990',
      company: 'Groww Invest Tech',
      source: 'website',
      status: 'qualified',
      value: 3600000,
      notes: 'Inbound demo inquiry for wealth management team sales flow.',
      owner: salesUser._id,
      custom: {
        budget_range: '₹10L - ₹50L',
        urgency: 'This Quarter',
        partner_referral_id: 'INB-GROWW',
      },
    },
    {
      name: 'Zepto Quick Deliveries - Aadit Palicha',
      email: 'aadit@zepto.in',
      phone: '+91 98200 44556',
      company: 'Kiranakart Tech',
      source: 'referral',
      status: 'converted',
      value: 5200000,
      notes: 'Rapid grocery dark store operations routing deal.',
      owner: salesUser2._id,
      custom: {
        budget_range: '₹50L - ₹1Cr',
        urgency: 'Immediate (30 days)',
        partner_referral_id: 'REF-ZEPTO',
      },
    },
  ];

  const leads = await Lead.insertMany(leadsData);
  console.log(`[Seed] Created ${leads.length} leads.`);

  // 7. Create Realistic Deals with Custom Fields (rich distribution for Reports)
  const now = new Date();
  const pastMonth = (monthsAgo: number, day = 15) => {
    return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
  };
  const futureDays = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };
  const pastDays = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  const dealsData = [
    // WON deals spread across calendar months
    {
      title: 'Tata Digital - Omnichannel Cloud Rollout',
      account: accounts[0]._id,
      contact: contacts[0]._id,
      amount: 4200000, // ₹42 Lakhs
      stage: 'won',
      expectedClose: pastMonth(0, 5),
      closedAt: pastMonth(0, 5),
      owner: salesUser._id,
      custom: {
        discount_pct: 10,
        po_number: 'PO-TATA-2026-90',
        target_onboarding_date: '2026-10-25',
      },
    },
    {
      title: 'Razorpay - Developer Operations Portal',
      account: accounts[1]._id,
      contact: contacts[1]._id,
      amount: 3500000, // ₹35 Lakhs
      stage: 'won',
      expectedClose: pastMonth(1, 18),
      closedAt: pastMonth(1, 18),
      owner: salesUser._id,
      custom: {
        discount_pct: 5,
        po_number: 'PO-RZP-OCT-44',
        target_onboarding_date: '2026-09-30',
      },
    },
    {
      title: 'Freshworks - Partner CRM Integration',
      account: accounts[5]._id,
      contact: contacts[5]._id,
      amount: 2800000, // ₹28 Lakhs
      stage: 'won',
      expectedClose: pastMonth(2, 22),
      closedAt: pastMonth(2, 22),
      owner: adminUser._id,
      custom: {
        discount_pct: 0,
        po_number: 'FW-INT-552',
        target_onboarding_date: '2026-08-15',
      },
    },
    {
      title: 'Zerodha - Wealth Advisory Workspace',
      account: accounts[3]._id,
      contact: contacts[3]._id,
      amount: 5500000, // ₹55 Lakhs
      stage: 'won',
      expectedClose: pastMonth(3, 10),
      closedAt: pastMonth(3, 10),
      owner: salesUser2._id,
      custom: {
        discount_pct: 8,
        po_number: 'ZD-WA-901',
        target_onboarding_date: '2026-07-20',
      },
    },
    {
      title: 'BrowserStack - Global Enterprise Tier',
      account: accounts[6]._id,
      contact: contacts[6]._id,
      amount: 3100000, // ₹31 Lakhs
      stage: 'won',
      expectedClose: pastMonth(4, 14),
      closedAt: pastMonth(4, 14),
      owner: salesUser2._id,
      custom: {
        discount_pct: 5,
        po_number: 'BS-ENT-440',
        target_onboarding_date: '2026-06-15',
      },
    },
    {
      title: 'Delhivery - Hub Routing CRM Upgrade',
      account: accounts[7]._id,
      contact: contacts[7]._id,
      amount: 4800000, // ₹48 Lakhs
      stage: 'won',
      expectedClose: pastMonth(5, 20),
      closedAt: pastMonth(5, 20),
      owner: managerUser._id,
      custom: {
        discount_pct: 12,
        po_number: 'DLHV-ROUT-11',
        target_onboarding_date: '2026-05-30',
      },
    },

    // OPEN DEALS (for Pipeline & Forecast across future months)
    {
      title: 'Reliance Retail - Hyperlocal POS Sync',
      account: accounts[2]._id,
      contact: contacts[2]._id,
      amount: 12500000, // ₹1.25 Cr
      stage: 'negotiation',
      expectedClose: futureDays(12),
      closedAt: null,
      owner: managerUser._id,
      custom: {
        discount_pct: 7,
        po_number: 'DRAFT-RIL-01',
        target_onboarding_date: '2026-11-01',
      },
    },
    {
      title: 'Zomato - Fleet Management Platform',
      account: accounts[4]._id,
      contact: contacts[4]._id,
      amount: 6800000, // ₹68 Lakhs
      stage: 'proposal',
      expectedClose: futureDays(24),
      closedAt: null,
      owner: salesUser._id,
      custom: {
        discount_pct: 10,
        po_number: 'DRAFT-ZOM-88',
        target_onboarding_date: '2026-11-15',
      },
    },
    {
      title: 'Razorpay - Merchant Dispute Automation',
      account: accounts[1]._id,
      contact: contacts[1]._id,
      amount: 4500000, // ₹45 Lakhs
      stage: 'negotiation',
      expectedClose: pastDays(6), // Overdue
      closedAt: null,
      owner: salesUser._id,
      custom: {
        discount_pct: 15,
        po_number: '',
        target_onboarding_date: '2026-10-31',
      },
    },
    {
      title: 'Tata Digital - Loyalty Integration Suite',
      account: accounts[0]._id,
      contact: contacts[0]._id,
      amount: 5200000, // ₹52 Lakhs
      stage: 'qualified',
      expectedClose: pastDays(14), // Overdue / at risk
      closedAt: null,
      owner: salesUser._id,
      custom: {
        discount_pct: 0,
        po_number: '',
        target_onboarding_date: '2026-12-01',
      },
    },
    {
      title: 'BrowserStack - Team License Expansion',
      account: accounts[6]._id,
      contact: contacts[6]._id,
      amount: 2100000, // ₹21 Lakhs
      stage: 'qualified',
      expectedClose: futureDays(60), // Next month
      closedAt: null,
      owner: salesUser2._id,
      custom: {
        discount_pct: 5,
        po_number: '',
        target_onboarding_date: '2026-12-15',
      },
    },
    {
      title: 'Zerodha - Compliance Automation Suite',
      account: accounts[3]._id,
      contact: contacts[3]._id,
      amount: 7200000, // ₹72 Lakhs
      stage: 'proposal',
      expectedClose: futureDays(80), // In 2 months
      closedAt: null,
      owner: salesUser2._id,
      custom: {
        discount_pct: 8,
        po_number: '',
        target_onboarding_date: '2027-01-10',
      },
    },
    {
      title: 'Delhivery - Driver Onboarding Portal',
      account: accounts[7]._id,
      contact: contacts[7]._id,
      amount: 1900000, // ₹19 Lakhs
      stage: 'lost',
      expectedClose: pastMonth(1, 28),
      closedAt: pastMonth(1, 28),
      owner: managerUser._id,
      custom: {
        discount_pct: 0,
        po_number: '',
        target_onboarding_date: '',
      },
    },
  ];

  const deals = await Deal.insertMany(dealsData);
  console.log(`[Seed] Created ${deals.length} deals.`);

  // 8. Create Realistic Tasks
  const tasksData = [
    {
      title: 'Contract review with Reliance legal counsel',
      description: 'Review MSA liability and uptime SLA clauses for Hyperlocal POS contract.',
      dueDate: pastDays(2),
      status: 'open',
      priority: 'high',
      deal: deals[6]._id,
      owner: managerUser._id,
    },
    {
      title: 'Present executive demo for Razorpay Merchant Team',
      description: 'Showcase automated chargeback workflow and instant dispute webhook.',
      dueDate: pastDays(4),
      status: 'open',
      priority: 'high',
      deal: deals[8]._id,
      owner: salesUser._id,
    },
    {
      title: 'Send customized quotation to Zomato procurement',
      description: 'Include 15% annual multi-seat discount and dedicated account manager SLA.',
      dueDate: futureDays(1),
      status: 'open',
      priority: 'high',
      deal: deals[7]._id,
      owner: salesUser._id,
    },
    {
      title: 'Security questionnaire follow-up with Tata CISO',
      description: 'Verify SOC2 Type II report and ISO 27001 data residency compliance.',
      dueDate: futureDays(3),
      status: 'open',
      priority: 'medium',
      deal: deals[9]._id,
      owner: salesUser._id,
    },
    {
      title: 'Prepare onboarding roadmap for BrowserStack',
      description: 'Draft 30-day timeline for migration of developer test keys.',
      dueDate: futureDays(6),
      status: 'open',
      priority: 'low',
      deal: deals[10]._id,
      owner: salesUser2._id,
    },
    {
      title: 'Finalize payment settlement for Tata Digital won deal',
      description: 'Verify invoice generation and PO sign-off.',
      dueDate: pastMonth(0, 8),
      status: 'done',
      priority: 'high',
      deal: deals[0]._id,
      owner: salesUser._id,
    },
    {
      title: 'Collect testimonial from Razorpay IT team',
      description: 'Request 2-paragraph quote for quarterly product update.',
      dueDate: pastMonth(1, 20),
      status: 'done',
      priority: 'medium',
      deal: deals[1]._id,
      owner: salesUser._id,
    },
  ];

  const tasks = await Task.insertMany(tasksData);
  console.log(`[Seed] Created ${tasks.length} tasks.`);

  // 9. Create Activities across records (Timeline & Recent Activity Card)
  const activitiesData = [
    // Lead Activities
    {
      type: 'note',
      subject: 'Inbound demo inquiry review',
      body: 'Prospect indicated they need quick onboarding within 30 days. Budget is pre-approved by CFO.',
      entityType: 'lead',
      entityId: leads[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(5),
    },
    {
      type: 'call',
      subject: 'Discovery qualification call with Sunita',
      body: 'Connected with VP of Engineering. Discussed user seat counts and SSO requirements.',
      entityType: 'lead',
      entityId: leads[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(3),
      durationMins: 22,
      outcome: 'connected',
    },
    {
      type: 'meeting',
      subject: 'Product Demo & Architecture Q&A',
      body: 'Walked through custom field configurations, automated workflows, and CRM pipeline views.',
      entityType: 'lead',
      entityId: leads[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(1),
      durationMins: 45,
    },
    {
      type: 'system',
      subject: 'Lead converted into Deal',
      body: 'Lead Swiggy Instamart converted to Account, Contact, and Deal successfully.',
      entityType: 'lead',
      entityId: leads[5]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(4),
    },

    // Account Activities
    {
      type: 'note',
      subject: 'Account briefing note',
      body: 'Tata Digital is centralizing SaaS operations into one CRM hub across 4 business units.',
      entityType: 'account',
      entityId: accounts[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(10),
    },
    {
      type: 'call',
      subject: 'Q4 Budget alignment with Finance',
      body: 'Called finance department to confirm PO issuance date.',
      entityType: 'account',
      entityId: accounts[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(2),
      durationMins: 15,
      outcome: 'connected',
    },

    // Contact Activities
    {
      type: 'note',
      subject: 'Executive preferences',
      body: 'Kavita prefers all architecture diagrams sent as PDF attachments prior to syncs.',
      entityType: 'contact',
      entityId: contacts[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(7),
    },
    {
      type: 'email',
      subject: 'Sent: Following up on our demo: Tata Digital - Omnichannel Cloud Rollout',
      body: 'Shared security audit certificates and customer case studies.',
      entityType: 'contact',
      entityId: contacts[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(3),
    },

    // Deal Activities
    {
      type: 'stage_change',
      subject: 'Deal Stage Changed',
      body: 'Deal stage advanced from Proposal to Negotiation.',
      entityType: 'deal',
      entityId: deals[6]._id,
      createdBy: managerUser._id,
      occurredAt: pastDays(6),
    },
    {
      type: 'meeting',
      subject: 'Procurement Negotiation Session',
      body: 'Agreed on 3-year term with annual payment schedule and 7% corporate discount.',
      entityType: 'deal',
      entityId: deals[6]._id,
      createdBy: managerUser._id,
      occurredAt: pastDays(2),
      durationMins: 60,
    },
    {
      type: 'call',
      subject: 'Quick follow-up with Deepinder',
      body: 'Attempted to call regarding procurement approval. Left detailed voicemail.',
      entityType: 'deal',
      entityId: deals[7]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(1),
      durationMins: 3,
      outcome: 'left_message',
    },
    {
      type: 'task',
      subject: 'Completed Task',
      body: 'Completed task: Finalize payment settlement for Tata Digital won deal.',
      entityType: 'deal',
      entityId: deals[0]._id,
      createdBy: salesUser._id,
      occurredAt: pastDays(8),
    },
  ];

  const activities = await Activity.insertMany(activitiesData);
  console.log(`[Seed] Created ${activities.length} timeline activities.`);

  // 10. Company Settings
  const companySettings = await CompanySettings.create({
    legalName: 'Flowdesk Technologies India Pvt Ltd',
    address: 'Plot 42, Hiranandani Business Park, Central Avenue, Powai, Mumbai',
    state: 'Maharashtra',
    gstin: '27AABCF1234F1Z9',
    pan: 'AABCF1234F',
    phone: '+91 22 4988 2000',
    email: 'billing@flowdesk.in',
    website: 'https://flowdesk.in',
    bankDetails: {
      accountName: 'Flowdesk Technologies India Pvt Ltd',
      accountNumber: '918020045612345',
      ifsc: 'UTIB0000042',
      bankName: 'Axis Bank Ltd',
    },
    defaultPaymentTermsDays: 30,
    defaultQuoteValidityDays: 15,
    defaultTerms:
      'Payment due within 30 days of invoice issuance. Late payments incur interest at 1.5% per month. Goods/services remain property of vendor until paid in full.',
    quotePrefix: 'QT',
    invoicePrefix: 'INV',
    updatedBy: adminUser._id,
  });
  console.log('[Seed] Created Company Settings.');

  // 11. Products Catalog
  const productsData = [
    {
      name: 'Flowdesk CRM Starter Tier',
      sku: 'CRM-START',
      description: 'Up to 5 users, core contacts, pipeline management & email integration.',
      unitPrice: 1500000, // ₹15,000.00
      taxRate: 18,
      unit: 'nos',
      active: true,
      owner: adminUser._id,
    },
    {
      name: 'Flowdesk Growth License',
      sku: 'CRM-GROWTH',
      description: 'Up to 25 users, workflows automation, custom reporting & audit trails.',
      unitPrice: 4500000, // ₹45,000.00
      taxRate: 18,
      unit: 'nos',
      active: true,
      owner: adminUser._id,
    },
    {
      name: 'Flowdesk Enterprise Unlimited',
      sku: 'CRM-ENT',
      description: 'Unlimited users, priority SLA, dedicated account manager & audit compliance.',
      unitPrice: 12000000, // ₹1,20,000.00
      taxRate: 18,
      unit: 'nos',
      active: true,
      owner: adminUser._id,
    },
    {
      name: 'Implementation & Data Migration',
      sku: 'SRV-IMPL',
      description: 'End-to-end data cleansing, legacy migration and workflow configurations.',
      unitPrice: 7500000, // ₹75,000.00
      taxRate: 18,
      unit: 'days',
      active: true,
      owner: managerUser._id,
    },
    {
      name: 'Dedicated Technical Support SLA',
      sku: 'SRV-SLA',
      description: '24/7 priority escalation desk with 1-hour response SLA guarantee.',
      unitPrice: 3000000, // ₹30,000.00
      taxRate: 18,
      unit: 'months',
      active: true,
      owner: managerUser._id,
    },
    {
      name: 'Custom Integration Engineering',
      sku: 'SRV-DEV',
      description: 'Custom API development, webhooks & third-party ERP connectivity.',
      unitPrice: 500000, // ₹5,000.00
      taxRate: 18,
      unit: 'hours',
      active: true,
      owner: adminUser._id,
    },
  ];
  const products = await Product.insertMany(productsData);
  console.log(`[Seed] Created ${products.length} products.`);

  // 12. Quotes
  const quotesData = [
    // Quote 1: Draft
    (() => {
      const items = [
        { product: products[0]._id, name: products[0].name, description: products[0].description, qty: 2, unitPrice: products[0].unitPrice, discountPct: 5, taxRate: 18 },
        { product: products[3]._id, name: products[3].name, description: products[3].description, qty: 1, unitPrice: products[3].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'QT-2026-0001',
        status: 'draft',
        deal: deals[1]._id,
        account: accounts[1]._id,
        contact: contacts[1]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        validUntil: futureDays(15),
        publicToken: crypto.randomBytes(32).toString('hex'),
        notes: 'Initial quotation for Starter package.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Quote 2: Pending Approval (>15% discount)
    (() => {
      const items = [
        { product: products[2]._id, name: products[2].name, description: products[2].description, qty: 10, unitPrice: products[2].unitPrice, discountPct: 20, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'inter');
      return {
        number: 'QT-2026-0002',
        status: 'pending_approval',
        deal: deals[2]._id,
        account: accounts[2]._id,
        contact: contacts[2]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'inter',
        validUntil: futureDays(10),
        publicToken: crypto.randomBytes(32).toString('hex'),
        approval: {
          required: true,
          status: 'pending',
          requestedAt: pastDays(1),
          reason: 'Discount of 20% exceeds maximum standard sales limit (15%)',
        },
        notes: 'Enterprise rollout quotation with bulk volume discount.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Quote 3: Sent
    (() => {
      const items = [
        { product: products[1]._id, name: products[1].name, description: products[1].description, qty: 1, unitPrice: products[1].unitPrice, discountPct: 0, taxRate: 18 },
        { product: products[4]._id, name: products[4].name, description: products[4].description, qty: 3, unitPrice: products[4].unitPrice, discountPct: 10, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'QT-2026-0003',
        status: 'sent',
        deal: deals[3]._id,
        account: accounts[3]._id,
        contact: contacts[3]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        validUntil: futureDays(12),
        sentAt: pastDays(3),
        publicToken: crypto.randomBytes(32).toString('hex'),
        notes: 'Sent via Resend email with public portal review link.',
        terms: companySettings.defaultTerms,
        owner: managerUser._id,
      };
    })(),
    // Quote 4: Viewed
    (() => {
      const items = [
        { product: products[1]._id, name: products[1].name, description: products[1].description, qty: 2, unitPrice: products[1].unitPrice, discountPct: 5, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'QT-2026-0004',
        status: 'viewed',
        deal: deals[4]._id,
        account: accounts[4]._id,
        contact: contacts[4]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        validUntil: futureDays(7),
        sentAt: pastDays(5),
        viewedAt: pastDays(2),
        publicToken: crypto.randomBytes(32).toString('hex'),
        notes: 'Customer opened public quote link.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Quote 5: Accepted
    (() => {
      const items = [
        { product: products[0]._id, name: products[0].name, description: products[0].description, qty: 3, unitPrice: products[0].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'inter');
      return {
        number: 'QT-2026-0005',
        status: 'accepted',
        deal: deals[0]._id,
        account: accounts[0]._id,
        contact: contacts[0]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'inter',
        validUntil: futureDays(20),
        sentAt: pastDays(10),
        viewedAt: pastDays(8),
        respondedAt: pastDays(6),
        publicToken: 'accepted-demo-token-1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        notes: 'Customer accepted online through public portal.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Quote 6: Declined
    (() => {
      const items = [
        { product: products[2]._id, name: products[2].name, description: products[2].description, qty: 1, unitPrice: products[2].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'QT-2026-0006',
        status: 'declined',
        deal: deals[5]._id,
        account: accounts[5]._id,
        contact: contacts[5]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        validUntil: pastDays(2),
        sentAt: pastDays(12),
        viewedAt: pastDays(11),
        respondedAt: pastDays(10),
        responseReason: 'Budget postponed to next financial year.',
        publicToken: crypto.randomBytes(32).toString('hex'),
        notes: 'Customer declined quote with written feedback.',
        terms: companySettings.defaultTerms,
        owner: salesUser2._id,
      };
    })(),
    // Quote 7: Expired
    (() => {
      const items = [
        { product: products[1]._id, name: products[1].name, description: products[1].description, qty: 1, unitPrice: products[1].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'QT-2026-0007',
        status: 'expired',
        deal: deals[6]._id,
        account: accounts[6]._id,
        contact: contacts[6]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        validUntil: pastDays(15),
        sentAt: pastDays(35),
        publicToken: crypto.randomBytes(32).toString('hex'),
        notes: 'Expired automatically by scheduler.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
  ];
  const quotes = await Quote.insertMany(quotesData);
  console.log(`[Seed] Created ${quotes.length} quotes.`);

  // 13. Invoices
  const invoicesData = [
    // Invoice 1: Draft
    (() => {
      const items = [
        { product: products[0]._id, name: products[0].name, qty: 2, unitPrice: products[0].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'INV-2026-0001',
        status: 'draft',
        deal: deals[1]._id,
        account: accounts[1]._id,
        contact: contacts[1]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        issueDate: new Date(),
        dueDate: futureDays(30),
        paidTotal: 0,
        balance: totals.total,
        notes: 'Draft invoice awaiting billing review.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Invoice 2: Sent
    (() => {
      const items = [
        { product: products[1]._id, name: products[1].name, qty: 1, unitPrice: products[1].unitPrice, discountPct: 5, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'inter');
      return {
        number: 'INV-2026-0002',
        status: 'sent',
        deal: deals[2]._id,
        account: accounts[2]._id,
        contact: contacts[2]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'inter',
        issueDate: pastDays(5),
        dueDate: futureDays(25),
        paidTotal: 0,
        balance: totals.total,
        sentAt: pastDays(5),
        notes: 'Invoice dispatched with GST bill.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Invoice 3: Partially Paid
    (() => {
      const items = [
        { product: products[3]._id, name: products[3].name, qty: 1, unitPrice: products[3].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      const partialPaymentPaise = 4000000; // ₹40,000 paid
      return {
        number: 'INV-2026-0003',
        status: 'partially_paid',
        deal: deals[3]._id,
        account: accounts[3]._id,
        contact: contacts[3]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        issueDate: pastDays(15),
        dueDate: futureDays(15),
        paidTotal: partialPaymentPaise,
        balance: totals.total - partialPaymentPaise,
        sentAt: pastDays(15),
        notes: 'Advance installment received via NEFT.',
        terms: companySettings.defaultTerms,
        owner: managerUser._id,
      };
    })(),
    // Invoice 4: Paid
    (() => {
      const items = [
        { product: products[0]._id, name: products[0].name, qty: 5, unitPrice: products[0].unitPrice, discountPct: 10, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'INV-2026-0004',
        status: 'paid',
        deal: deals[0]._id,
        account: accounts[0]._id,
        contact: contacts[0]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        issueDate: pastDays(25),
        dueDate: futureDays(5),
        paidTotal: totals.total,
        balance: 0,
        sentAt: pastDays(25),
        notes: 'Fully settled via UPI corporate transfer.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Invoice 5: Overdue
    (() => {
      const items = [
        { product: products[2]._id, name: products[2].name, qty: 1, unitPrice: products[2].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'inter');
      return {
        number: 'INV-2026-0005',
        status: 'overdue',
        deal: deals[4]._id,
        account: accounts[4]._id,
        contact: contacts[4]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'inter',
        issueDate: pastDays(45),
        dueDate: pastDays(15),
        paidTotal: 0,
        balance: totals.total,
        sentAt: pastDays(45),
        notes: 'Overdue invoice. Payment reminder sent.',
        terms: companySettings.defaultTerms,
        owner: salesUser._id,
      };
    })(),
    // Invoice 6: Void
    (() => {
      const items = [
        { product: products[4]._id, name: products[4].name, qty: 1, unitPrice: products[4].unitPrice, discountPct: 0, taxRate: 18 },
      ];
      const totals = calculateDocumentTotals(items, 'intra');
      return {
        number: 'INV-2026-0006',
        status: 'void',
        deal: deals[5]._id,
        account: accounts[5]._id,
        contact: contacts[5]._id,
        items: totals.lineDetails,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        total: totals.total,
        taxMode: 'intra',
        issueDate: pastDays(20),
        dueDate: futureDays(10),
        paidTotal: 0,
        balance: totals.total,
        voidedAt: pastDays(1),
        voidReason: 'Cancelled due to amended entity contract.',
        notes: 'Voided by manager.',
        terms: companySettings.defaultTerms,
        owner: managerUser._id,
      };
    })(),
  ];
  const invoices = await Invoice.insertMany(invoicesData);
  console.log(`[Seed] Created ${invoices.length} invoices.`);

  // 14. Payments
  const paymentsData = [
    {
      invoice: invoices[2]._id, // INV-2026-0003
      amount: 4000000,
      method: 'bank_transfer',
      reference: 'AXIS-NEFT-99238472',
      paidAt: pastDays(8),
      notes: 'Initial 50% mobilization deposit',
      recordedBy: managerUser._id,
    },
    {
      invoice: invoices[3]._id, // INV-2026-0004
      amount: invoices[3].total,
      method: 'upi',
      reference: 'UPI-CR-2026-781923',
      paidAt: pastDays(10),
      notes: 'Full payment received in single installment',
      recordedBy: salesUser._id,
    },
  ];
  const payments = await Payment.insertMany(paymentsData);
  console.log(`[Seed] Created ${payments.length} payments.`);

  // 15. Atomic Counters
  await Counter.insertMany([
    { prefix: 'QT', year: 2026, seq: 7 },
    { prefix: 'INV', year: 2026, seq: 6 },
  ]);
  console.log('[Seed] Initialized atomic numbering counters.');

  // 16. Workflows (4 example workflows, disabled by default)
  const workflowsData = [
    {
      name: 'High-Value Deal Executive Alert',
      description: 'When a deal above ₹5,00,000 is created, automatically create a review task for the manager.',
      enabled: false,
      trigger: { type: 'deal_created' },
      conditions: [{ field: 'amount', operator: 'greater_than', value: 500000 }],
      actions: [
        {
          type: 'create_task',
          config: {
            taskTitle: 'Executive Review: Review high-value opportunity {{title}}',
            taskDueInDays: 2,
            taskAssignee: String(managerUser._id),
          },
        },
      ],
      owner: adminUser._id,
    },
    {
      name: 'Deal Won Customer Gratitude Email',
      description: 'Send a thank-you note and onboarding welcome notification when a deal is closed won.',
      enabled: false,
      trigger: { type: 'deal_won' },
      conditions: [],
      actions: [
        {
          type: 'send_notification',
          config: {
            notificationRecipient: 'owner',
          },
        },
      ],
      owner: adminUser._id,
    },
    {
      name: 'Overdue Invoice Escalation Reminder',
      description: 'Send an automated notification to the invoice owner when an invoice passes its due date.',
      enabled: false,
      trigger: { type: 'invoice_overdue' },
      conditions: [],
      actions: [
        {
          type: 'send_notification',
          config: {
            notificationRecipient: 'owner',
          },
        },
      ],
      owner: adminUser._id,
    },
    {
      name: 'Website Leads Round-Robin Distributor',
      description: 'Automatically rotate new website inbound leads across active sales team reps.',
      enabled: false,
      trigger: { type: 'lead_created' },
      conditions: [{ field: 'source', operator: 'equals', value: 'website' }],
      actions: [
        {
          type: 'assign_owner',
          config: {
            roundRobinUsers: [String(salesUser._id), String(salesUser2._id)],
          },
        },
      ],
      owner: adminUser._id,
    },
  ];
  const workflows = await Workflow.insertMany(workflowsData);
  console.log(`[Seed] Created ${workflows.length} automation workflows.`);

  // 17. Sample Notifications
  const notificationsData = [
    {
      user: salesUser._id,
      type: 'quote_accepted',
      title: 'Quote Accepted by Client',
      body: 'Tata Digital has accepted quote QT-2026-0005. You can now generate an invoice.',
      link: `/quotes/${quotes[4]._id}`,
      entityType: 'quote',
      entityId: String(quotes[4]._id),
      createdAt: pastDays(2),
    },
    {
      user: managerUser._id,
      type: 'quote_needs_approval',
      title: 'Quote Approval Required',
      body: 'Rohan Mehta submitted quote QT-2026-0002 with a 20% discount requiring management review.',
      link: `/quotes/${quotes[1]._id}`,
      entityType: 'quote',
      entityId: String(quotes[1]._id),
      createdAt: pastDays(1),
    },
    {
      user: salesUser._id,
      type: 'invoice_overdue',
      title: 'Invoice Overdue Notice',
      body: 'Invoice INV-2026-0005 for ₹1,41,600 is past its due date. Please follow up on payment.',
      link: `/invoices/${invoices[4]._id}`,
      entityType: 'invoice',
      entityId: String(invoices[4]._id),
      createdAt: pastDays(3),
    },
    {
      user: adminUser._id,
      type: 'invoice_paid',
      title: 'Full Payment Received',
      body: 'Invoice INV-2026-0004 has been fully settled for ₹79,650.',
      link: `/invoices/${invoices[3]._id}`,
      entityType: 'invoice',
      entityId: String(invoices[3]._id),
      createdAt: pastDays(5),
    },
  ];
  const notifications = await Notification.insertMany(notificationsData);
  console.log(`[Seed] Created ${notifications.length} sample notifications.`);

  // 18. Default Notification Preferences
  const prefUsers = [adminUser, managerUser, salesUser, salesUser2];
  for (const u of prefUsers) {
    await NotificationPreference.create({
      user: u._id,
      preferences: new Map([
        ['task_assigned', { inApp: true, email: false }],
        ['task_due_today', { inApp: true, email: false }],
        ['task_overdue', { inApp: true, email: false }],
        ['deal_assigned', { inApp: true, email: false }],
        ['deal_won', { inApp: true, email: false }],
        ['quote_viewed', { inApp: true, email: false }],
        ['quote_accepted', { inApp: true, email: true }],
        ['quote_declined', { inApp: true, email: false }],
        ['quote_needs_approval', { inApp: true, email: true }],
        ['invoice_paid', { inApp: true, email: true }],
        ['invoice_overdue', { inApp: true, email: true }],
      ]),
    });
  }
  console.log('[Seed] Created Notification Preferences for users.');
  });

  console.log('[Seed] Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Demo Credentials:');
  console.log('Admin:   admin@crm.test   / Password@123');
  console.log('Manager: manager@crm.test / Password@123');
  console.log('Sales:   sales@crm.test   / Password@123');
  console.log('Sales 2: sales2@crm.test  / Password@123');
  console.log('----------------------------------------------------');
}

// Execute seed if run directly
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}
