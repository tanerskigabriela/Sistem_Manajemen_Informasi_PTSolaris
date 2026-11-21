import sql from 'mssql';
import type { CreateOrderMaterialInput } from '../schemas/order-material.schema';
import { BaseRepository } from './base.repository';

export interface OrderDetailHeader {
  order_detail_id: string;
  order_id: string;
  order_code: string;
  order_status: string;
  item_code: string;
  item_name: string;
  color: string;
  readiness: 'SIAP' | 'BELUM_SIAP';
  locked: boolean;
}

export interface OrderMaterialRow {
  id: string;
  order_detail_id: string;
  material_id: string;
  material_code: string;
  material_name: string;
  qty: number;
  unit: string;
  source: 'BUYER' | 'SUPPLIER';
  supplier_id: string | null;
  supplier_name: string | null;
  material_price: number | null;
  received_date: string;
  checked_by_name: string;
  checked_at: Date;
}

export interface MaterialRequirementRow {
  material_id: string;
  material_code: string;
  material_name: string;
  unit: string;
  qty_per_pcs: number;
  waste_tolerance_pct: number;
  order_qty: number;
  required_qty: number;
  recorded_qty: number;
  shortage_qty: number;
}

const SELECT_MATERIAL = `
  SELECT om.id, om.order_detail_id, om.material_id, rm.material_code, rm.material_name,
         om.qty, om.unit, om.source, om.supplier_id, sp.supplier_name, om.material_price,
         CONVERT(VARCHAR(10), om.received_date, 23) AS received_date,
         e.full_name AS checked_by_name, om.checked_at
  FROM garment.order_materials om
  JOIN garment.raw_materials rm ON rm.id = om.material_id
  LEFT JOIN garment.suppliers sp ON sp.id = om.supplier_id
  JOIN garment.employees e ON e.id = om.checked_by`;

export class OrderMaterialRepository extends BaseRepository<OrderMaterialRow> {
  constructor() {
    super('garment.order_materials');
  }

  async findById(id: string, tx?: sql.Transaction): Promise<OrderMaterialRow | null> {
    const request = tx ? new sql.Request(tx) : (await this.getPool()).request();
    const result = await request
      .input('id', sql.UniqueIdentifier, id)
      .query<OrderMaterialRow>(`${SELECT_MATERIAL} WHERE om.id = @id`);
    return result.recordset[0] ?? null;
  }

  /** Tidak dipakai langsung; daftar bahan selalu per style (findByOrderDetail). */
  async findAll(): Promise<OrderMaterialRow[]> {
    return [];
  }

  async findByOrderDetail(orderDetailId: string): Promise<OrderMaterialRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('order_detail_id', sql.UniqueIdentifier, orderDetailId)
      .query<OrderMaterialRow>(
        `${SELECT_MATERIAL} WHERE om.order_detail_id = @order_detail_id
         ORDER BY om.checked_at`,
      );
    return result.recordset;
  }

  /** Kepala style + status kesiapan bahan (fn_material_readiness) + kunci (fn_material_locked). */
  async findHeader(
    orderDetailId: string,
    tx?: sql.Transaction,
  ): Promise<OrderDetailHeader | null> {
    const request = tx ? new sql.Request(tx) : (await this.getPool()).request();
    const result = await request
      .input('order_detail_id', sql.UniqueIdentifier, orderDetailId)
      .query<OrderDetailHeader>(
        `SELECT d.id AS order_detail_id, o.id AS order_id, o.order_code, o.status AS order_status,
                i.item_code, i.item_name, d.color,
                garment.fn_material_readiness(d.id) AS readiness,
                CAST(garment.fn_material_locked(d.id) AS BIT) AS locked
         FROM garment.order_details d
         JOIN garment.orders o ON o.id = d.order_id
         JOIN garment.items i  ON i.id = d.item_id
         WHERE d.id = @order_detail_id`,
      );
    return result.recordset[0] ?? null;
  }

  async findRequirement(orderDetailId: string): Promise<MaterialRequirementRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('order_detail_id', sql.UniqueIdentifier, orderDetailId)
      .query<MaterialRequirementRow>(
        `SELECT * FROM garment.fn_material_requirement(@order_detail_id)
         ORDER BY material_name`,
      );
    return result.recordset;
  }

  async getRawMaterialUnit(tx: sql.Transaction, materialId: string): Promise<string | null> {
    const result = await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, materialId)
      .query<{ unit: string }>('SELECT unit FROM garment.raw_materials WHERE id = @id');
    return result.recordset[0]?.unit ?? null;
  }

  async insert(
    tx: sql.Transaction,
    orderDetailId: string,
    input: CreateOrderMaterialInput & { unit: string },
    checkedBy: string,
  ): Promise<string> {
    const result = await new sql.Request(tx)
      .input('order_detail_id', sql.UniqueIdentifier, orderDetailId)
      .input('material_id', sql.UniqueIdentifier, input.material_id)
      .input('qty', sql.Decimal(12, 2), input.qty)
      .input('unit', sql.NVarChar(20), input.unit)
      .input('source', sql.VarChar(8), input.source)
      .input('supplier_id', sql.UniqueIdentifier, input.source === 'SUPPLIER' ? input.supplier_id : null)
      .input('material_price', sql.Decimal(16, 2), input.source === 'SUPPLIER' ? input.material_price : null)
      .input('received_date', sql.Date, input.received_date)
      .input('checked_by', sql.UniqueIdentifier, checkedBy)
      .query<{ id: string }>(
        `DECLARE @new TABLE (id UNIQUEIDENTIFIER);
         INSERT INTO garment.order_materials
           (order_detail_id, material_id, qty, unit, source, supplier_id, material_price, received_date, checked_by)
         OUTPUT inserted.id INTO @new
         VALUES (@order_detail_id, @material_id, @qty, @unit, @source, @supplier_id, @material_price, @received_date, @checked_by);
         SELECT id FROM @new;`,
      );
    return result.recordset[0].id;
  }

  async update(
    tx: sql.Transaction,
    id: string,
    data: {
      material_id: string;
      qty: number;
      unit: string;
      source: string;
      supplier_id: string | null;
      material_price: number | null;
      received_date: string;
    },
    checkedBy: string,
  ): Promise<void> {
    await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, id)
      .input('material_id', sql.UniqueIdentifier, data.material_id)
      .input('qty', sql.Decimal(12, 2), data.qty)
      .input('unit', sql.NVarChar(20), data.unit)
      .input('source', sql.VarChar(8), data.source)
      .input('supplier_id', sql.UniqueIdentifier, data.supplier_id)
      .input('material_price', sql.Decimal(16, 2), data.material_price)
      .input('received_date', sql.Date, data.received_date)
      .input('checked_by', sql.UniqueIdentifier, checkedBy)
      .query(
        `UPDATE garment.order_materials
         SET material_id = @material_id, qty = @qty, unit = @unit, source = @source,
             supplier_id = @supplier_id, material_price = @material_price,
             received_date = @received_date, checked_by = @checked_by,
             checked_at = SYSDATETIME(), updated_at = SYSDATETIME()
         WHERE id = @id;`,
      );
  }
}
