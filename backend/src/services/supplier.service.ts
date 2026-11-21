import { ACTION_TYPE } from '../constants';
import {
  SupplierRepository,
  type Supplier,
  type SupplierMaterialRow,
} from '../repositories/supplier.repository';
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
} from '../schemas/supplier.schema';
import type { Actor } from '../utils/actor';
import { AppError } from '../utils/errors';
import { mapKnownSqlError } from '../utils/sql-error';
import { BaseService } from './base.service';

export class SupplierService extends BaseService {
  constructor(private readonly repo = new SupplierRepository()) {
    super();
  }

  list(query: ListSuppliersQuery): Promise<Supplier[]> {
    return this.repo.findAll(query);
  }

  async getById(id: string): Promise<Supplier> {
    const supplier = await this.repo.findById(id);
    if (!supplier) {
      throw new AppError(404, 'ERR-SYS-02', 'Supplier tidak ditemukan.');
    }
    return supplier;
  }

  async listMaterials(id: string, actor: Actor): Promise<SupplierMaterialRow[]> {
    await this.getById(id);
    const rows = await this.repo.findMaterials(id);
    return this.maskPriceFields(rows, actor.role_code);
  }

  async create(input: CreateSupplierInput, actor: Actor): Promise<Supplier> {
    try {
      return await this.runInTransaction(async (tx) => {
        const id = await this.repo.create(tx, input);
        const created = (await this.repo.findByIdTx(tx, id)) as Supplier;
        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.TAMBAH,
          resource_type: 'suppliers',
          resource_id: id,
          new_values: created as unknown as Record<string, unknown>,
          device: actor.device,
          ip_address: actor.ip_address,
        });
        return created;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err, 'country_code');
    }
  }

  async update(
    id: string,
    input: UpdateSupplierInput,
    actor: Actor,
  ): Promise<Supplier> {
    try {
      return await this.runInTransaction(async (tx) => {
        const before = await this.repo.findByIdTx(tx, id);
        if (!before) {
          throw new AppError(404, 'ERR-SYS-02', 'Supplier tidak ditemukan.');
        }
        await this.repo.update(tx, id, input);
        const after = (await this.repo.findByIdTx(tx, id)) as Supplier;
        await this.recordActivity(tx, {
          user_id: actor.user_id,
          username: actor.username,
          action_type: ACTION_TYPE.UBAH,
          resource_type: 'suppliers',
          resource_id: id,
          old_values: before as unknown as Record<string, unknown>,
          new_values: after as unknown as Record<string, unknown>,
          device: actor.device,
          ip_address: actor.ip_address,
        });
        return after;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      return mapKnownSqlError(err, 'country_code');
    }
  }
}
