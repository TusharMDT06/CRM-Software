import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function seedCleanDistribution() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm');

  const User = mongoose.model('User', new mongoose.Schema({ name: String, email: String, role: String }));
  const Deal = mongoose.model('Deal', new mongoose.Schema({
    title: String,
    stage: String,
    amount: Number,
    owner: mongoose.Schema.Types.ObjectId,
    account: mongoose.Schema.Types.ObjectId,
    contact: mongoose.Schema.Types.ObjectId,
    closedAt: Date,
    expectedClose: Date,
    tenantId: mongoose.Schema.Types.ObjectId,
    createdAt: Date,
    updatedAt: Date,
  }));
  const Lead = mongoose.model('Lead', new mongoose.Schema({
    title: String,
    owner: mongoose.Schema.Types.ObjectId,
    tenantId: mongoose.Schema.Types.ObjectId,
    status: String,
    createdAt: Date,
  }));
  const Contact = mongoose.model('Contact', new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    owner: mongoose.Schema.Types.ObjectId,
    tenantId: mongoose.Schema.Types.ObjectId,
    createdAt: Date,
  }));
  const Task = mongoose.model('Task', new mongoose.Schema({
    title: String,
    description: String,
    dueDate: Date,
    status: String,
    priority: String,
    type: String,
    deal: mongoose.Schema.Types.ObjectId,
    owner: mongoose.Schema.Types.ObjectId,
    tenantId: mongoose.Schema.Types.ObjectId,
  }));
  const Account = mongoose.model('Account', new mongoose.Schema({
    name: String,
    industry: String,
    tenantId: mongoose.Schema.Types.ObjectId,
  }));

  const aarav = await User.findOne({ email: 'admin@crm.test' });
  const priya = await User.findOne({ email: 'manager@crm.test' });
  const rohan = await User.findOne({ email: 'sales@crm.test' });
  const ananya = await User.findOne({ email: 'sales2@crm.test' });

  if (!aarav || !priya || !rohan || !ananya) {
    console.error('Users not found');
    process.exit(1);
  }

  const tenantId = aarav._doc.tenantId || (await Account.findOne())?.tenantId;
  const anyAccount = await Account.findOne();
  const accId = anyAccount?._id;

  const now = new Date();
  const oct5 = new Date(2026, 9, 5);
  const oct8 = new Date(2026, 9, 8);
  const oct10 = new Date(2026, 9, 10);
  const oct12 = new Date(2026, 9, 12);
  const aug20 = new Date(2026, 7, 20);

  // 1. Ensure Aarav's deals
  await Deal.deleteMany({ owner: aarav._id });
  const aaravDeals = await Deal.insertMany([
    {
      title: 'Tata Digital - Omnichannel Cloud Rollout',
      stage: 'won',
      amount: 4200000,
      owner: aarav._id,
      account: accId,
      closedAt: oct5,
      expectedClose: oct5,
      tenantId,
      createdAt: new Date(2026, 8, 1),
    },
    {
      title: 'Freshworks - Partner CRM Integration',
      stage: 'won',
      amount: 2800000,
      owner: aarav._id,
      account: accId,
      closedAt: aug20,
      expectedClose: aug20,
      tenantId,
      createdAt: new Date(2026, 6, 15),
    },
    {
      title: 'Tata Digital - Loyalty Integration Suite',
      stage: 'qualified',
      amount: 5200000,
      owner: aarav._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 15),
      tenantId,
      createdAt: new Date(2026, 8, 10),
    },
    {
      title: 'Zomato - Fleet Management Platform',
      stage: 'proposal',
      amount: 6800000,
      owner: aarav._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 25),
      tenantId,
      createdAt: new Date(2026, 8, 12),
    },
    {
      title: 'Razorpay - Merchant Dispute Automation',
      stage: 'negotiation',
      amount: 4500000,
      owner: aarav._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 28),
      tenantId,
      createdAt: new Date(2026, 8, 18),
    },
    {
      title: 'Byju Learning - Enterprise LMS Suite',
      stage: 'lost',
      amount: 1200000,
      owner: aarav._id,
      account: accId,
      closedAt: oct12,
      expectedClose: oct12,
      tenantId,
      createdAt: new Date(2026, 8, 20),
    },
  ]);

  // 2. Ensure Priya's deals (Manager)
  await Deal.deleteMany({ owner: priya._id });
  await Deal.insertMany([
    {
      title: 'Delhivery - Hub Routing CRM Upgrade',
      stage: 'won',
      amount: 4800000,
      owner: priya._id,
      account: accId,
      closedAt: oct8,
      expectedClose: oct8,
      tenantId,
      createdAt: new Date(2026, 8, 5),
    },
    {
      title: 'Infosys - Cloud Security Audit Suite',
      stage: 'qualified',
      amount: 3500000,
      owner: priya._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 30),
      tenantId,
      createdAt: new Date(2026, 8, 15),
    },
    {
      title: 'Wipro - Enterprise Microservices Hub',
      stage: 'proposal',
      amount: 5500000,
      owner: priya._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 11, 5),
      tenantId,
      createdAt: new Date(2026, 8, 20),
    },
    {
      title: 'Reliance Retail - Hyperlocal POS Sync',
      stage: 'negotiation',
      amount: 12500000,
      owner: priya._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 22),
      tenantId,
      createdAt: new Date(2026, 7, 10),
    },
    {
      title: 'Swiggy - Delivery Logistics Engine',
      stage: 'lost',
      amount: 1500000,
      owner: priya._id,
      account: accId,
      closedAt: oct12,
      expectedClose: oct12,
      tenantId,
      createdAt: new Date(2026, 8, 25),
    },
  ]);

  // 3. Ensure Rohan's deals (Sales)
  await Deal.deleteMany({ owner: rohan._id });
  await Deal.insertMany([
    {
      title: 'Razorpay - Developer Operations Portal',
      stage: 'won',
      amount: 3500000,
      owner: rohan._id,
      account: accId,
      closedAt: oct10,
      expectedClose: oct10,
      tenantId,
      createdAt: new Date(2026, 8, 1),
    },
    {
      title: 'PhonePe - UPI Switch Orchestration',
      stage: 'qualified',
      amount: 2800000,
      owner: rohan._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 18),
      tenantId,
      createdAt: new Date(2026, 9, 2),
    },
    {
      title: 'Paytm - Enterprise Payment Gateway',
      stage: 'proposal',
      amount: 3800000,
      owner: rohan._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 20),
      tenantId,
      createdAt: new Date(2026, 8, 15),
    },
    {
      title: 'Paytm - Soundbox Merchant Cloud',
      stage: 'negotiation',
      amount: 4200000,
      owner: rohan._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 26),
      tenantId,
      createdAt: new Date(2026, 8, 22),
    },
    {
      title: 'Ola - Fleet Telematics SDK',
      stage: 'lost',
      amount: 1800000,
      owner: rohan._id,
      account: accId,
      closedAt: oct12,
      expectedClose: oct12,
      tenantId,
      createdAt: new Date(2026, 8, 28),
    },
  ]);

  // 4. Ensure Ananya's deals (Sales)
  await Deal.deleteMany({ owner: ananya._id });
  await Deal.insertMany([
    {
      title: 'Zerodha - Wealth Advisory Workspace',
      stage: 'won',
      amount: 5500000,
      owner: ananya._id,
      account: accId,
      closedAt: oct8,
      expectedClose: oct8,
      tenantId,
      createdAt: new Date(2026, 7, 1),
    },
    {
      title: 'BrowserStack - Team License Expansion',
      stage: 'qualified',
      amount: 2100000,
      owner: ananya._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 19),
      tenantId,
      createdAt: new Date(2026, 8, 10),
    },
    {
      title: 'Zerodha - Compliance Automation Suite',
      stage: 'proposal',
      amount: 7200000,
      owner: ananya._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 24),
      tenantId,
      createdAt: new Date(2026, 8, 14),
    },
    {
      title: 'Zerodha - Algorithmic Gateway',
      stage: 'negotiation',
      amount: 5000000,
      owner: ananya._id,
      account: accId,
      closedAt: null,
      expectedClose: new Date(2026, 10, 29),
      tenantId,
      createdAt: new Date(2026, 8, 19),
    },
    {
      title: 'Lenskart - Omni POS Integration',
      stage: 'lost',
      amount: 1450000,
      owner: ananya._id,
      account: accId,
      closedAt: oct12,
      expectedClose: oct12,
      tenantId,
      createdAt: new Date(2026, 8, 24),
    },
  ]);

  // 5. Contacts for all users
  await Contact.deleteMany({});
  const contactsList = [
    { firstName: 'Natarajan', lastName: 'Chandrasekaran', email: 'chandra@tata.com', phone: '+91 98200 11223', owner: aarav._id },
    { firstName: 'Deepinder', lastName: 'Goyal', email: 'deepinder@zomato.com', phone: '+91 98111 22334', owner: aarav._id },
    { firstName: 'Harshil', lastName: 'Mathur', email: 'harshil@razorpay.com', phone: '+91 98222 33445', owner: aarav._id },
    { firstName: 'Girish', lastName: 'Mathrubootham', email: 'girish@freshworks.com', phone: '+91 98333 44556', owner: aarav._id },
    
    { firstName: 'Sahil', lastName: 'Barua', email: 'sahil@delhivery.com', phone: '+91 98444 55667', owner: priya._id },
    { firstName: 'Salil', lastName: 'Parekh', email: 'salil@infosys.com', phone: '+91 98555 66778', owner: priya._id },
    { firstName: 'Isha', lastName: 'Ambani', email: 'isha@reliance.com', phone: '+91 98666 77889', owner: priya._id },
    { firstName: 'Sriharsha', lastName: 'Majety', email: 'harsha@swiggy.com', phone: '+91 98777 88990', owner: priya._id },

    { firstName: 'Vijay Shekhar', lastName: 'Sharma', email: 'vss@paytm.com', phone: '+91 98888 99001', owner: rohan._id },
    { firstName: 'Sameer', lastName: 'Nigam', email: 'sameer@phonepe.com', phone: '+91 98999 00112', owner: rohan._id },
    { firstName: 'Shashank', lastName: 'Kumar', email: 'shashank@razorpay.com', phone: '+91 98101 11223', owner: rohan._id },
    { firstName: 'Bhavish', lastName: 'Aggarwal', email: 'bhavish@ola.com', phone: '+91 98212 22334', owner: rohan._id },

    { firstName: 'Nithin', lastName: 'Kamath', email: 'nithin@zerodha.com', phone: '+91 98323 33445', owner: ananya._id },
    { firstName: 'Nikhil', lastName: 'Kamath', email: 'nikhil@zerodha.com', phone: '+91 98434 44556', owner: ananya._id },
    { firstName: 'Ritesh', lastName: 'Arora', email: 'ritesh@browserstack.com', phone: '+91 98545 55667', owner: ananya._id },
    { firstName: 'Peyush', lastName: 'Bansal', email: 'peyush@lenskart.com', phone: '+91 98656 66778', owner: ananya._id },
  ];
  await Contact.insertMany(contactsList.map(c => ({ ...c, tenantId, createdAt: new Date() })));

  // 6. Tasks for all users
  await Task.deleteMany({});
  const loyaltyDeal = aaravDeals.find(d => d.title.includes('Loyalty'));
  const freshworksDeal = aaravDeals.find(d => d.title.includes('Freshworks'));
  const zomatoDeal = aaravDeals.find(d => d.title.includes('Zomato'));

  await Task.insertMany([
    {
      title: 'Security questionnaire follow-up with Tata CISO',
      description: 'Review SOC2 and ISO compliance checks with Tata Digital security lead.',
      dueDate: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Today in 2h
      status: 'open',
      priority: 'high',
      type: 'call',
      deal: loyaltyDeal?._id,
      owner: aarav._id,
      tenantId,
    },
    {
      title: 'Finalize partner terms with Freshworks',
      description: 'Sign off on reseller commission schedule and enterprise SLA.',
      dueDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      status: 'done',
      priority: 'medium',
      type: 'meeting',
      deal: freshworksDeal?._id,
      owner: aarav._id,
      tenantId,
    },
    {
      title: 'Send customized quotation to Zomato procurement',
      description: 'Send revised commercial terms with tier-based discount.',
      dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      status: 'open',
      priority: 'high',
      type: 'email',
      deal: zomatoDeal?._id,
      owner: aarav._id,
      tenantId,
    },
    {
      title: 'Contract review with Reliance legal counsel',
      description: 'Review MSA liability and uptime SLA clauses for Hyperlocal POS contract.',
      dueDate: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      status: 'open',
      priority: 'high',
      type: 'todo',
      owner: priya._id,
      tenantId,
    },
    {
      title: 'Present executive demo for Razorpay Merchant Team',
      description: 'Walk through dispute webhook automation with Razorpay tech team.',
      dueDate: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      status: 'open',
      priority: 'high',
      type: 'meeting',
      owner: rohan._id,
      tenantId,
    },
    {
      title: 'Prepare onboarding roadmap for BrowserStack',
      description: 'Deliver rollout milestones and staging environment provisioning.',
      dueDate: new Date(now.getTime() + 5 * 60 * 60 * 1000),
      status: 'open',
      priority: 'medium',
      type: 'todo',
      owner: ananya._id,
      tenantId,
    },
  ]);

  console.log('Successfully seeded clean, balanced distribution for all users!');
  process.exit(0);
}

seedCleanDistribution().catch(e => {
  console.error(e);
  process.exit(1);
});
