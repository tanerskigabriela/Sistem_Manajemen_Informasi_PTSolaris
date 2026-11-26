import sql from 'mssql';
import { ORDER_LEVEL } from '../constants';
import type { CreateShipmentInput, ListShipmentsQuery } from '../schemas/shipments.schema';
import { BaseRepository } from './base.repository';

// Pengiriman (FSD 2.15). Tulis lewat sp_record_shipment, baca dari tabel shipments dan v_shipment_history (09).

export interface Expedition {
  id: string;
  expedition_name: string;
  partner_type: string;
  coverage: string;
  contact_name: string;
  phone: string;
  email: string | null;
}

export interface ShipmentRow {
  id: string;
  delivery_note_no: string;
  ship_date: string;
  status: string;
  order_id: string;
  order_code: string;
  buyer_name: string;
  expedition_name: string;
  destination_address: string;
  estimated_arrival: string | null;
  arrival_date: string | null;
  line_count: number;
  total_qty: number;
  created_at: Date;
}

export interface ReadyToShipOrder {
  order_id: string;
  order_code: string;
  status: string;
  level_code: string;
  buyer_name: string;
  buyer_address: string;
  buyer_city: string;
}

export interface ReadyToShipRow {
  order_detail_id: string;
  item_code: string;
  item_name: string;
  buyer_style_name: string | null;
  color: string;
  size: string;
  ordered_qty: number;
  shipped_qty: number;
  ready_qty: number;
  style_ready_qty: number;
}

export interface DeliveryNoteHeader {
  id: string;
  delivery_note_no: string;
  ship_date: string;
  estimated_arrival: string | null;
  status: string;
  destination_address: string;
  package_count: number | null;
  total_weight_kg: number | null;
  volume_m3: number | null;
  order_code: string;
  buyer_po_no: string | null;
  buyer_name: string;
  buyer_phone: string;
  factory_name: string;
  factory_address: string;
  factory_city: string;
  factory_phone: string;
  warehouse_name: string;
  warehouse_address: string;
  expedition_name: string;
  expedition_contact: string;
  expedition_phone: string;
  plate_no: string | null;
  recorded_by_name: string;
}

export interface DeliveryNoteLine {
  line_no: number;
  item_code: string;
  item_name: string;
  buyer_style_name: string | null;
  color: string;
  size: string;
  qty: number;
  carton_no: string | null;
}

export interface RecordShipmentResult {
  shipment_id: string | null;
  delivery_note_no: string | null;
  result: string;
}

const LIST_COLUMNS = `
  sh.id, sh.delivery_note_no, CONVERT(CHAR(10), sh.ship_date, 23) AS ship_date, sh.status,
  o.id AS order_id, o.order_code, b.buyer_name, ex.expedition_name, sh.destination_address,
  CONVERT(CHAR(10), sh.estimated_arrival, 23) AS estimated_arrival,
  CONVERT(CHAR(10), sh.arrival_date, 23) AS arrival_date,
  (SELECT COUNT(*) FROM garment.shipment_items si WHERE si.shipment_id = sh.id) AS line_count,
  (SELECT ISNULL(SUM(si.qty), 0) FROM garment.shipment_items si WHERE si.shipment_id = sh.id) AS total_qty,
  sh.created_at`;

const LIST_FROM = `
  FROM garment.shipments sh
  JOIN garment.orders o ON o.id = sh.order_id
  JOIN garment.buyers b ON b.id = o.buyer_id
  JOIN garment.expeditions ex ON ex.id = sh.expedition_id`;

export class ExpeditionRepository extends BaseRepository<Expedition> {
  constructor() {
    super('garment.expeditions');
  }

  // Ekspedisi aktif. Bila level order dikirim, hanya yang cakupannya sesuai (aturan sama dengan sp_record_shipment).
  async findAll(options: { filters?: { level_code?: string } } = {}): Promise<Expedition[]> {
    const pool = await this.getPool();
    const request = pool.request();
    let where = 'WHERE is_active = 1';
    const level = options.filters?.level_code;
    if (level) {
      request.input('excluded', sql.VarChar(13), level === ORDER_LEVEL.DOMESTIK ? 'INTERNASIONAL' : 'DOMESTIK');
      where += ' AND coverage <> @excluded';
    }
    const result = await request.query<Expedition>(`
      SELECT id, expedition_name, partner_type, coverage, contact_name, phone, email
      FROM garment.expeditions ${where}
      ORDER BY expedition_name`);
    return result.recordset;
  }

  async findById(id: string): Promise<Expedition | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<Expedition>(`
        SELECT id, expedition_name, partner_type, coverage, contact_name, phone, email
        FROM garment.expeditions WHERE id = @id`);
    return result.recordset[0] ?? null;
  }
}

export class ShipmentRepository extends BaseRepository<ShipmentRow> {
  constructor() {
    super('garment.shipments');
  }

  private applyFilter(request: sql.Request, filter: ListShipmentsQuery): string {
    const where: string[] = [];
    if (filter.order_id) {
      request.input('order_id', sql.UniqueIdentifier, filter.order_id);
      where.push('sh.order_id = @order_id');
    }
    if (filter.date_from) {
      request.input('date_from', sql.Date, filter.date_from);
      where.push('sh.ship_date >= @date_from');
    }
    if (filter.date_to) {
      request.input('date_to', sql.Date, filter.date_to);
      where.push('sh.ship_date <= @date_to');
    }
    if (filter.q) {
      request.input('q', sql.NVarChar(102), `%${filter.q}%`);
      where.push('(sh.delivery_note_no LIKE @q OR o.order_code LIKE @q OR b.buyer_name LIKE @q)');
    }
    return where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  }

  async findAll(filter: ListShipmentsQuery): Promise<ShipmentRow[]> {
    const pool = await this.getPool();
    const request = pool.request();
    const where = this.applyFilter(request, filter);
    request.input('offset', sql.Int, (filter.page - 1) * filter.per_page);
    request.input('per_page', sql.Int, filter.per_page);
    const result = await request.query<ShipmentRow>(`
      SELECT ${LIST_COLUMNS} ${LIST_FROM} ${where}
      ORDER BY sh.ship_date DESC, sh.delivery_note_no DESC
      OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY`);
    return result.recordset;
  }

  async count(filter: ListShipmentsQuery): Promise<number> {
    const pool = await this.getPool();
    const request = pool.request();
    const where = this.applyFilter(request, filter);
    const result = await request.query<{ total: number }>(`SELECT COUNT(*) AS total ${LIST_FROM} ${where}`);
    return result.recordset[0]?.total ?? 0;
  }

  async findById(id: string): Promise<ShipmentRow | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<ShipmentRow>(`SELECT ${LIST_COLUMNS} ${LIST_FROM} WHERE sh.id = @id`);
    return result.recordset[0] ?? null;
  }

  // Sisa barang siap kirim per style per ukuran (fn_ready_to_ship milik C)
  async readyToShip(orderId: string): Promise<{ order: ReadyToShipOrder | null; rows: ReadyToShipRow[] }> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('order_id', sql.UniqueIdentifier, orderId)
      .query(`
        SELECT o.id AS order_id, o.order_code, o.status, o.level_code, b.buyer_name,
               b.address AS buyer_address, b.city AS buyer_city
        FROM garment.orders o
        JOIN garment.buyers b ON b.id = o.buyer_id
        WHERE o.id = @order_id;

        SELECT d.id AS order_detail_id, i.item_code, i.item_name, i.buyer_style_name, d.color, z.size,
               z.qty - z.cancelled_qty AS ordered_qty,
               ISNULL((SELECT SUM(si.qty) FROM garment.shipment_items si
                       WHERE si.order_detail_id = d.id AND si.size = z.size), 0) AS shipped_qty,
               garment.fn_ready_to_ship(d.id, z.size) AS ready_qty,
               garment.fn_ready_to_ship(d.id, NULL) AS style_ready_qty
        FROM garment.order_details d
        JOIN garment.items i ON i.id = d.item_id
        JOIN garment.order_detail_sizes z ON z.order_detail_id = d.id
        WHERE d.order_id = @order_id
        ORDER BY i.item_code, d.color, z.size;`);
    const sets = result.recordsets as unknown as [ReadyToShipOrder[], ReadyToShipRow[]];
    return { order: sets[0][0] ?? null, rows: sets[1] };
  }

  // Data surat jalan SCR-17. Sengaja tanpa harga (RB: surat jalan tidak memuat nilai barang).
  async deliveryNote(id: string): Promise<{ header: DeliveryNoteHeader | null; lines: DeliveryNoteLine[] }> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`
        SELECT sh.id, sh.delivery_note_no, CONVERT(CHAR(10), sh.ship_date, 23) AS ship_date,
               CONVERT(CHAR(10), sh.estimated_arrival, 23) AS estimated_arrival, sh.status,
               sh.destination_address, sh.package_count, sh.total_weight_kg, sh.volume_m3,
               o.order_code, o.buyer_po_no, b.buyer_name, b.phone AS buyer_phone,
               f.factory_name, f.address AS factory_address, f.city AS factory_city, f.phone AS factory_phone,
               w.warehouse_name, w.address AS warehouse_address,
               ex.expedition_name, ex.contact_name AS expedition_contact, ex.phone AS expedition_phone,
               v.plate_no, e.full_name AS recorded_by_name
        FROM garment.shipments sh
        JOIN garment.orders o ON o.id = sh.order_id
        JOIN garment.buyers b ON b.id = o.buyer_id
        JOIN garment.factories f ON f.id = o.factory_id
        JOIN garment.warehouses w ON w.id = sh.origin_warehouse_id
        JOIN garment.expeditions ex ON ex.id = sh.expedition_id
        LEFT JOIN garment.vehicles v ON v.id = sh.vehicle_id
        JOIN garment.employees e ON e.id = sh.recorded_by
        WHERE sh.id = @id;

        SELECT h.line_no, h.item_code, h.item_name, h.buyer_style_name, h.color, h.size, h.qty, h.carton_no
        FROM garment.v_shipment_history h
        WHERE h.shipment_id = @id
        ORDER BY h.line_no;`);
    const sets = result.recordsets as unknown as [DeliveryNoteHeader[], DeliveryNoteLine[]];
    return { header: sets[0][0] ?? null, lines: sets[1] };
  }

  async itemCode(orderDetailId: string): Promise<string | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, orderDetailId)
      .query<{ item_code: string }>(`
        SELECT i.item_code FROM garment.order_details d
        JOIN garment.items i ON i.id = d.item_id WHERE d.id = @id`);
    return result.recordset[0]?.item_code ?? null;
  }

  async create(tx: sql.Transaction, employeeId: string, input: CreateShipmentInput): Promise<RecordShipmentResult> {
    const result = await new sql.Request(tx)
      .input('order_id', sql.UniqueIdentifier, input.order_id)
      .input('employee_id', sql.UniqueIdentifier, employeeId)
      .input('ship_date', sql.Date, input.ship_date)
      .input('expedition_id', sql.UniqueIdentifier, input.expedition_id)
      .input('destination_address', sql.NVarChar(200), input.destination_address)
      .input('items', sql.NVarChar(sql.MAX), JSON.stringify(input.items))
      .input('route_id', sql.UniqueIdentifier, input.route_id ?? null)
      .input('vehicle_id', sql.UniqueIdentifier, input.vehicle_id ?? null)
      .input('estimated_arrival', sql.Date, input.estimated_arrival ?? null)
      .input('package_count', sql.Int, input.package_count ?? null)
      .input('total_weight_kg', sql.Decimal(10, 2), input.total_weight_kg ?? null)
      .input('volume_m3', sql.Decimal(10, 2), input.volume_m3 ?? null)
      .input('shipping_cost', sql.Decimal(16, 2), input.shipping_cost ?? null)
      .output('shipment_id', sql.UniqueIdentifier)
      .output('delivery_note_no', sql.Char(11))
      .output('result', sql.NVarChar(200))
      .execute('garment.sp_record_shipment');
    const out = result.output as Partial<RecordShipmentResult>;
    return {
      shipment_id: out.shipment_id ?? null,
      delivery_note_no: out.delivery_note_no ?? null,
      result: out.result ?? 'UNKNOWN',
    };
  }
}
