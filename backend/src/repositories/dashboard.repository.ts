import sql from 'mssql';
import type { DashboardQuery } from '../schemas/shipments.schema';
import { BaseRepository } from './base.repository';

// Dashboard Pimpinan (FSD 2.14) dari view v_dashboard_orders (09), yang memakai fungsi progres milik C.

export interface DashboardRow {
  order_id: string;
  order_code: string;
  buyer_name: string;
  deadline: string;
  status: string;
  completion_pct: number;
  time_pct: number;
  reject_pct: number;
  is_at_risk: boolean;
  is_over_reject: boolean;
  remaining_shipment: number;
}

export class DashboardRepository extends BaseRepository<DashboardRow> {
  constructor() {
    super('garment.v_dashboard_orders');
  }

  // Order berisiko tampil paling atas, lalu yang deadline-nya paling dekat
  async findAll(options: { filters?: DashboardQuery } = {}): Promise<DashboardRow[]> {
    const pool = await this.getPool();
    const request = pool.request();
    let where = '';
    if (options.filters?.status) {
      request.input('status', sql.VarChar(20), options.filters.status);
      where = 'WHERE status = @status';
    }
    const result = await request.query<DashboardRow>(`
      SELECT order_id, order_code, buyer_name, CONVERT(CHAR(10), deadline, 23) AS deadline, status,
             completion_pct, time_pct, reject_pct, is_at_risk, is_over_reject, remaining_shipment
      FROM garment.v_dashboard_orders ${where}
      ORDER BY is_at_risk DESC, is_over_reject DESC, deadline ASC`);
    return result.recordset;
  }

  async findById(orderId: string): Promise<DashboardRow | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, orderId)
      .query<DashboardRow>(`
        SELECT order_id, order_code, buyer_name, CONVERT(CHAR(10), deadline, 23) AS deadline, status,
               completion_pct, time_pct, reject_pct, is_at_risk, is_over_reject, remaining_shipment
        FROM garment.v_dashboard_orders WHERE order_id = @id`);
    return result.recordset[0] ?? null;
  }
}
