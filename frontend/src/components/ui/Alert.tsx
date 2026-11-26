import type { ReactNode } from 'react';
import { Button } from './Button';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  message?: string;
  children?: ReactNode;
  onRetry?: () => void;
  onClose?: () => void;
  className?: string;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: 'bg-info-soft text-info border-info/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
};

export function Alert({
  variant = 'info',
  title,
  message,
  children,
  onRetry,
  onClose,
  className = '',
}: AlertProps) {
  return (
    <div
      role="alert"
      className={[
        'flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        VARIANT_CLASSES[variant],
        className,
      ].join(' ')}
    >
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {message && <p>{message}</p>}
        {children}
      </div>

      {(onRetry || onClose) && (
        <div className="flex shrink-0 items-center gap-2">
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Coba lagi
            </Button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup notifikasi"
              className="rounded px-2 py-1 text-xs font-semibold hover:bg-surface/60"
            >
              Tutup
            </button>
          )}
        </div>
      )}
    </div>
  );
}