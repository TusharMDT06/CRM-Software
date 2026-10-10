/**
 * Client-Side Money & Numbering Helpers for Flowdesk CRM
 * 
 * MONEY RULE: All amounts received from or sent to server are integer paise.
 * Converted to Rupees only for user display and input fields.
 */

export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round((rupees || 0) * 100);
}

export function formatINR(paise: number): string {
  const rs = (paise || 0) / 100;
  return `₹${rs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatINRCompact(paise: number): string {
  const rs = (paise || 0) / 100;
  if (rs >= 10000000) {
    return `₹${(rs / 10000000).toFixed(2)} Cr`;
  }
  if (rs >= 100000) {
    return `₹${(rs / 100000).toFixed(2)} L`;
  }
  if (rs >= 1000) {
    return `₹${(rs / 1000).toFixed(1)} k`;
  }
  return `₹${rs.toLocaleString('en-IN')}`;
}

export interface LiveLineItem {
  product?: string;
  name: string;
  description?: string;
  qty: number;
  unitPrice: number; // in paise
  discountPct: number; // percent
  taxRate: number; // percent
}

export interface LiveTotals {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  total: number;
  amountInWords: string;
}

export function computeLiveTotals(items: LiveLineItem[], taxMode: 'intra' | 'inter'): LiveTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let taxTotal = 0;

  for (const it of items) {
    const raw = Math.round((it.qty || 0) * (it.unitPrice || 0));
    const disc = Math.round((raw * (it.discountPct || 0)) / 100);
    const taxable = Math.max(0, raw - disc);
    const tax = Math.round((taxable * (it.taxRate || 0)) / 100);

    subtotal += raw;
    discountTotal += disc;
    taxableTotal += taxable;
    taxTotal += tax;
  }

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  if (taxMode === 'intra') {
    cgstTotal = Math.round(taxTotal / 2);
    sgstTotal = taxTotal - cgstTotal;
  } else {
    igstTotal = taxTotal;
  }

  const total = taxableTotal + taxTotal;
  const amountInWords = numberToIndianWords(total);

  return {
    subtotal,
    discountTotal,
    taxableTotal,
    taxTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    total,
    amountInWords,
  };
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertLessThanThousand(n: number): string {
  let result = '';
  if (n >= 100) {
    result += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    result += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    result += ONES[n] + ' ';
  }
  return result.trim();
}

export function numberToIndianWords(paise: number): string {
  if (!paise || paise <= 0) return 'Zero Rupees Only';

  const rupees = Math.floor(paise / 100);
  const remainingPaise = Math.round(paise % 100);

  if (rupees === 0 && remainingPaise > 0) {
    return `${convertLessThanThousand(remainingPaise)} Paise Only`;
  }

  const crore = Math.floor(rupees / 10000000);
  let remainder = rupees % 10000000;

  const lakh = Math.floor(remainder / 100000);
  remainder %= 100000;

  const thousand = Math.floor(remainder / 1000);
  const hundreds = remainder % 1000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(convertLessThanThousand(crore) + ' Crore');
  }
  if (lakh > 0) {
    parts.push(convertLessThanThousand(lakh) + ' Lakh');
  }
  if (thousand > 0) {
    parts.push(convertLessThanThousand(thousand) + ' Thousand');
  }
  if (hundreds > 0) {
    parts.push(convertLessThanThousand(hundreds));
  }

  let text = parts.join(' ').trim() + ' Rupees';

  if (remainingPaise > 0) {
    text += ' and ' + convertLessThanThousand(remainingPaise) + ' Paise';
  }

  return text + ' Only';
}
