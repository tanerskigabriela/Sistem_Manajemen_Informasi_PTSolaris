import type { ReactNode } from 'react';
import {
  formatStatus,
  getStatusTone,
  type BadgeTone,
} from '../../lib/format';

export interface BadgeProps {
  /** Kode status dari API (mis. MENUNGGU_PERSETUJUAN, DISETUJUI, AKTIF) */
  status?: string | null;
  /** Override warna badge secara manual bila perlu */
  tone?: BadgeTone;
  /** Override teks tampilan bila tidak ingin memakai formatStatus(status) */
  children?: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted border-line',
  brand: 'bg-brand-soft text-brand-ink border-brand/20',
  info: 'bg-info-soft text-info border-info/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
};

export function Badge({
  status,
  tone,
  children,
  className = '',
}: BadgeProps) {
  const resolvedTone = tone ?? getStatusTone(status);
  const label = children ?? formatStatus(status);

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[resolvedTone],
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}