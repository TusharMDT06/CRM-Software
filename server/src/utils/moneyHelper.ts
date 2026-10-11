/**
 * Money and Tax Calculation Utilities for Flowdesk CRM
 * 
 * MONEY RULE: Every monetary value is stored as integer paise on the server.
 * Convert to rupees only for display and input.
 * All totals are computed on the server, never trusted from client.
 * Round half up at line level, then sum.
 */

export const APPROVAL_LIMITS = {
  MAX_DISCOUNT_PERCENT: 15,
  MAX_TOTAL_PAISE: 100_000_000, // ₹10,00,000 = 1 crore paise
};

export interface RawLineItem {
  product?: any;
  name: string;
  description?: string;
  qty: number;
  unitPrice: number; // in paise
  discountPct?: number; // 0 - 100
  taxRate?: number; // e.g. 18 for 18%
}

export interface ComputedLineItem extends RawLineItem {
  rawAmount: number; // qty * unitPrice (paise)
  discountAmount: number; // discount in paise
  taxableAmount: number; // rawAmount - discountAmount (paise)
  taxAmount: number; // tax in paise
  lineTotal: number; // taxableAmount + taxAmount (paise)
}

export interface DocumentTotals {
  items: ComputedLineItem[];
  lineDetails: ComputedLineItem[];
  subtotal: number; // sum of rawAmount (paise)
  discountTotal: number; // sum of discountAmount (paise)
  taxableTotal: number; // sum of taxableAmount (paise)
  taxTotal: number; // sum of taxAmount (paise)
  cgstTotal: number; // half tax if intra (paise)
  sgstTotal: number; // half tax if intra (paise)
  igstTotal: number; // full tax if inter (paise)
  total: number; // subtotal - discountTotal + taxTotal (paise)
  requiresApproval: boolean;
  approvalReasons: string[];
}

/**
 * Convert Rupees to Integer Paise (round half up)
 */
export function rupeesToPaise(rupees: number): number {
  if (isNaN(rupees) || !isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/**
 * Convert Integer Paise to Rupees
 */
export function paiseToRupees(paise: number): number {
  if (isNaN(paise) || !isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

/**
 * Computes single line item financials (integer paise, round half up)
 */
export function calculateLineItem(item: RawLineItem): ComputedLineItem {
  const qty = Math.max(1, Math.round(item.qty || 1));
  const unitPrice = Math.max(0, Math.round(item.unitPrice || 0));
  const discountPct = Math.min(100, Math.max(0, Number(item.discountPct) || 0));
  const taxRate = Math.max(0, Number(item.taxRate ?? 18));

  const rawAmount = qty * unitPrice;
  // Round half up for discount
  const discountAmount = Math.round((rawAmount * discountPct) / 100);
  const taxableAmount = Math.max(0, rawAmount - discountAmount);
  // Round half up for tax
  const taxAmount = Math.round((taxableAmount * taxRate) / 100);
  const lineTotal = taxableAmount + taxAmount;

  return {
    ...item,
    qty,
    unitPrice,
    discountPct,
    taxRate,
    rawAmount,
    discountAmount,
    taxableAmount,
    taxAmount,
    lineTotal,
  };
}

/**
 * Computes complete document totals and checks approval rules
 */
export function calculateDocumentTotals(
  rawItems: RawLineItem[],
  taxMode: 'intra' | 'inter' = 'intra'
): DocumentTotals {
  const items = (rawItems || []).map(calculateLineItem);

  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let taxTotal = 0;
  const approvalReasons: string[] = [];

  for (const it of items) {
    subtotal += it.rawAmount;
    discountTotal += it.discountAmount;
    taxableTotal += it.taxableAmount;
    taxTotal += it.taxAmount;

    if ((it.discountPct ?? 0) > APPROVAL_LIMITS.MAX_DISCOUNT_PERCENT) {
      const reason = `Line item "${it.name}" discount (${it.discountPct}%) exceeds ${APPROVAL_LIMITS.MAX_DISCOUNT_PERCENT}%`;
      if (!approvalReasons.includes(reason)) {
        approvalReasons.push(reason);
      }
    }
  }

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  if (taxMode === 'intra') {
    // Split into CGST and SGST equally
    cgstTotal = Math.round(taxTotal / 2);
    sgstTotal = taxTotal - cgstTotal;
    igstTotal = 0;
  } else {
    // Inter-state uses IGST
    igstTotal = taxTotal;
    cgstTotal = 0;
    sgstTotal = 0;
  }

  const total = subtotal - discountTotal + taxTotal;

  if (total > APPROVAL_LIMITS.MAX_TOTAL_PAISE) {
    approvalReasons.push(
      `Document total (₹${(total / 100).toLocaleString('en-IN')}) exceeds ₹10,00,000 threshold`
    );
  }

  return {
    items,
    lineDetails: items,
    subtotal,
    discountTotal,
    taxableTotal,
    taxTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    total,
    requiresApproval: approvalReasons.length > 0,
    approvalReasons,
  };
}

// Helper words dictionary for Indian numbering system
const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ONES[n % 10] : '');
  } else if (n > 0) {
    str += ONES[n];
  }
  return str.trim();
}

/**
 * Converts monetary amount in paise to Indian words format.
 * E.g. 105000000 paise (₹10,50,000) -> "Rupees Ten Lakh Fifty Thousand Only"
 */
export function numberToIndianWords(paiseAmount: number): string {
  if (isNaN(paiseAmount) || !isFinite(paiseAmount) || paiseAmount === 0) {
    return 'Rupees Zero Only';
  }

  const isNegative = paiseAmount < 0;
  const absPaise = Math.abs(Math.round(paiseAmount));
  const rupees = Math.floor(absPaise / 100);
  const paise = absPaise % 100;

  if (rupees === 0 && paise === 0) {
    return 'Rupees Zero Only';
  }

  let words = '';

  if (rupees > 0) {
    let rem = rupees;

    const crore = Math.floor(rem / 10_000_000);
    rem %= 10_000_000;

    const lakh = Math.floor(rem / 100_000);
    rem %= 100_000;

    const thousand = Math.floor(rem / 1_000);
    rem %= 1_000;

    const hundred = rem;

    const parts: string[] = [];

    if (crore > 0) {
      parts.push(convertBelowThousand(crore) + ' Crore');
    }
    if (lakh > 0) {
      parts.push(convertBelowThousand(lakh) + ' Lakh');
    }
    if (thousand > 0) {
      parts.push(convertBelowThousand(thousand) + ' Thousand');
    }
    if (hundred > 0) {
      parts.push(convertBelowThousand(hundred));
    }

    words = parts.join(' ');
  }

  let result = (isNegative ? 'Negative ' : '') + 'Rupees ' + (words || 'Zero');

  if (paise > 0) {
    result += ' and ' + convertBelowThousand(paise) + ' Paise';
  }

  return (result + ' Only').replace(/\s+/g, ' ');
}
