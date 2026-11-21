import { asc, eq, isNull, or } from 'drizzle-orm';
import sql from 'mssql';
import { defect_types, qc_standards } from '../db/schema';
import type {
  ListProductionLinesQuery,
  ListQcStandardsQuery,
  ListRawMaterialsQuery,
} from '../schemas/master-produksi.schema';
import { BaseRepository, type FindAllOptions } from './base.repository';

export interface RawMaterialRow {
  id: string;
  material_code: string;
  material_name: string;
  category_id: string;
  category_name: string;
  specification: string | null;
  color: string | null;
  unit: string;
}

export interface ProductionLineRow {
  id: string;
  line_name: string;
  capacity_pcs_per_day: number;
  factory_id: string;
  factory_name: string;
  supervisor_id: string;
  supervisor_name: string;
}

export type DefectType = typeof defect_types.$inferSelect;
export type QcStandard = typeof qc_standards.$inferSelect;

/** Bahan baku master (garment.raw_materials) untuk dropdown form bahan. */
export class RawMaterialRepository extends BaseRepository<RawMaterialRow> {
  constructor() {
    super('garment.raw_materials');
  }

  async findById(id: string): Promise<RawMaterialRow | null> {
    const rows = await this.query({}, id);
    return rows[0] ?? null;
  }

  findAll(options?: FindAllOptions & ListRawMaterialsQuery): Promise<RawMaterialRow[]> {
    return this.query(options ?? {});
  }

  private async query(
    filter: ListRawMaterialsQuery,
    id?: string,
  ): Promise<RawMaterialRow[]> {
    const pool = await this.getPool();
    const request = pool.request();
    const where: string[] = [];

    if (id) {
      where.push('rm.id = @id');
      request.input('id', sql.UniqueIdentifier, id);
    }
    if (filter.category_id) {
      where.push('rm.category_id = @category_id');
      request.input('category_id', sql.UniqueIdentifier, filter.category_id);
    }
    if (filter.search) {
      where.push('(rm.material_name LIKE @search OR rm.material_code LIKE @search)');
      request.input('search', sql.NVarChar(102), `%${filter.search}%`);
    }

    const result = await request.query<RawMaterialRow>(
      `SELECT rm.id, rm.material_code, rm.material_name, rm.category_id, mc.category_name,
              rm.specification, rm.color, rm.unit
       FROM garment.raw_materials rm
       JOIN garment.material_categories mc ON mc.id = rm.category_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY mc.category_name, rm.material_name`,
    );
    return result.recordset;
  }
}

/** Lini produksi untuk dropdown form SPK. */
export class ProductionLineRepository extends BaseRepository<ProductionLineRow> {
  constructor() {
    super('garment.production_lines');
  }

  async findById(id: string): Promise<ProductionLineRow | null> {
    const rows = await this.query({}, id);
    return rows[0] ?? null;
  }

  findAll(options?: FindAllOptions & ListProductionLinesQuery): Promise<ProductionLineRow[]> {
    return this.query(options ?? {});
  }

  private async query(
    filter: ListProductionLinesQuery,
    id?: string,
  ): Promise<ProductionLineRow[]> {
    const pool = await this.getPool();
    const request = pool.request();
    const where: string[] = [];

    if (id) {
      where.push('l.id = @id');
      request.input('id', sql.UniqueIdentifier, id);
    }
    if (filter.order_detail_id) {
      where.push(
        `l.factory_id = (SELECT o.factory_id FROM garment.order_details d
                         JOIN garment.orders o ON o.id = d.order_id
                         WHERE d.id = @order_detail_id)`,
      );
      request.input('order_detail_id', sql.UniqueIdentifier, filter.order_detail_id);
    }

    const result = await request.query<ProductionLineRow>(
      `SELECT l.id, l.line_name, l.capacity_pcs_per_day,
              l.factory_id, f.factory_name,
              l.supervisor_id, e.full_name AS supervisor_name
       FROM garment.production_lines l
       JOIN garment.factories f ON f.id = l.factory_id
       JOIN garment.employees e ON e.id = l.supervisor_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY f.factory_name, l.line_name`,
    );
    return result.recordset;
  }
}

/** Jenis cacat untuk form hasil QC. */
export class DefectTypeRepository extends BaseRepository<DefectType> {
  constructor() {
    super('garment.defect_types');
  }

  async findById(id: string): Promise<DefectType | null> {
    const db = await this.getDb();
    const rows = await db.select().from(defect_types).where(eq(defect_types.id, id));
    return rows[0] ?? null;
  }

  async findAll(): Promise<DefectType[]> {
    const db = await this.getDb();
    return db.select().from(defect_types).orderBy(asc(defect_types.defect_name));
  }
}

/** Standar QC: yang khusus jenis produk + yang berlaku umum (type_code NULL). */
export class QcStandardRepository extends BaseRepository<QcStandard> {
  constructor() {
    super('garment.qc_standards');
  }

  async findById(id: string): Promise<QcStandard | null> {
    const db = await this.getDb();
    const rows = await db.select().from(qc_standards).where(eq(qc_standards.id, id));
    return rows[0] ?? null;
  }

  async findAll(options?: FindAllOptions & ListQcStandardsQuery): Promise<QcStandard[]> {
    const db = await this.getDb();
    return db
      .select()
      .from(qc_standards)
      .where(
        options?.type_code
          ? or(eq(qc_standards.type_code, options.type_code), isNull(qc_standards.type_code))
          : undefined,
      )
      .orderBy(asc(qc_standards.parameter_name));
  }
}
