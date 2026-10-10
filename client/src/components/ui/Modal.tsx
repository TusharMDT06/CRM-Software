import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './Button.js';
import { modalVariants, backdropVariants } from '../../lib/motion.js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm?: () => void;
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  isLoading = false,
  size = 'md',
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Dialog */}
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`relative bg-card border border-border w-full ${sizeClass} rounded-card p-6 shadow-2xl z-10`}
          >
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <button
                onClick={onClose}
                className="text-muted hover:text-foreground rounded-lg p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {description && <p className="text-sm text-muted mb-4">{description}</p>}

            {children && <div className="mb-4">{children}</div>}

            {footer ? (
              <div className="pt-3 border-t border-border mt-4 flex items-center justify-end">
                {footer}
              </div>
            ) : (
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border mt-4">
                <Button variant="secondary" size="md" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                {confirmLabel && onConfirm && (
                  <Button
                    variant={confirmVariant}
                    size="md"
                    onClick={onConfirm}
                    isLoading={isLoading}
                  >
                    {confirmLabel}
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
