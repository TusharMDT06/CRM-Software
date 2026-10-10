export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₹0';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 10000000) {
    const cr = absAmount / 10000000;
    const formatted = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1);
    return `${sign}₹${formatted}Cr`;
  }
  if (absAmount >= 100000) {
    const l = absAmount / 100000;
    const formatted = l % 1 === 0 ? l.toFixed(0) : l.toFixed(1);
    return `${sign}₹${formatted}L`;
  }
  if (absAmount >= 1000) {
    const k = absAmount / 1000;
    const formatted = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${sign}₹${formatted}K`;
  }
  return `${sign}₹${absAmount}`;
}

export function formatDate(dateString: string | Date): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function isOverdue(dateString: string | Date): boolean {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  // Strip time for fair comparison
  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dMidnight < nowMidnight;
}

export function getDaysDiff(dateString: string | Date): number {
  if (!dateString) return 0;
  const d = new Date(dateString);
  const now = new Date();
  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((dMidnight - nowMidnight) / (1000 * 60 * 60 * 24));
}
