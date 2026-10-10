import React from 'react';
import { LucideIcon, Plus } from 'lucide-react';
import { Button } from './Button.js';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-card bg-card/50 my-4">
      <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] dark:bg-[#202025] flex items-center justify-center text-muted mb-4 border border-border">
        <Icon className="w-6 h-6 text-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} className="inline-flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>{actionLabel}</span>
        </Button>
      )}
    </div>
  );
};
