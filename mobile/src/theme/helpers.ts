import { colors } from './colors';

/**
 * Formats a number into Indian Rupee format: ₹1,20,000
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '₹0';
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));

  // Convert to Indian number format
  const str = abs.toString();
  let lastThree = str.substring(str.length - 3);
  const otherNumbers = str.substring(0, str.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Formats a number into compact Indian Rupee format: ₹85K, ₹12.5L, ₹1.2Cr
 */
export function formatCompactINR(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '₹0';
  const isNegative = amount < 0;
  const abs = Math.abs(amount);

  let formatted = '';
  if (abs >= 10000000) {
    // Crores (>= 1 Cr)
    const cr = abs / 10000000;
    formatted = `${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  } else if (abs >= 100000) {
    // Lakhs (>= 1 L)
    const l = abs / 100000;
    formatted = `${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
  } else if (abs >= 1000) {
    // Thousands (>= 1 K)
    const k = abs / 1000;
    formatted = `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`;
  } else {
    formatted = abs.toString();
  }

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Returns user-friendly relative time:
 * "Today 10:30 AM", "Yesterday", "2 days ago", or "14 Oct"
 */
export function relativeTime(
  dateInput: string | Date | null | undefined,
  timeZone: string = 'Asia/Kolkata'
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Time format helper (e.g. 10:30 AM)
  const timeString = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });

  const isToday =
    now.getDate() === date.getDate() &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === date.getDate() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getFullYear() === date.getFullYear();

  if (diffSec < 60) {
    return 'Just now';
  }
  if (isToday) {
    return `Today ${timeString}`;
  }
  if (isYesterday) {
    return `Yesterday ${timeString}`;
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  // Same year: e.g. "14 Oct"
  if (now.getFullYear() === date.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      timeZone,
    });
  }

  // Different year: e.g. "14 Oct 2025"
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
}

export type AvatarPalette = {
  bg: string;
  text: string;
};

/**
 * Deterministically chooses an avatar color palette (blue, orange, purple, green)
 * based on string ID / name
 */
export function getAvatarColor(identifier: string = ''): AvatarPalette {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % 4;
  switch (index) {
    case 0:
      return { bg: colors.orangeTint, text: colors.orangeAvatarText };
    case 1:
      return { bg: colors.purpleTint, text: colors.purpleAvatarText };
    case 2:
      return { bg: colors.blueTint, text: colors.blueText };
    case 3:
    default:
      return { bg: colors.greenTint, text: colors.greenText };
  }
}

/**
 * Extracts up to 2 uppercase initials from a name
 */
export function getInitials(name: string = ''): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FD';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
