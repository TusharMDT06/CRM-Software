import fs from 'fs';
import path from 'path';

async function verifyChangeRequests() {
  console.log('====================================================');
  console.log('   FLOWDESK CHANGE REQUESTS VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const serverRoot = path.resolve(__dirname, '..');
  const clientRoot = path.resolve(__dirname, '../../client');

  // ----------------------------------------------------
  // CHANGE 1: RESEND EMAIL INTEGRATION
  // ----------------------------------------------------
  console.log('--- Change 1: Resend Email Migration Verification ---');

  // 1. Check server package.json
  const serverPkg = JSON.parse(fs.readFileSync(path.join(serverRoot, 'package.json'), 'utf-8'));
  assert(Boolean(serverPkg.dependencies?.resend), 'Server package.json includes "resend"');
  assert(!serverPkg.dependencies?.nodemailer, 'Server package.json does NOT contain "nodemailer"');

  // 2. Check client package.json
  const clientPkg = JSON.parse(fs.readFileSync(path.join(clientRoot, 'package.json'), 'utf-8'));
  assert(!clientPkg.dependencies?.resend && !clientPkg.devDependencies?.resend, '"resend" is installed on server only, not client');
  assert(!clientPkg.dependencies?.nodemailer, '"nodemailer" is not in client');

  // 3. Check .env.example files
  const serverEnvExample = fs.readFileSync(path.join(serverRoot, '.env.example'), 'utf-8');
  assert(serverEnvExample.includes('RESEND_API_KEY') && serverEnvExample.includes('EMAIL_FROM'), 'server/.env.example defines RESEND_API_KEY and EMAIL_FROM');
  assert(!serverEnvExample.includes('SMTP_'), 'server/.env.example contains no SMTP_* variables');

  // 4. Check Activity model for messageId
  const activityModelSrc = fs.readFileSync(path.join(serverRoot, 'src/models/Activity.ts'), 'utf-8');
  assert(activityModelSrc.includes('messageId'), 'Activity model includes messageId field for Resend id');

  // 5. Test Live /api/emails/config endpoint
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@crm.test',
        password: 'Password@123',
      }),
    });
    const loginData = (await loginRes.json()) as any;
    const token = loginData.token;
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const configRes = await fetch('http://localhost:5000/api/emails/config', { headers: authHeaders });
    const configData = (await configRes.json()) as any;
    assert(configRes.status === 200, 'GET /emails/config returns 200 OK');
    assert('isConfigured' in configData, 'GET /emails/config returns isConfigured property');
    assert('isTestDomain' in configData, 'GET /emails/config returns isTestDomain property');

    // 6. Test POST /emails/send fallback behavior
    const leadsRes = await fetch('http://localhost:5000/api/leads', { headers: authHeaders });
    const leadsData = (await leadsRes.json()) as any;
    const leadId = leadsData.data[0]._id;

    const sendRes = await fetch('http://localhost:5000/api/emails/send', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        to: 'customer@example.com',
        subject: 'Meeting follow up {{lead.name}}',
        body: 'Hi {{lead.name}}, thanks for connecting with {{owner.name}}.',
        entityType: 'lead',
        entityId: leadId,
      }),
    });
    const sendData = (await sendRes.json()) as any;

    assert(
      sendRes.status === 503,
      'POST /emails/send returns 503 fallback when RESEND_API_KEY is not configured'
    );
    assert(
      Boolean(sendData.mailtoUrl),
      '503 fallback includes preformatted mailtoUrl with resolved tokens'
    );
    assert(
      Boolean(sendData.resolvedSubject),
      '503 fallback includes resolvedSubject'
    );
  } catch (err: any) {
    console.error('API test error:', err.message);
  }

  // ----------------------------------------------------
  // CHANGE 2: MOTION & ANIMATION SYSTEM
  // ----------------------------------------------------
  console.log('\n--- Change 2: Motion System Verification ---');

  // 1. Check motion library in client package.json
  assert(Boolean(clientPkg.dependencies?.motion), 'Client package.json includes "motion"');

  // 2. Check motion.ts tokens file
  const motionTsPath = path.join(clientRoot, 'src/lib/motion.ts');
  assert(fs.existsSync(motionTsPath), 'client/src/lib/motion.ts exists');
  const motionTsContent = fs.readFileSync(motionTsPath, 'utf-8');
  assert(motionTsContent.includes("from 'motion/react'"), 'motion.ts imports from "motion/react"');
  assert(motionTsContent.includes('section: 0.06'), 'motion.ts configures 60ms section stagger');
  assert(motionTsContent.includes('section: 0.3'), 'motion.ts configures 300ms section duration');
  assert(motionTsContent.includes('easeOut: [0.16, 1, 0.3, 1]'), 'motion.ts configures easeOut tuple easing');

  // 3. Check reusable motion components
  const pageTransitionPath = path.join(clientRoot, 'src/components/motion/PageTransition.tsx');
  const revealPath = path.join(clientRoot, 'src/components/motion/Reveal.tsx');
  const staggerPath = path.join(clientRoot, 'src/components/motion/Stagger.tsx');
  const countUpPath = path.join(clientRoot, 'src/components/motion/CountUp.tsx');
  const meterPath = path.join(clientRoot, 'src/components/motion/AnimatedMeter.tsx');
  assert(fs.existsSync(pageTransitionPath), '<PageTransition> component exists');
  assert(fs.existsSync(revealPath), '<Reveal> component exists with ready & skeleton support');
  assert(fs.existsSync(staggerPath), '<Stagger> component exists');
  assert(fs.existsSync(countUpPath), '<CountUp> component exists with rAF easeOutCubic');
  assert(fs.existsSync(meterPath), '<AnimatedMeter> component exists with 12ms per bar stagger');

  // 4. Check App.tsx MotionConfig
  const appTsx = fs.readFileSync(path.join(clientRoot, 'src/App.tsx'), 'utf-8');
  assert(appTsx.includes('<MotionConfig reducedMotion="user">'), 'App.tsx wraps app in <MotionConfig reducedMotion="user">');

  // 5. Check Button.tsx whileTap
  const buttonTsx = fs.readFileSync(path.join(clientRoot, 'src/components/ui/Button.tsx'), 'utf-8');
  assert(buttonTsx.includes('whileTap={disabled || isLoading ? undefined : { scale: 0.98 }}'), 'Button.tsx scales to 0.98 on tap');

  // 6. Check Sidebar.tsx layoutId
  const sidebarTsx = fs.readFileSync(path.join(clientRoot, 'src/components/layout/Sidebar.tsx'), 'utf-8');
  assert(sidebarTsx.includes('layoutId="sidebar-active-pill"'), 'Sidebar.tsx active pill uses layoutId="sidebar-active-pill"');

  // 7. Check DataTable.tsx table row stagger
  const dataTableTsx = fs.readFileSync(path.join(clientRoot, 'src/components/common/DataTable.tsx'), 'utf-8');
  assert(dataTableTsx.includes('isFirstTen') && dataTableTsx.includes('index * 0.03'), 'DataTable.tsx staggers first 10 rows by 30ms');
  assert(dataTableTsx.includes('duration: 0.12'), 'DataTable.tsx does fast 120ms fade on pagination/sorting');

  // 8. Check DealsPage.tsx Kanban animations
  const dealsPageTsx = fs.readFileSync(path.join(clientRoot, 'src/pages/DealsPage.tsx'), 'utf-8');
  assert(dealsPageTsx.includes('colIndex * 0.06'), 'DealsPage.tsx staggers columns by 60ms left-to-right');
  assert(dealsPageTsx.includes('cardIndex < 8'), 'DealsPage.tsx caps card rising stagger at 8 cards per column');
  assert(dealsPageTsx.includes('layout={!isDragging && !reducedMotion}'), 'DealsPage.tsx animates moved card into new column with layout');

  // 9. Check DashboardPage.tsx
  const dashboardTsx = fs.readFileSync(path.join(clientRoot, 'src/pages/DashboardPage.tsx'), 'utf-8');
  assert(dashboardTsx.includes('<CountUp'), 'DashboardPage.tsx animates KPI numbers with <CountUp>');
  assert(dashboardTsx.includes('formatCompactINR'), 'DashboardPage.tsx formats CountUp numbers using compact INR format (₹)');
  assert(dashboardTsx.includes('animationDuration={900}'), 'DashboardPage.tsx configures Area chart animation for 900ms');

  // 10. Check ComposeEmailModal test banner
  const composeModalTsx = fs.readFileSync(path.join(clientRoot, 'src/components/email/ComposeEmailModal.tsx'), 'utf-8');
  assert(composeModalTsx.includes('Test mode: emails can only be delivered to your own Resend account email until you verify a domain.'), 'ComposeEmailModal displays Resend test mode domain banner');

  // 11. Check Drawer and Modal animations
  const drawerTsx = fs.readFileSync(path.join(clientRoot, 'src/components/ui/Drawer.tsx'), 'utf-8');
  const modalTsx = fs.readFileSync(path.join(clientRoot, 'src/components/ui/Modal.tsx'), 'utf-8');
  assert(drawerTsx.includes('variants={drawerVariants}'), 'Drawer.tsx slides in from right using drawerVariants');
  assert(modalTsx.includes('variants={modalVariants}'), 'Modal.tsx scales 0.98->1 and fades using modalVariants');

  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyChangeRequests();
