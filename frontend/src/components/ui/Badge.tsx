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
  neutral: 'bg-neutral-soft text-neutral-ink border-transparent',
  brand: 'bg-pale-gold text-brand-ink border-solar-amber/30',
  info: 'bg-info-soft text-info border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
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
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONE_CLASSES[resolvedTone],
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
