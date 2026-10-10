import {
  rupeesToPaise,
  paiseToRupees,
  calculateLineItem,
  calculateDocumentTotals,
  numberToIndianWords,
} from './moneyHelper.js';

function runMoneyTests() {
  console.log('--- Testing Money & Tax Calculations ---');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Conversion tests
  assert(rupeesToPaise(100) === 10000, 'rupeesToPaise(100) = 10000 paise');
  assert(rupeesToPaise(12.34) === 1234, 'rupeesToPaise(12.34) = 1234 paise');
  assert(rupeesToPaise(12.345) === 1235, 'rupeesToPaise(12.345) rounds to 1235 paise');
  assert(paiseToRupees(10000) === 100, 'paiseToRupees(10000) = 100 rupees');
  assert(paiseToRupees(1234) === 12.34, 'paiseToRupees(1234) = 12.34 rupees');

  // 2. Line item calculation tests
  // 2 items @ ₹500 (50000 paise), 10% discount, 18% tax
  // rawAmount = 2 * 50000 = 100000 paise
  // discount = 100000 * 10% = 10000 paise
  // taxableAmount = 90000 paise
  // taxAmount = 90000 * 18% = 16200 paise
  // lineTotal = 90000 + 16200 = 106200 paise (₹1,062)
  const line1 = calculateLineItem({
    name: 'Consulting Hour',
    qty: 2,
    unitPrice: 50000,
    discountPct: 10,
    taxRate: 18,
  });
  assert(line1.rawAmount === 100000, 'Line rawAmount = 100000 paise');
  assert(line1.discountAmount === 10000, 'Line discountAmount = 10000 paise');
  assert(line1.taxableAmount === 90000, 'Line taxableAmount = 90000 paise');
  assert(line1.taxAmount === 16200, 'Line taxAmount = 16200 paise');
  assert(line1.lineTotal === 106200, 'Line lineTotal = 106200 paise');

  // Rounding half up test: 1 item @ ₹10.55 (1055 paise), 3% discount
  // rawAmount = 1055. discount = 1055 * 0.03 = 31.65 -> 32 paise
  // taxable = 1023. tax = 1023 * 0.18 = 184.14 -> 184 paise
  // lineTotal = 1207 paise
  const line2 = calculateLineItem({
    name: 'Small Part',
    qty: 1,
    unitPrice: 1055,
    discountPct: 3,
    taxRate: 18,
  });
  assert(line2.discountAmount === 32, 'Line discount rounds half up (31.65 -> 32)');
  assert(line2.taxAmount === 184, 'Line tax rounds half up (184.14 -> 184)');
  assert(line2.lineTotal === 1207, 'Line total matches exact sum');

  // 3. Document totals & Tax Split (intra vs inter)
  const docIntra = calculateDocumentTotals([line1], 'intra');
  assert(docIntra.subtotal === 100000, 'Doc subtotal matches');
  assert(docIntra.discountTotal === 10000, 'Doc discountTotal matches');
  assert(docIntra.taxTotal === 16200, 'Doc taxTotal matches');
  assert(docIntra.cgstTotal === 8100, 'Intra tax splits 50% to CGST (8100)');
  assert(docIntra.sgstTotal === 8100, 'Intra tax splits 50% to SGST (8100)');
  assert(docIntra.igstTotal === 0, 'Intra tax has 0 IGST');
  assert(docIntra.total === 106200, 'Doc total matches');
  assert(!docIntra.requiresApproval, '10% discount under 15% and ₹1,062 under ₹10L requires no approval');

  const docInter = calculateDocumentTotals([line1], 'inter');
  assert(docInter.cgstTotal === 0, 'Inter tax has 0 CGST');
  assert(docInter.sgstTotal === 0, 'Inter tax has 0 SGST');
  assert(docInter.igstTotal === 16200, 'Inter tax puts 100% into IGST (16200)');

  // 4. Approval Rule tests:
  // a) discount > 15%
  const highDiscountItem = calculateDocumentTotals([
    {
      name: 'Discounted Deal',
      qty: 1,
      unitPrice: 100000,
      discountPct: 20, // > 15%
      taxRate: 18,
    },
  ]);
  assert(highDiscountItem.requiresApproval, 'Item with 20% discount triggers requiresApproval');
  assert(
    highDiscountItem.approvalReasons[0].includes('discount (20%) exceeds 15%'),
    'Approval reason explicitly states discount excess'
  );

  // b) total > ₹10,00,000 (100,000,000 paise)
  const bigTotalItem = calculateDocumentTotals([
    {
      name: 'Enterprise Cloud License',
      qty: 1,
      unitPrice: 120_000_000, // ₹12,00,000 in paise
      discountPct: 5,
      taxRate: 18,
    },
  ]);
  assert(bigTotalItem.requiresApproval, 'Total above ₹10L triggers requiresApproval');
  assert(
    bigTotalItem.approvalReasons.some((r) => r.includes('exceeds ₹10,00,000 threshold')),
    'Approval reason states ₹10,00,000 threshold exceeded'
  );

  // 5. Indian Number to Words conversion tests
  assert(numberToIndianWords(0) === 'Rupees Zero Only', '0 paise -> "Rupees Zero Only"');
  assert(
    numberToIndianWords(10000) === 'Rupees One Hundred Only',
    '10000 paise (₹100) -> "Rupees One Hundred Only"'
  );
  assert(
    numberToIndianWords(105000000) === 'Rupees Ten Lakh Fifty Thousand Only',
    '105000000 paise (₹10,50,000) -> "Rupees Ten Lakh Fifty Thousand Only"'
  );
  assert(
    numberToIndianWords(4512350) ===
      'Rupees Forty-Five Thousand One Hundred Twenty-Three and Fifty Paise Only',
    '4512350 paise (₹45,123.50) -> "Rupees Forty-Five Thousand One Hundred Twenty-Three and Fifty Paise Only"'
  );
  assert(
    numberToIndianWords(1250000000) === 'Rupees One Crore Twenty-Five Lakh Only',
    '1250000000 paise (₹1.25 Crore) -> "Rupees One Crore Twenty-Five Lakh Only"'
  );

  console.log(`\nMoney Helper Test Results: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

runMoneyTests();
