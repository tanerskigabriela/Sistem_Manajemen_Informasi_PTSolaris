import { ACTION_TYPE, QC_STAGES } from '../constants';
import { ProgressRepository } from '../repositories/progress.repository';
import { QcResultRepository } from '../repositories/qc-result.repository';
import { SpkRepository } from '../repositories/spk.repository';
import type { CreateQcResultInput } from '../schemas/qc-result.schema';
import type { Actor } from '../utils/actor';
import { AppError } from '../utils/errors';
import { mapKnownSqlError } from '../utils/sql-error';
import { BaseService } from './base.service';
import {
  assertNotNegative,
  assertRecordable,
  assertSpkFound,
  canSeeSpk,
} from './production-guard';

/** FSD-2.13 Catat Hasil QC. */
export class QcResultService extends BaseService {
  constructor(
    private readonly repo = new QcResultRepository(),
    private readonly progressRepo = new ProgressRepository(),
    private readonly spkRepo = new SpkRepository(),
  ) {
    super();
  }

  /** Daftar hasil QC SPK + ringkasan tidak lolos per tahap dan per style. */
  async listBySpk(spkId: string, actor: Actor) {
    const spk = await this.spkRepo.findById(spkId);
    if (!spk || !canSeeSpk(actor, spk.status)) {
      throw new AppError(404, 'ERR-SYS-02', 'SPK tidak ditemukan.');
    }
    const [stages, entries, style] = await Promise.all([
      this.spkRepo.findStages(spkId),
      this.repo.findBySpk(spkId),
      this.repo.styleRejectSummary(spk.order_detail_id),
    ]);

    return {
      spk_id: spk.spk_id,
      spk_no: spk.spk_no,
      order_code: spk.order_code,
      item_code: spk.item_code,
      color: spk.color,
      // RB-43: tidak lolos = selesai kumulatif - lolos kumulatif, per tahap (Packing tidak ada QC)
      stages: stages
        .filter((s) => isQcStage(s.stage_code))
        .map((s) => {
          const passed = s.cumulative_passed ?? 0;
          const failed = Math.max(s.cumulative_done - passed, 0);
          return {
            stage_code: s.stage_code,
            stage_name: s.stage_name,
            cumulative_done: s.cumulative_done,
            cumulative_passed: passed,
            failed,
            failed_pct: s.cumulative_done > 0 ? round2((failed / s.cumulative_done) * 100) : 0,
            max_passed_input: Math.max(s.cumulative_done - passed, 0),
          };
        }),
      style,
      entries,
    };
  }

  async create(spkId: string, input: CreateQcResultInput, actor: Actor) {
    // ERR-QC-02 (RB-41): hanya tahap di QC_STAGES (Cutting s.d. Ironing)
    if (!isQcStage(input.stage_code)) {
      throw new AppError(422, 'ERR-QC-02', 'Tahap ini tidak dapat dicatat hasil QC-nya.', [
        { field: 'stage_code', message: 'Tahap ini tidak dapat dicatat hasil QC-nya.' },
      ]);
    }
    assertNotNegative('qty_passed', input.qty_passed);
    if (input.sample_qty != null && input.sample_qty <= 0) {
      throw new AppError(422, 'ERR-VAL-02', 'Nilai harus lebih dari 0.', [
        { field: 'sample_qty', message: 'Nilai harus lebih dari 0.' },
      ]);
    }
    const badDefect = input.defects.findIndex((d) => !(d.qty > 0));
    if (badDefect >= 0) {
      throw new AppError(422, 'ERR-VAL-02', 'Nilai harus lebih dari 0.', [
        { field: `defects.${badDefect}.qty`, message: 'Nilai harus lebih dari 0.' },
      ]);
    }
    const ids = input.defects.map((d) => d.defect_type_id.toUpperCase());
    if (new Set(ids).size !== ids.length) {
      throw new AppError(422, 'ERR-VAL-01', 'Kolom ini wajib diisi.', [
        { field: 'defects', message: 'Jenis cacat tidak boleh dipilih dua kali.' },
      ]);
    }

    try {
      return await this.runInTransaction(async (tx) => {
        const ctx = assertSpkFound(await this.spkRepo.findContext(tx, spkId));
        assertRecordable(ctx);

        // RB-42 / ERR-QC-01: lolos kumulatif <= selesai kumulatif
        const done = await this.progressRepo.cumulativeDone(tx, spkId, input.stage_code);
        const passedBefore = await this.progressRepo.cumulativePassed(tx, spkId, input.stage_code);
        if (passedBefore + input.qty_passed > done) {
          const n = Math.max(done - passedBefore, 0);
          throw new AppError(
            422,
            'ERR-QC-01',
            `Jumlah lolos melebihi jumlah selesai pada tahap ini (maksimum: ${n}).`,
            [{ field: 'qty_passed', message: `Maksimum ${n}.` }],
          );
        }

        const id = await this.repo.insert(tx, {
          inspection_type: input.inspection_type,
          spk_id: spkId,
          stage_code: input.stage_code,
          standard_id: input.standard_id,
          inspected_by: actor.employee_id,
          check_date: input.check_date,
          sample_qty: input.sample_qty ?? null,
          qty_passed: input.qty_passed,
        });
        for (const d of input.defects) {
          await this.repo.insertDefect(tx, id, d);
        }
        const created = await this.repo.findById(id, tx);

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.TAMBAH,
          resource_type: 'garment.qc_results',
          resource_id: id,
          new_values: created as unknown as Record<string, unknown>,
          device: actor.device,
          ip_address: actor.ip_address,
        });

        // RB-44: tandai style/order "Melebihi Batas Reject" + notifikasi
        await this.spkRepo.evaluateFlags(tx, ctx.order_detail_id);
        const style = await this.repo.styleRejectSummary(ctx.order_detail_id, tx);

        const passed = passedBefore + input.qty_passed;
        const failed = done - passed;
        return {
          id,
          stage_code: input.stage_code,
          cumulative_done: done,
          cumulative_passed: passed,
          failed,
          failed_pct: done > 0 ? round2((failed / done) * 100) : 0,
          style,
        };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err, 'standard_id');
    }
  }
}

function isQcStage(stage: string): boolean {
  return (QC_STAGES as readonly string[]).includes(stage);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
