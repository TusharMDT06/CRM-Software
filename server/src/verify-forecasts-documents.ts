import assert from 'assert';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { DocumentModel } from './models/Document.js';
import { Deal } from './models/Deal.js';

import { runWithTenantContext } from './utils/tenantContext.js';

dotenv.config();

async function runVerification() {
  console.log('[Verify] Starting Forecasts and Documents verification...');
  await connectDB();

  await runWithTenantContext({ isBypassTenant: true }, async () => {
    // 1. Verify Sample Documents seeded in database
    const count = await DocumentModel.countDocuments();
  console.log(`[Verify] Total documents in MongoDB: ${count}`);
  assert(count >= 7, 'Expected at least 7 seeded sample documents in database');

  // 2. Verify Folders & Metadata
  const folders = await DocumentModel.distinct('folder');
  console.log(`[Verify] Folders found:`, folders);
  assert(folders.includes('Contracts & NDAs'), 'Expected Contracts & NDAs folder');
  assert(folders.includes('Pitch Decks & Presentations'), 'Expected Pitch Decks folder');
  assert(folders.includes('Proposals & Quotes'), 'Expected Proposals folder');

  // 3. Test Create Document with CRM Link
  const admin = await User.findOne({ email: 'admin@crm.test' });
  assert(admin, 'Admin user should exist');

  const sampleDeal = await Deal.findOne({ stage: 'negotiation' });

  const testDoc = await DocumentModel.create({
    name: 'Verification_Test_Contract_v1.0.pdf',
    folder: 'Contracts & NDAs',
    fileType: 'pdf',
    fileSize: 1048576,
    version: '1.0',
    status: 'draft',
    tags: ['Test', 'Automated'],
    description: 'Automated verification test file',
    relatedTo: sampleDeal
      ? {
          entityType: 'deal',
          entityId: sampleDeal._id,
          entityName: sampleDeal.title,
        }
      : { entityType: 'none' },
    uploadedBy: admin._id,
    tenantId: admin.tenantId,
    downloadCount: 0,
    isStarred: true,
  });

  assert(testDoc._id, 'Document should be created with an ID');
  console.log(`[Verify] Successfully created document ID: ${testDoc._id}`);

  // 4. Test Star toggle & Download count update
  testDoc.downloadCount += 1;
  testDoc.isStarred = false;
  await testDoc.save();

  const fetched = await DocumentModel.findById(testDoc._id);
  assert(fetched?.downloadCount === 1, 'Download count should be 1');
  assert(fetched?.isStarred === false, 'isStarred should be false');
  console.log('[Verify] Download count and star toggle verified successfully');

  // 5. Test Clean up
  await DocumentModel.findByIdAndDelete(testDoc._id);
  const deletedCheck = await DocumentModel.findById(testDoc._id);
  assert(!deletedCheck, 'Document should be deleted');
  console.log('[Verify] Document deletion verified successfully');

  // 6. Verify Forecasts Calculation Logic
  const allDeals = await Deal.find();
  console.log(`[Verify] Total Deals in database: ${allDeals.length}`);

  const wonDeals = await Deal.find({ stage: 'won' });
  const openDeals = await Deal.find({ stage: { $in: ['qualified', 'proposal', 'negotiation'] } });

  console.log(`[Verify] Won Deals: ${wonDeals.length}, Open Pipeline Deals: ${openDeals.length}`);
  assert(openDeals.length > 0, 'Should have open pipeline deals for forecast');

  let totalWon = 0;
  for (const d of wonDeals) totalWon += d.amount || 0;

  let totalPipeline = 0;
  let weightedPipeline = 0;
  const probs: Record<string, number> = { qualified: 0.2, proposal: 0.6, negotiation: 0.8 };

  for (const d of openDeals) {
    totalPipeline += d.amount || 0;
    weightedPipeline += Math.round((d.amount || 0) * (probs[d.stage] || 0.2));
  }

  console.log(`[Verify] Total Closed Won: ₹${totalWon.toLocaleString('en-IN')}`);
  console.log(`[Verify] Gross Open Pipeline: ₹${totalPipeline.toLocaleString('en-IN')}`);
  console.log(`[Verify] Weighted Forecast: ₹${weightedPipeline.toLocaleString('en-IN')}`);

  assert(totalPipeline > 0, 'Total pipeline should be positive');
  assert(weightedPipeline > 0, 'Weighted pipeline should be positive');
  assert(weightedPipeline <= totalPipeline, 'Weighted forecast should not exceed gross pipeline');

  console.log('\n======================================================');
  console.log('✅ ALL FORECASTS AND DOCUMENTS VERIFICATION TESTS PASSED!');
  console.log('======================================================\n');
  });

  await mongoose.disconnect();
}

runVerification().catch((err) => {
  console.error('[Verify] Verification failed:', err);
  process.exit(1);
});
