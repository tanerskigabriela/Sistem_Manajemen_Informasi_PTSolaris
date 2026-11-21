import { and, asc, eq, like, or } from 'drizzle-orm';
import sql from 'mssql';
import { suppliers } from '../db/schema';
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
} from '../schemas/supplier.schema';
import { BaseRepository, type FindAllOptions } from './base.repository';

export type Supplier = typeof suppliers.$inferSelect;

export interface SupplierMaterialRow {
  supplier_id: string;
  supplier_name: string;
  payment_term: string;
  order_code: string;
  item_code: string;
  color: string;
  material_code: string;
  material_name: string;
  qty: number;
  unit: string;
  material_price: number | null;
  received_date: string;
}

const WRITABLE_COLUMNS = [
  'supplier_name',
  'supplier_type',
  'country_code',
  'contact_name',
  'phone',
  'email',
  'address',
  'city',
  'currency',
  'tax_id_no',
  'rating',
  'payment_term',
  'payment_term_days',
  'is_active',
] as const;

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor() {
    super('garment.suppliers');
  }

  async findById(id: string): Promise<Supplier | null> {
    const db = await this.getDb();
    const rows = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return rows[0] ?? null;
  }

  async findAll(options?: FindAllOptions & ListSuppliersQuery): Promise<Supplier[]> {
    const db = await this.getDb();
    const conditions = [];

    if (options?.search) {
      const pattern = `%${options.search}%`;
      conditions.push(
        or(like(suppliers.supplier_name, pattern), like(suppliers.city, pattern)),
      );
    }
    if (options?.is_active !== undefined) {
      conditions.push(eq(suppliers.is_active, options.is_active === 'true'));
    }

    return db
      .select()
      .from(suppliers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(suppliers.supplier_name));
  }

  /** Bahan yang pernah dipasok supplier ke order (view v_supplier_materials). */
  async findMaterials(supplierId: string): Promise<SupplierMaterialRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('supplier_id', sql.UniqueIdentifier, supplierId)
      .query<SupplierMaterialRow>(
        `SELECT supplier_id, supplier_name, payment_term, order_code, item_code, color,
                material_code, material_name, qty, unit, material_price,
                CONVERT(VARCHAR(10), received_date, 23) AS received_date
         FROM garment.v_supplier_materials
         WHERE supplier_id = @supplier_id
         ORDER BY received_date DESC`,
      );
    return result.recordset;
  }

  async create(tx: sql.Transaction, input: CreateSupplierInput): Promise<string> {
    const request = new sql.Request(tx);
    const columns: string[] = [];
    const values: string[] = [];

    for (const col of WRITABLE_COLUMNS) {
      const value = (input as Record<string, unknown>)[col];
      if (value === undefined) continue;
      columns.push(col);
      values.push(`@${col}`);
      request.input(col, value ?? null);
    }

    const result = await request.query<{ id: string }>(
      `DECLARE @new TABLE (id UNIQUEIDENTIFIER);
       INSERT INTO garment.suppliers (${columns.join(', ')})
       OUTPUT inserted.id INTO @new
       VALUES (${values.join(', ')});
       SELECT id FROM @new;`,
    );
    return result.recordset[0].id;
  }

  async update(
    tx: sql.Transaction,
    id: string,
    input: UpdateSupplierInput,
  ): Promise<void> {
    const request = new sql.Request(tx).input('id', sql.UniqueIdentifier, id);
    const sets: string[] = [];

    for (const col of WRITABLE_COLUMNS) {
      const value = (input as Record<string, unknown>)[col];
      if (value === undefined) continue;
      sets.push(`${col} = @${col}`);
      request.input(col, value ?? null);
    }

    await request.query(
      `UPDATE garment.suppliers SET ${sets.join(', ')} WHERE id = @id;`,
    );
  }

  /** Baca ulang di dalam transaksi (untuk old_values / new_values log aktivitas). */
  async findByIdTx(tx: sql.Transaction, id: string): Promise<Supplier | null> {
    const result = await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, id)
      .query<Supplier>('SELECT * FROM garment.suppliers WHERE id = @id');
    return result.recordset[0] ?? null;
  }
}
