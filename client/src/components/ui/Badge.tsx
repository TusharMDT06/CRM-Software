import React from 'react';

export type BadgeVariant = 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
  size = 'md',
}) => {
  const variantStyles = {
    info: 'bg-[#E6EEFF] text-[#3B5BDB] dark:bg-[#3B5BDB]/20 dark:text-[#829BF8]',
    warning: 'bg-[#FDEBDD] text-[#B45309] dark:bg-[#F07B2A]/20 dark:text-[#F59E0B]',
    success: 'bg-[#DDF6E8] text-[#15803D] dark:bg-[#15803D]/25 dark:text-[#4ADE80]',
    danger: 'bg-[#FDE4E4] text-[#B42318] dark:bg-[#B42318]/25 dark:text-[#F87171]',
    neutral: 'bg-[#F4F4F5] text-[#6B6B76] dark:bg-[#202025] dark:text-[#A1A1AA]',
    purple: 'bg-[#F0EEFF] text-[#6355D8] dark:bg-[#8B7FE0]/25 dark:text-[#A79CFA]',
  }[variant];

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md font-medium tracking-wide',
    md: 'text-xs px-2.5 py-1 rounded-lg font-medium',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 uppercase tracking-wider select-none ${variantStyles} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
};

export function getStatusBadgeVariant(statusOrStage: string): BadgeVariant {
  switch (statusOrStage.toLowerCase()) {
    case 'won':
    case 'converted':
    case 'done':
    case 'active':
    case 'qualified':
      return 'success';
    case 'proposal':
    case 'negotiation':
    case 'contacted':
    case 'medium':
      return 'info';
    case 'new':
    case 'open':
    case 'low':
      return 'warning';
    case 'lost':
    case 'high':
    case 'overdue':
    case 'inactive':
      return 'danger';
    default:
      return 'neutral';
  }
}
