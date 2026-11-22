import { ACTION_TYPE, ROLE, SPK_STATUS } from '../constants';
import { SpkRepository } from '../repositories/spk.repository';
import type { ListSpkQuery, RejectSpkInput, SubmitSpkInput } from '../schemas/spk.schema';
import type { Actor } from '../utils/actor';
import { AppError } from '../utils/errors';
import { mapKnownSqlError } from '../utils/sql-error';
import { BaseService } from './base.service';

/** Hasil @result dari sp_submit_spk -> error FSD-2.10. */
const SUBMIT_ERRORS: Record<string, AppError> = {
  NOT_FOUND: new AppError(404, 'ERR-SYS-02', 'Style tidak ditemukan.'),
  ORDER_NOT_APPROVED: new AppError(
    409,
    'ERR-SPK-01',
    'SPK hanya dapat dibuat untuk order yang sudah disetujui.',
  ),
  MATERIAL_NOT_READY: new AppError(
    409,
    'ERR-SPK-02',
    'Belum ada bahan baku yang dicatat untuk style ini.',
  ),
  SPK_EXISTS: new AppError(409, 'ERR-SPK-03', 'Style ini sudah memiliki SPK.'),
  INVALID_LINE: new AppError(422, 'ERR-VAL-01', 'Kolom ini wajib diisi.', [
    { field: 'line_id', message: 'Lini produksi tidak tersedia di pabrik order ini.' },
  ]),
  INVALID_SIZES: new AppError(422, 'ERR-VAL-02', 'Nilai harus lebih dari 0.', [
    { field: 'sizes', message: 'Ukuran harus sesuai ukuran style, tidak ganda, dan jumlahnya lebih dari 0.' },
  ]),
};

/** Hasil @result dari sp_decide_spk -> error FSD-2.11. */
const DECIDE_ERRORS: Record<string, AppError> = {
  NOT_FOUND: new AppError(404, 'ERR-SYS-02', 'SPK tidak ditemukan.'),
  REASON_REQUIRED: new AppError(422, 'ERR-VAL-06', 'Alasan wajib diisi.', [
    { field: 'reason', message: 'Alasan wajib diisi.' },
  ]),
  ALREADY_DECIDED: new AppError(409, 'ERR-SPK-04', 'SPK ini sudah diputuskan sebelumnya.'),
  ORDER_CLOSED: new AppError(409, 'ERR-ORD-05', 'Order ini bersifat final dan hanya dapat dilihat.'),
};

/** SPV dan QC hanya melihat SPK yang sudah disetujui (RB-35). */
function onlyApproved(actor: Actor): boolean {
  return actor.role_code === ROLE.SPV || actor.role_code === ROLE.QC;
}

export class SpkService extends BaseService {
  constructor(private readonly repo = new SpkRepository()) {
    super();
  }

  async list(query: ListSpkQuery, actor: Actor) {
    const effective = onlyApproved(actor)
      ? { ...query, status: SPK_STATUS.DISETUJUI }
      : query;
    const { rows, total } = await this.repo.findPage(effective);
    return {
      rows,
      meta: {
        current_page: query.page,
        per_page: query.per_page,
        total,
        last_page: Math.max(1, Math.ceil(total / query.per_page)),
      },
    };
  }

  async getById(id: string, actor: Actor) {
    const spk = await this.repo.findById(id);
    if (!spk || (onlyApproved(actor) && spk.status !== SPK_STATUS.DISETUJUI)) {
      throw new AppError(404, 'ERR-SYS-02', 'SPK tidak ditemukan.');
    }
    const [extra, sizes, stages] = await Promise.all([
      this.repo.findDetailExtra(id),
      this.repo.findSizes(id),
      this.repo.findStages(id),
    ]);
    return { ...spk, ...extra, sizes, stages };
  }

  /** FSD-2.10 Buat SPK. */
  async submit(input: SubmitSpkInput, actor: Actor) {
    if (input.materials_complete_confirmed !== true) {
      throw new AppError(422, 'ERR-VAL-13', 'Centang pernyataan terlebih dahulu.', [
        { field: 'materials_complete_confirmed', message: 'Centang pernyataan terlebih dahulu.' },
      ]);
    }
    const badSizes = input.sizes
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !(s.qty > 0));
    if (badSizes.length > 0) {
      throw new AppError(
        422,
        'ERR-VAL-02',
        'Nilai harus lebih dari 0.',
        badSizes.map(({ i }) => ({ field: `sizes.${i}.qty`, message: 'Nilai harus lebih dari 0.' })),
      );
    }

    try {
      return await this.runInTransaction(async (tx) => {
        const out = await this.repo.submit(tx, {
          order_detail_id: input.order_detail_id,
          line_id: input.line_id,
          employee_id: actor.employee_id,
          target_date: input.target_date,
          sizes: input.sizes,
        });

        if (out.result !== 'SUCCESS') {
          throw SUBMIT_ERRORS[out.result] ??
            new AppError(500, 'ERR-SYS-02', 'Terjadi kesalahan pada sistem. Silakan coba lagi.');
        }

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.TAMBAH,
          resource_type: 'garment.spk',
          resource_id: out.spk_id,
          new_values: {
            spk_no: out.spk_no,
            order_detail_id: input.order_detail_id,
            line_id: input.line_id,
            target_date: input.target_date,
            sizes: input.sizes,
          },
          device: actor.device,
          ip_address: actor.ip_address,
        });

        return { id: out.spk_id, spk_no: out.spk_no, status: SPK_STATUS.MENUNGGU_PERSETUJUAN };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err);
    }
  }

  /** FSD-2.11 Setujui SPK. */
  async approve(id: string, actor: Actor) {
    try {
      return await this.runInTransaction(async (tx) => {
        const result = await this.repo.decide(tx, {
          spk_id: id,
          decision: 'APPROVE',
          employee_id: actor.employee_id,
        });
        if (result !== 'SUCCESS') throw this.decideError(result);

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.SETUJU,
          resource_type: 'garment.spk',
          resource_id: id,
          old_values: { status: SPK_STATUS.MENUNGGU_PERSETUJUAN },
          new_values: { status: SPK_STATUS.DISETUJUI },
          device: actor.device,
          ip_address: actor.ip_address,
        });

        const order_status = await this.repo.getOrderStatus(tx, id);
        return { id, status: SPK_STATUS.DISETUJUI, order_status };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err);
    }
  }

  /** FSD-2.11 Tolak SPK (alasan wajib, RB-33). */
  async reject(id: string, input: RejectSpkInput, actor: Actor) {
    const reason = input.reason?.trim() ?? '';
    if (reason.length === 0) throw DECIDE_ERRORS.REASON_REQUIRED;

    try {
      return await this.runInTransaction(async (tx) => {
        const result = await this.repo.decide(tx, {
          spk_id: id,
          decision: 'REJECT',
          employee_id: actor.employee_id,
          reason,
        });
        if (result !== 'SUCCESS') throw this.decideError(result);

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.TOLAK,
          resource_type: 'garment.spk',
          resource_id: id,
          old_values: { status: SPK_STATUS.MENUNGGU_PERSETUJUAN },
          new_values: { status: SPK_STATUS.DITOLAK, reject_reason: reason },
          device: actor.device,
          ip_address: actor.ip_address,
        });

        return { id, status: SPK_STATUS.DITOLAK };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err);
    }
  }

  private decideError(result: string): AppError {
    return (
      DECIDE_ERRORS[result] ??
      new AppError(500, 'ERR-SYS-02', 'Terjadi kesalahan pada sistem. Silakan coba lagi.')
    );
  }
}
