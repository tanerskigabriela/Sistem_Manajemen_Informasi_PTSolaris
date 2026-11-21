import sql from "mssql";
import type { ListOrdersQuery } from "../schemas/orders.schema";
import { BaseRepository } from "./base.repository";

// Baca: view v_order_summary (09-objects-order.sql). Tulis: sp_create_order.

export interface OrderSummary {
  order_id: string;
  order_code: string;
  order_date: string;
  deadline: string;
  finish_date: string | null;
  status: string;
  level_code: string;
  scheme: string;
  currency: string;
  exchange_rate: number;
  reject_limit_pct: number;
  is_at_risk: boolean;
  is_over_reject: boolean;
  buyer_id: string;
  buyer_code: string;
  buyer_name: string;
  handled_by: string;
  handled_by_name: string;
  style_count: number;
  total_qty: number;
  cancelled_qty: number;
  total_value: number;
  shipped_qty: number;
  remaining_shipment: number;
  created_at: Date;
}

export interface OrderHeader extends OrderSummary {
  buyer_po_no: string | null;
  late_penalty: string;
  incoterm: string | null;
  destination_country: string | null;
  destination_port: string | null;
  notes: string | null;
}

export interface OrderDetailRow {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  buyer_style_name: string | null;
  type_code: string;
  type_name: string;
  color: string;
  unit_price: number;
  discount_pct: number;
  is_at_risk: boolean;
  is_over_reject: boolean;
  completion_pct: number;
}

export interface OrderSizeRow {
  order_detail_id: string;
  size: string;
  qty: number;
  cancelled_qty: number;
}

export interface OrderHistoryRow {
  status: string;
  changed_by: string;
  changed_by_name: string;
  reason: string | null;
  changed_at: Date;
}

export interface CreateOrderResult {
  order_id: string | null;
  order_code: string | null;
  result: string;
}

const SUMMARY_COLUMNS = `
  v.order_id, v.order_code, CONVERT(CHAR(10), v.order_date, 23) AS order_date,
  CONVERT(CHAR(10), v.deadline, 23) AS deadline, CONVERT(CHAR(10), v.finish_date, 23) AS finish_date,
  v.status, v.level_code, v.scheme, v.currency, v.exchange_rate, v.reject_limit_pct,
  v.is_at_risk, v.is_over_reject, v.buyer_id, v.buyer_code, v.buyer_name,
  v.handled_by, v.handled_by_name, v.style_count, v.total_qty, v.cancelled_qty,
  v.total_value, v.shipped_qty, v.remaining_shipment, v.created_at`;

export class OrderRepository extends BaseRepository<OrderHeader> {
  constructor() {
    super("garment.orders");
  }

  // WHERE dan parameter dibuat bersama supaya tidak ada teks yang disambung ke query
  private applyFilter(request: sql.Request, filter: ListOrdersQuery): string {
    const where: string[] = [];
    if (filter.status) {
      request.input("status", sql.VarChar(20), filter.status);
      where.push("v.status = @status");
    }
    if (filter.buyer_id) {
      request.input("buyer_id", sql.UniqueIdentifier, filter.buyer_id);
      where.push("v.buyer_id = @buyer_id");
    }
    if (filter.level_code) {
      request.input("level_code", sql.VarChar(13), filter.level_code);
      where.push("v.level_code = @level_code");
    }
    if (filter.date_from) {
      request.input("date_from", sql.Date, filter.date_from);
      where.push("v.order_date >= @date_from");
    }
    if (filter.date_to) {
      request.input("date_to", sql.Date, filter.date_to);
      where.push("v.order_date <= @date_to");
    }
    if (filter.q) {
      request.input("q", sql.NVarChar(102), `%${filter.q}%`);
      where.push(
        "(v.order_code LIKE @q OR v.buyer_code LIKE @q OR v.buyer_name LIKE @q)",
      );
    }
    return where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  }

  async findAll(filter: ListOrdersQuery): Promise<OrderHeader[]> {
    const pool = await this.getPool();
    const request = pool.request();
    const where = this.applyFilter(request, filter);
    request.input("offset", sql.Int, (filter.page - 1) * filter.per_page);
    request.input("per_page", sql.Int, filter.per_page);
    const result = await request.query<OrderHeader>(`
      SELECT ${SUMMARY_COLUMNS}
      FROM garment.v_order_summary v
      ${where}
      ORDER BY v.created_at DESC, v.order_code DESC
      OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY`);
    return result.recordset;
  }

  async count(filter: ListOrdersQuery): Promise<number> {
    const pool = await this.getPool();
    const request = pool.request();
    const where = this.applyFilter(request, filter);
    const result = await request.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM garment.v_order_summary v ${where}`,
    );
    return result.recordset[0]?.total ?? 0;
  }

  async findById(id: string): Promise<OrderHeader | null> {
    const pool = await this.getPool();
    const result = await pool.request().input("id", sql.UniqueIdentifier, id)
      .query<OrderHeader>(`
        SELECT ${SUMMARY_COLUMNS},
               o.buyer_po_no, o.late_penalty, o.incoterm, o.destination_country,
               o.destination_port, o.notes
        FROM garment.v_order_summary v
        JOIN garment.orders o ON o.id = v.order_id
        WHERE v.order_id = @id`);
    return result.recordset[0] ?? null;
  }

  async findDetails(
    orderId: string,
  ): Promise<{ details: OrderDetailRow[]; sizes: OrderSizeRow[] }> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input("order_id", sql.UniqueIdentifier, orderId).query(`
        SELECT d.id, d.item_id, i.item_code, i.item_name, i.buyer_style_name,
               i.type_code, p.type_name, d.color, d.unit_price, d.discount_pct,
               d.is_at_risk, d.is_over_reject,
               garment.fn_detail_completion_pct(d.id) AS completion_pct
        FROM garment.order_details d
        JOIN garment.items i ON i.id = d.item_id
        JOIN garment.product_types p ON p.type_code = i.type_code
        WHERE d.order_id = @order_id
        ORDER BY i.item_code, d.color;

        SELECT z.order_detail_id, z.size, z.qty, z.cancelled_qty
        FROM garment.order_detail_sizes z
        JOIN garment.order_details d ON d.id = z.order_detail_id
        WHERE d.order_id = @order_id;`);
    const sets = result.recordsets as unknown as [
      OrderDetailRow[],
      OrderSizeRow[],
    ];
    return { details: sets[0], sizes: sets[1] };
  }

  async findHistory(orderId: string): Promise<OrderHistoryRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input("order_id", sql.UniqueIdentifier, orderId).query<OrderHistoryRow>(`
        SELECT h.status, h.changed_by, e.full_name AS changed_by_name, h.reason, h.changed_at
        FROM garment.order_status_history h
        JOIN garment.employees e ON e.id = h.changed_by
        WHERE h.order_id = @order_id
        ORDER BY h.changed_at, h.id`);
    return result.recordset;
  }

  async create(
    tx: sql.Transaction,
    employeeId: string,
    payload: string,
  ): Promise<CreateOrderResult> {
    const result = await new sql.Request(tx)
      .input("employee_id", sql.UniqueIdentifier, employeeId)
      .input("payload", sql.NVarChar(sql.MAX), payload)
      .output("order_id", sql.UniqueIdentifier)
      .output("order_code", sql.Char(12))
      .output("result", sql.VarChar(20))
      .execute("garment.sp_create_order");
    const out = result.output as {
      order_id: string | null;
      order_code: string | null;
      result: string | null;
    };
    return {
      order_id: out.order_id,
      order_code: out.order_code,
      result: out.result ?? "UNKNOWN",
    };
  }
}
