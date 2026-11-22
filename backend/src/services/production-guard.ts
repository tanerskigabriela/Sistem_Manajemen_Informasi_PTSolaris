import { ORDER_STATUS, ROLE, SPK_STATUS } from '../constants';
import type { SpkContext } from '../repositories/spk.repository';
import type { Actor } from '../utils/actor';
import { AppError } from '../utils/errors';

/** Pemeriksaan bersama progres (FSD-2.12) dan hasil QC (FSD-2.13). */
export function assertSpkFound(ctx: SpkContext | null): SpkContext {
  if (!ctx) throw new AppError(404, 'ERR-SYS-02', 'SPK tidak ditemukan.');
  return ctx;
}

/** RB-40: hanya SPK DISETUJUI dari order yang tidak DIBATALKAN (ERR-PRG-01). */
export function assertRecordable(ctx: SpkContext): void {
  if (ctx.spk_status !== SPK_STATUS.DISETUJUI || ctx.order_status === ORDER_STATUS.DIBATALKAN) {
    throw new AppError(
      409,
      'ERR-PRG-01',
      'Pencatatan hanya dapat dilakukan untuk SPK yang disetujui dan order yang tidak dibatalkan.',
    );
  }
}

/** ERR-VAL-09: jumlah tidak boleh negatif. */
export function assertNotNegative(field: string, value: number): void {
  if (value < 0) {
    throw new AppError(422, 'ERR-VAL-09', 'Nilai tidak boleh negatif.', [
      { field, message: 'Nilai tidak boleh negatif.' },
    ]);
  }
}

/** RB-35: Supervisor dan QC hanya melihat SPK yang sudah disetujui. */
export function canSeeSpk(actor: Actor, spkStatus: string): boolean {
  if (actor.role_code === ROLE.SPV || actor.role_code === ROLE.QC) {
    return spkStatus === SPK_STATUS.DISETUJUI;
  }
  return true;
}
