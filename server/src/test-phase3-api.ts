import assert from 'node:assert';

const API = 'http://localhost:5000/api';

async function request(url: string, options: any = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('application/pdf')) {
    data = await res.arrayBuffer();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const error: any = new Error(data?.message || `HTTP ${res.status}: ${res.statusText}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return { status: res.status, headers: res.headers, data };
}

async function runPhase3Tests() {
  console.log('Starting Flowdesk Phase 3 End-to-End API Verification (native fetch)...\n');

  // 1. Authenticate as Admin, Manager, and Sales
  console.log('1. Authenticating roles...');
  const adminRes = await request(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'admin@crm.test', password: 'Password@123' },
  });
  const adminToken = adminRes.data.token;

  const managerRes = await request(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'manager@crm.test', password: 'Password@123' },
  });
  const managerToken = managerRes.data.token;

  const salesRes = await request(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'sales@crm.test', password: 'Password@123' },
  });
  const salesToken = salesRes.data.token;
  console.log('   ✓ Logged in as Admin, Manager, Sales');

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const managerHeaders = { Authorization: `Bearer ${managerToken}` };
  const salesHeaders = { Authorization: `Bearer ${salesToken}` };

  // 2. Company Settings
  console.log('\n2. Testing Company Settings...');
  const settingsRes = await request(`${API}/settings/company`, { headers: salesHeaders });
  assert(settingsRes.data.legalName !== undefined, 'Legal name should exist');
  console.log(`   ✓ Retrieved settings: "${settingsRes.data.legalName || 'Flowdesk CRM'}" (readable by sales)`);

  const updatedSettings = await request(`${API}/settings/company`, {
    method: 'PUT',
    headers: adminHeaders,
    body: {
      legalName: 'Flowdesk Technologies India Pvt Ltd',
      address: 'Suite 401, Tech Park, Outer Ring Road, Bengaluru',
      state: 'Karnataka',
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      bankDetails: {
        accountName: 'Flowdesk Technologies',
        accountNumber: '9180200192837',
        ifsc: 'HDFC0001234',
        bankName: 'HDFC Bank Ltd',
      },
      defaultPaymentTermsDays: 15,
      defaultQuoteValidityDays: 30,
      quotePrefix: 'QT',
      invoicePrefix: 'INV',
    },
  });
  assert.strictEqual(updatedSettings.data.legalName, 'Flowdesk Technologies India Pvt Ltd');
  console.log('   ✓ Admin updated company legal & bank details successfully');

  // 3. Products
  console.log('\n3. Testing Products Catalog...');
  const testSku = `SKU-P3-${Date.now()}`;
  const prodRes = await request(`${API}/products`, {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'Flowdesk Enterprise License',
      sku: testSku,
      description: 'Annual enterprise subscription per seat',
      unitPrice: 2500000, // ₹25,000 in paise
      taxRate: 18,
      unit: 'nos',
      active: true,
    },
  });
  const testProduct = prodRes.data;
  assert.strictEqual(testProduct.sku, testSku);
  assert.strictEqual(testProduct.unitPrice, 2500000);
  console.log(`   ✓ Created product "${testProduct.name}" (paise: ${testProduct.unitPrice})`);

  // 4. Fetch Deal, Account, Contact for Quote
  console.log('\n4. Fetching Deal for Quote creation...');
  const dealsRes = await request(`${API}/deals`, { headers: adminHeaders });
  const deal = dealsRes.data.data?.[0];
  assert(deal, 'At least one deal should exist in seed data');
  const accountId = deal.account?._id || deal.account;
  const contactId = deal.contact?._id || deal.contact;

  // 5. Quote Creation with Approval Rule (>15% discount)
  console.log('\n5. Testing Quote Builder & Approval Rule...');
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const quoteCreateRes = await request(`${API}/quotes`, {
    method: 'POST',
    headers: salesHeaders,
    body: {
      deal: deal._id,
      account: accountId,
      contact: contactId,
      items: [
        {
          product: testProduct._id,
          name: testProduct.name,
          qty: 2,
          unitPrice: 2500000, // ₹25,000 each = ₹50,000 total
          discountPct: 20, // 20% discount -> EXCEEDS 15% threshold!
          taxRate: 18,
        },
      ],
      taxMode: 'intra',
      validUntil: validUntil.toISOString(),
      notes: 'Special Enterprise Promotional Discount',
      terms: 'Payment due on receipt.',
    },
  });
  const quote = quoteCreateRes.data;
  assert(quote.number.startsWith('QT-'), 'Number format QT-YYYY-XXXX');
  assert.strictEqual(quote.status, 'draft');
  assert.strictEqual(quote.subtotal, 5000000);
  assert.strictEqual(quote.discountTotal, 1000000);
  console.log(`   ✓ Created Draft Quote ${quote.number} (Subtotal: ₹${quote.subtotal / 100}, Discount: ₹${quote.discountTotal / 100})`);

  // Sales tries to send quote with 20% discount -> must turn into pending_approval!
  console.log('   Sending quote with 20% discount as sales user...');
  const sendAttemptRes = await request(`${API}/quotes/${quote._id}/send`, {
    method: 'POST',
    headers: salesHeaders,
    body: { subject: 'Quote for Flowdesk Enterprise' },
  });
  assert.strictEqual(sendAttemptRes.data.quote.status, 'pending_approval');
  console.log('   ✓ High discount quote correctly moved to pending_approval!');

  // Manager approves the quote
  console.log('   Approving quote as manager...');
  const approveRes = await request(`${API}/quotes/${quote._id}/approve`, {
    method: 'POST',
    headers: managerHeaders,
    body: { action: 'approve', reason: 'Approved by VP Sales for Q4 close' },
  });
  assert.strictEqual(approveRes.data.quote.approval.status, 'approved');
  console.log('   ✓ Manager approved quote successfully');

  // Verify PDF Generation
  console.log('\n6. Testing PDF Generation...');
  const pdfRes = await request(`${API}/quotes/${quote._id}/pdf`, {
    headers: salesHeaders,
  });
  assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
  assert(pdfRes.data.byteLength > 1000, 'PDF should have non-empty byte buffer');
  console.log(`   ✓ Generated server-side A4 PDF (${pdfRes.data.byteLength} bytes)`);

  // 7. Testing Public Quote Portal (/q/:publicToken)
  console.log('\n7. Testing Public Quote Portal (No Auth)...');
  const publicRes = await request(`${API}/quotes/public/${quote.publicToken}`);
  assert.strictEqual(publicRes.data.quote.number, quote.number);
  console.log(`   ✓ Public portal loaded quote ${quote.number} without auth`);

  // Client accepts quote on public portal
  const acceptRes = await request(`${API}/quotes/public/${quote.publicToken}/action`, {
    method: 'POST',
    body: { action: 'accept' },
  });
  assert.strictEqual(acceptRes.data.status, 'accepted');
  console.log('   ✓ Client accepted quote online');

  // 8. Convert Accepted Quote to Invoice
  console.log('\n8. Testing Invoice Generation from Quote...');
  const convertRes = await request(`${API}/quotes/${quote._id}/convert-to-invoice`, {
    method: 'POST',
    headers: salesHeaders,
  });
  const invoice = convertRes.data.invoice;
  assert(invoice.number.startsWith('INV-'), 'Number format INV-YYYY-XXXX');
  assert.strictEqual(invoice.status, 'draft');
  assert.strictEqual(invoice.balance, invoice.total);
  console.log(`   ✓ Converted to Invoice ${invoice.number} (Total: ₹${invoice.total / 100}, Balance: ₹${invoice.balance / 100})`);

  // 9. Payments & Partial Payment tracking
  console.log('\n9. Testing Payments & Balance updates...');
  // Send invoice
  await request(`${API}/invoices/${invoice._id}`, {
    method: 'PATCH',
    headers: salesHeaders,
    body: { status: 'sent' },
  });

  // Record 50% partial payment
  const halfAmount = Math.round(invoice.total / 2);
  const paymentRes = await request(`${API}/invoices/${invoice._id}/payments`, {
    method: 'POST',
    headers: salesHeaders,
    body: {
      amount: halfAmount,
      method: 'bank_transfer',
      reference: 'NEFT-REF-99281',
      notes: 'Initial advance 50%',
    },
  });
  const afterPaymentInv = paymentRes.data.invoice;
  assert.strictEqual(afterPaymentInv.status, 'partially_paid');
  assert.strictEqual(afterPaymentInv.paidTotal, halfAmount);
  assert.strictEqual(afterPaymentInv.balance, invoice.total - halfAmount);
  console.log(`   ✓ Recorded partial payment (Status: ${afterPaymentInv.status}, Paid: ₹${afterPaymentInv.paidTotal / 100}, Balance: ₹${afterPaymentInv.balance / 100})`);

  // 10. Notifications
  console.log('\n10. Testing Notifications API...');
  const notifRes = await request(`${API}/notifications`, { headers: salesHeaders });
  assert(Array.isArray(notifRes.data.data), 'Notifications list is array');
  const unreadCountRes = await request(`${API}/notifications/unread-count`, { headers: salesHeaders });
  assert(typeof unreadCountRes.data.unreadCount === 'number', 'Unread count is number');
  console.log(`   ✓ Notifications retrieved (Unread count: ${unreadCountRes.data.unreadCount})`);

  // Preferences
  const prefRes = await request(`${API}/notifications/preferences`, { headers: salesHeaders });
  assert(prefRes.data.preferences.quote_accepted !== undefined);
  console.log('   ✓ Notification preferences retrieved');

  // 11. Workflow Automations
  console.log('\n11. Testing Workflow Automations...');
  const workflowRes = await request(`${API}/automations`, {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'High Value Deal Alert',
      description: 'Alert manager when deal > ₹5L is created',
      enabled: true,
      trigger: { type: 'deal_created' },
      conditions: [
        { field: 'amount', operator: 'greater_than', value: 50000000 }, // > ₹5L
      ],
      actions: [
        {
          type: 'send_notification',
          config: {
            notificationRecipient: 'managers',
            notificationTitle: 'Big Deal Alert',
            notificationBody: 'A high-value deal has been created',
          },
        },
      ],
    },
  });
  const workflow = workflowRes.data;
  assert.strictEqual(workflow.name, 'High Value Deal Alert');
  console.log(`   ✓ Created workflow "${workflow.name}"`);

  // Dry-run test
  const testDryRun = await request(`${API}/automations/${workflow._id}/test`, {
    method: 'POST',
    headers: adminHeaders,
    body: { entityType: 'deal', entityId: deal._id },
  });
  assert(testDryRun.data.conditionResults !== undefined, 'Condition results returned');
  console.log(`   ✓ Tested workflow dry-run (Conditions matched: ${testDryRun.data.matched})`);

  // 12. Audit Log (Admin Only)
  console.log('\n12. Testing Audit Logs...');
  const auditRes = await request(`${API}/audit-log`, { headers: adminHeaders });
  assert(Array.isArray(auditRes.data.data), 'Audit logs data is array');
  assert(auditRes.data.data.length > 0, 'Audit entries must have been recorded');
  const recentLog = auditRes.data.data[0];
  console.log(`   ✓ Audit logs verified. Most recent action: "${recentLog.action}" on "${recentLog.entityType}" by "${recentLog.actorName}"`);

  console.log('\n======================================================');
  console.log('ALL PHASE 3 SERVER API & BUSINESS LOGIC TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase3Tests().catch((err) => {
  console.error('\n❌ Phase 3 API Verification Failed:', err.data || err.message);
  process.exit(1);
});
