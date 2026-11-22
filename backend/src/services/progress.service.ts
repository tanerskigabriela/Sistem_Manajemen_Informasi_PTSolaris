import { ACTION_TYPE } from '../constants';
import { ProgressRepository } from '../repositories/progress.repository';
import { SpkRepository } from '../repositories/spk.repository';
import type { CreateProgressInput, UpdateProgressInput } from '../schemas/progress.schema';
import type { Actor } from '../utils/actor';
import { AppError } from '../utils/errors';
import { mapKnownSqlError, sqlErrorNumber } from '../utils/sql-error';
import { BaseService } from './base.service';
import {
  assertNotNegative,
  assertRecordable,
  assertSpkFound,
  canSeeSpk,
} from './production-guard';

const CUTTING = 'CUTTING';

/** FSD-2.12 Catat Progres Harian. */
export class ProgressService extends BaseService {
  constructor(
    private readonly repo = new ProgressRepository(),
    private readonly spkRepo = new SpkRepository(),
  ) {
    super();
  }

  /** Daftar progres SPK + ringkasan per tahap (sisa pekerjaan, batas maksimum). */
  async listBySpk(spkId: string, actor: Actor) {
    const spk = await this.spkRepo.findById(spkId);
    if (!spk || !canSeeSpk(actor, spk.status)) {
      throw new AppError(404, 'ERR-SYS-02', 'SPK tidak ditemukan.');
    }
    const [stages, entries] = await Promise.all([
      this.spkRepo.findStages(spkId),
      this.repo.findBySpk(spkId),
    ]);
    return {
      spk_id: spk.spk_id,
      spk_no: spk.spk_no,
      order_code: spk.order_code,
      item_code: spk.item_code,
      color: spk.color,
      total_qty: spk.total_qty,
      stages,
      entries,
    };
  }

  async create(spkId: string, input: CreateProgressInput, actor: Actor) {
    assertNotNegative('qty_done', input.qty_done);
    const note = input.variance_note?.trim() || null;

    try {
      return await this.runInTransaction(async (tx) => {
        const ctx = assertSpkFound(await this.spkRepo.findContext(tx, spkId));
        assertRecordable(ctx);

        // RB-36 / ERR-PRG-02
        if (await this.repo.existsForDate(tx, spkId, input.stage_code, input.work_date)) {
          throw duplicateError();
        }

        const before = await this.repo.cumulativeDone(tx, spkId, input.stage_code);
        const cumulative = before + input.qty_done;
        await this.assertWithinLimits(tx, spkId, input.stage_code, before, cumulative, ctx.total_qty, note);

        const id = await this.repo.insert(tx, {
          spk_id: spkId,
          stage_code: input.stage_code,
          work_date: input.work_date,
          qty_done: input.qty_done,
          variance_note: note,
          recorded_by: actor.employee_id,
        });
        const created = await this.repo.findById(id, tx);

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.TAMBAH,
          resource_type: 'production_progress',
          resource_id: id,
          new_values: created as unknown as Record<string, unknown>,
          device: actor.device,
          ip_address: actor.ip_address,
        });

        await this.spkRepo.evaluateFlags(tx, ctx.order_detail_id);

        return {
          id,
          stage_code: input.stage_code,
          cumulative_done: cumulative,
          remaining: Math.max(ctx.total_qty - cumulative, 0),
        };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (sqlErrorNumber(err) === 2627 || sqlErrorNumber(err) === 2601) throw duplicateError();
      return mapKnownSqlError(err);
    }
  }

  /** AF-2: Ubah Data Lama (validasi yang sama). */
  async update(id: string, input: UpdateProgressInput, actor: Actor) {
    assertNotNegative('qty_done', input.qty_done);
    const note = input.variance_note?.trim() || null;

    try {
      return await this.runInTransaction(async (tx) => {
        const old = await this.repo.findById(id, tx);
        if (!old) throw new AppError(404, 'ERR-SYS-02', 'Data progres tidak ditemukan.');

        const ctx = assertSpkFound(await this.spkRepo.findContext(tx, old.spk_id));
        assertRecordable(ctx);

        const others = await this.repo.cumulativeDone(tx, old.spk_id, old.stage_code, id);
        const cumulative = others + input.qty_done;
        await this.assertWithinLimits(tx, old.spk_id, old.stage_code, others, cumulative, ctx.total_qty, note);

        // Selesai kumulatif tidak boleh turun di bawah lolos QC yang sudah dicatat (RB-42).
        const passed = await this.repo.cumulativePassed(tx, old.spk_id, old.stage_code);
        if (cumulative < passed) {
          throw new AppError(
            422,
            'ERR-QC-01',
            `Jumlah lolos melebihi jumlah selesai pada tahap ini (maksimum: ${cumulative}).`,
            [{ field: 'qty_done', message: `Minimal ${passed - others} karena sudah ada ${passed} barang lolos QC.` }],
          );
        }

        await this.repo.update(tx, id, {
          qty_done: input.qty_done,
          variance_note: note,
          recorded_by: actor.employee_id,
        });
        const updated = await this.repo.findById(id, tx);

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.UBAH,
          resource_type: 'production_progress',
          resource_id: id,
          old_values: old as unknown as Record<string, unknown>,
          new_values: updated as unknown as Record<string, unknown>,
          device: actor.device,
          ip_address: actor.ip_address,
        });

        await this.spkRepo.evaluateFlags(tx, ctx.order_detail_id);

        return {
          id,
          stage_code: old.stage_code,
          cumulative_done: cumulative,
          remaining: Math.max(ctx.total_qty - cumulative, 0),
        };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err);
    }
  }

  /**
   * RB-37 / ERR-PRG-03: Sewing s.d. Packing tidak boleh melebihi lolos QC tahap sebelumnya.
   * RB-38 / ERR-PRG-04: Cutting yang kumulatifnya berbeda dari jumlah SPK wajib diberi keterangan.
   */
  private async assertWithinLimits(
    tx: Parameters<ProgressRepository['insert']>[0],
    spkId: string,
    stageCode: string,
    before: number,
    cumulative: number,
    totalQty: number,
    note: string | null,
  ): Promise<void> {
    if (stageCode === CUTTING) {
      if (cumulative !== totalQty && !note) {
        throw new AppError(422, 'ERR-PRG-04', 'Keterangan selisih Cutting wajib diisi.', [
          {
            field: 'variance_note',
            message: `Kumulatif Cutting ${cumulative} berbeda dari jumlah SPK ${totalQty}.`,
          },
        ]);
      }
      return;
    }

    const max = await this.repo.maxAllowed(tx, spkId, stageCode);
    if (cumulative > max) {
      const n = Math.max(max - before, 0);
      throw new AppError(
        422,
        'ERR-PRG-03',
        `Jumlah melebihi barang yang lolos QC pada tahap sebelumnya (maksimum: ${n}).`,
        [{ field: 'qty_done', message: `Maksimum ${n}.` }],
      );
    }
  }
}

function duplicateError(): AppError {
  return new AppError(
    409,
    'ERR-PRG-02',
    'Progres untuk SPK, tahap, dan tanggal ini sudah ada. Silakan ubah data yang ada.',
  );
}
