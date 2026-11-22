import { ACTION_TYPE, ORDER_STATUS } from '../constants';
import {
  OrderMaterialRepository,
  type OrderDetailHeader,
} from '../repositories/order-material.repository';
import type {
  CreateOrderMaterialInput,
  UpdateOrderMaterialInput,
} from '../schemas/order-material.schema';
import type { Actor } from '../utils/actor';
import { AppError } from '../utils/errors';
import { mapKnownSqlError } from '../utils/sql-error';
import { BaseService } from './base.service';

const FINAL_ORDER_STATUSES: string[] = [
  ORDER_STATUS.DITOLAK,
  ORDER_STATUS.DITARIK,
  ORDER_STATUS.DIBATALKAN,
  ORDER_STATUS.SELESAI,
];

interface MaterialFields {
  material_id?: string;
  qty?: number;
  source?: string;
  supplier_id?: string | null;
  material_price?: number | null;
  eligibility_confirmed?: boolean;
}

/** FSD-2.9: catat dan ubah bahan baku per style. */
export class OrderMaterialService extends BaseService {
  constructor(private readonly repo = new OrderMaterialRepository()) {
    super();
  }

  private assertBusinessInput(input: MaterialFields): void {
    // EF-4 / ERR-VAL-13
    if (input.eligibility_confirmed !== true) {
      throw new AppError(422, 'ERR-VAL-13', 'Centang pernyataan terlebih dahulu.', [
        { field: 'eligibility_confirmed', message: 'Centang pernyataan terlebih dahulu.' },
      ]);
    }
    // EF-2 / ERR-VAL-08 (RB-26)
    if (
      input.source === 'SUPPLIER' &&
      (!input.supplier_id || input.material_price === undefined || input.material_price === null)
    ) {
      throw new AppError(
        422,
        'ERR-VAL-08',
        'Supplier dan harga bahan wajib diisi untuk bahan dari supplier.',
        [
          ...(!input.supplier_id ? [{ field: 'supplier_id', message: 'Kolom ini wajib diisi.' }] : []),
          ...(input.material_price == null
            ? [{ field: 'material_price', message: 'Kolom ini wajib diisi.' }]
            : []),
        ],
      );
    }
    // EF-3 / ERR-VAL-02
    const bad: { field: string; message: string }[] = [];
    if (input.qty !== undefined && !(input.qty > 0)) {
      bad.push({ field: 'qty', message: 'Nilai harus lebih dari 0.' });
    }
    if (input.source === 'SUPPLIER' && input.material_price != null && !(input.material_price > 0)) {
      bad.push({ field: 'material_price', message: 'Nilai harus lebih dari 0.' });
    }
    if (bad.length > 0) {
      throw new AppError(422, 'ERR-VAL-02', 'Nilai harus lebih dari 0.', bad);
    }
  }

  private assertEditable(header: OrderDetailHeader | null): OrderDetailHeader {
    if (!header) {
      throw new AppError(404, 'ERR-SYS-02', 'Style tidak ditemukan.');
    }
    if (FINAL_ORDER_STATUSES.includes(header.order_status)) {
      throw new AppError(409, 'ERR-ORD-05', 'Order ini bersifat final dan hanya dapat dilihat.');
    }
    // EF-5 / ERR-BHN-01 (RB-67). trg_materials_lock tetap menjaga di database.
    if (header.locked) {
      throw new AppError(
        409,
        'ERR-BHN-01',
        'Data bahan tidak dapat diubah karena SPK style ini sudah diajukan.',
      );
    }
    return header;
  }

  async listByOrderDetail(orderDetailId: string, actor: Actor) {
    const header = await this.repo.findHeader(orderDetailId);
    if (!header) {
      throw new AppError(404, 'ERR-SYS-02', 'Style tidak ditemukan.');
    }
    const materials = await this.repo.findByOrderDetail(orderDetailId);
    return this.maskPriceFields({ ...header, materials }, actor.role_code);
  }

  async requirement(orderDetailId: string) {
    const header = await this.repo.findHeader(orderDetailId);
    if (!header) {
      throw new AppError(404, 'ERR-SYS-02', 'Style tidak ditemukan.');
    }
    const items = await this.repo.findRequirement(orderDetailId);
    return { ...header, items };
  }

  async create(orderDetailId: string, input: CreateOrderMaterialInput, actor: Actor) {
    this.assertBusinessInput(input);
    try {
      return await this.runInTransaction(async (tx) => {
        this.assertEditable(await this.repo.findHeader(orderDetailId, tx));

        const unit = input.unit ?? (await this.repo.getRawMaterialUnit(tx, input.material_id));
        if (!unit) {
          throw new AppError(422, 'ERR-VAL-01', 'Kolom ini wajib diisi.', [
            { field: 'material_id', message: 'Bahan baku tidak ditemukan.' },
          ]);
        }

        const id = await this.repo.insert(tx, orderDetailId, { ...input, unit }, actor.employee_id);
        const created = await this.repo.findById(id, tx);

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.TAMBAH,
          resource_type: 'garment.order_materials',
          resource_id: id,
          new_values: created as unknown as Record<string, unknown>,
          device: actor.device,
          ip_address: actor.ip_address,
        });

        return { id, readiness: 'SIAP' as const };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err, 'material_id');
    }
  }

  async update(id: string, input: UpdateOrderMaterialInput, actor: Actor) {
    try {
      return await this.runInTransaction(async (tx) => {
        const before = await this.repo.findById(id, tx);
        if (!before) {
          throw new AppError(404, 'ERR-SYS-02', 'Data bahan tidak ditemukan.');
        }
        this.assertEditable(await this.repo.findHeader(before.order_detail_id, tx));

        const source = input.source ?? before.source;
        const merged = {
          material_id: input.material_id ?? before.material_id,
          qty: input.qty ?? before.qty,
          unit: input.unit ?? before.unit,
          source,
          supplier_id:
            source === 'SUPPLIER'
              ? input.supplier_id !== undefined ? input.supplier_id ?? null : before.supplier_id
              : null,
          material_price:
            source === 'SUPPLIER'
              ? input.material_price !== undefined ? input.material_price ?? null : before.material_price
              : null,
          received_date: input.received_date ?? before.received_date,
        };
        this.assertBusinessInput({ ...merged, eligibility_confirmed: input.eligibility_confirmed });

        await this.repo.update(tx, id, merged, actor.employee_id);
        const after = await this.repo.findById(id, tx);

        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.UBAH,
          resource_type: 'garment.order_materials',
          resource_id: id,
          old_values: before as unknown as Record<string, unknown>,
          new_values: after as unknown as Record<string, unknown>,
          device: actor.device,
          ip_address: actor.ip_address,
        });

        return { id, readiness: 'SIAP' as const };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err, 'material_id');
    }
  }
}
