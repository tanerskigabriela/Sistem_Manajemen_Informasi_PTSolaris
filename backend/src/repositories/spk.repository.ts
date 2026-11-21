import sql from 'mssql';
import type { ListSpkQuery } from '../schemas/spk.schema';
import { BaseRepository, type FindAllOptions } from './base.repository';

export interface SpkListRow {
  spk_id: string;
  spk_no: string;
  order_id: string;
  order_code: string;
  order_status: string;
  order_detail_id: string;
  item_code: string;
  item_name: string;
  color: string;
  line_name: string;
  total_qty: number;
  target_date: string;
  status: string;
  approved_at: Date | null;
  created_at: Date;
}

export interface SpkDetailExtra {
  line_id: string;
  created_by_name: string;
  decided_by_name: string | null;
  reject_reason: string | null;
}

export interface SpkStageRow {
  stage_code: string;
  stage_name: string;
  sequence: number;
  cumulative_done: number;
  cumulative_passed: number | null;
  max_allowed: number;
  remaining: number;
}

export interface SubmitSpkSpResult {
  result: string;
  spk_id: string | null;
  spk_no: string | null;
}

const SELECT_LIST = `
  SELECT spk_id, spk_no, order_id, order_code, order_status, order_detail_id,
         item_code, item_name, color, line_name, total_qty,
         CONVERT(VARCHAR(10), target_date, 23) AS target_date,
         status, approved_at, created_at
  FROM garment.v_spk_list`;

export class SpkRepository extends BaseRepository<SpkListRow> {
  constructor() {
    super('garment.spk');
  }

  async findById(id: string): Promise<SpkListRow | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<SpkListRow>(`${SELECT_LIST} WHERE spk_id = @id`);
    return result.recordset[0] ?? null;
  }

  async findAll(options?: FindAllOptions & Partial<ListSpkQuery>): Promise<SpkListRow[]> {
    return (await this.findPage(options ?? {})).rows;
  }

  async findPage(
    options: Partial<ListSpkQuery>,
  ): Promise<{ rows: SpkListRow[]; total: number }> {
    const page = options.page ?? 1;
    const perPage = options.per_page ?? 10;
    const pool = await this.getPool();
    const where: string[] = [];

    const bind = (req: sql.Request) => {
      if (options.status) req.input('status', sql.VarChar(20), options.status);
      if (options.order_id) req.input('order_id', sql.UniqueIdentifier, options.order_id);
      return req;
    };
    if (options.status) where.push('status = @status');
    if (options.order_id) where.push('order_id = @order_id');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await bind(pool.request()).query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM garment.v_spk_list ${whereSql}`,
    );
    const rowsResult = await bind(pool.request())
      .input('offset', sql.Int, (page - 1) * perPage)
      .input('per_page', sql.Int, perPage)
      .query<SpkListRow>(
        `${SELECT_LIST} ${whereSql}
         ORDER BY created_at DESC
         OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY`,
      );

    return { rows: rowsResult.recordset, total: countResult.recordset[0].total };
  }

  async findDetailExtra(id: string): Promise<SpkDetailExtra | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<SpkDetailExtra>(
        `SELECT s.line_id, c.full_name AS created_by_name, d.full_name AS decided_by_name,
                s.reject_reason
         FROM garment.spk s
         JOIN garment.employees c      ON c.id = s.created_by
         LEFT JOIN garment.employees d ON d.id = s.decided_by
         WHERE s.id = @id`,
      );
    return result.recordset[0] ?? null;
  }

  async findSizes(id: string): Promise<{ size: string; qty: number }[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<{ size: string; qty: number }>(
        'SELECT size, qty FROM garment.spk_sizes WHERE spk_id = @id ORDER BY size',
      );
    return result.recordset;
  }

  /** Kumulatif per tahap + sisa pekerjaan (RB-37, RB-39). PACKING tidak punya QC (RB-41). */
  async findStages(id: string): Promise<SpkStageRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<SpkStageRow>(
        `SELECT x.stage_code, x.stage_name, x.[sequence], x.cumulative_done, x.cumulative_passed,
                x.max_allowed,
                CASE WHEN x.max_allowed > x.cumulative_done
                     THEN x.max_allowed - x.cumulative_done ELSE 0 END AS remaining
         FROM (
           SELECT ps.stage_code, ps.stage_name, ps.[sequence],
                  ISNULL((SELECT SUM(p.qty_done) FROM garment.production_progress p
                          WHERE p.spk_id = @id AND p.stage_code = ps.stage_code), 0) AS cumulative_done,
                  CASE WHEN ps.stage_code = 'PACKING' THEN NULL
                       ELSE ISNULL((SELECT SUM(q.qty_passed) FROM garment.qc_results q
                                    WHERE q.spk_id = @id AND q.stage_code = ps.stage_code
                                      AND q.inspection_type IN ('INLINE','FINAL')), 0)
                  END AS cumulative_passed,
                  garment.fn_stage_max_allowed(@id, ps.stage_code) AS max_allowed
           FROM garment.production_stages ps
         ) x
         ORDER BY x.[sequence]`,
      );
    return result.recordset;
  }

  async getOrderStatus(tx: sql.Transaction, spkId: string): Promise<string | null> {
    const result = await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, spkId)
      .query<{ status: string }>(
        `SELECT o.status FROM garment.spk s
         JOIN garment.order_details d ON d.id = s.order_detail_id
         JOIN garment.orders o        ON o.id = d.order_id
         WHERE s.id = @id`,
      );
    return result.recordset[0]?.status ?? null;
  }

  /** garment.sp_submit_spk di dalam transaksi service (SP tidak membuka transaksi sendiri). */
  async submit(
    tx: sql.Transaction,
    p: {
      order_detail_id: string;
      line_id: string;
      employee_id: string;
      target_date: string;
      sizes: { size: string; qty: number }[];
    },
  ): Promise<SubmitSpkSpResult> {
    const r = await new sql.Request(tx)
      .input('order_detail_id', sql.UniqueIdentifier, p.order_detail_id)
      .input('line_id', sql.UniqueIdentifier, p.line_id)
      .input('employee_id', sql.UniqueIdentifier, p.employee_id)
      .input('target_date', sql.Date, p.target_date)
      .input('sizes', sql.NVarChar(sql.MAX), JSON.stringify(p.sizes))
      .output('spk_id', sql.UniqueIdentifier)
      .output('spk_no', sql.Char(12))
      .output('result', sql.VarChar(20))
      .execute('garment.sp_submit_spk');

    return {
      result: r.output.result as string,
      spk_id: (r.output.spk_id as string | null) ?? null,
      spk_no: (r.output.spk_no as string | null) ?? null,
    };
  }

  /** garment.sp_decide_spk: @decision APPROVE | REJECT. */
  async decide(
    tx: sql.Transaction,
    p: { spk_id: string; decision: 'APPROVE' | 'REJECT'; employee_id: string; reason?: string | null },
  ): Promise<string> {
    const r = await new sql.Request(tx)
      .input('spk_id', sql.UniqueIdentifier, p.spk_id)
      .input('decision', sql.VarChar(10), p.decision)
      .input('employee_id', sql.UniqueIdentifier, p.employee_id)
      .input('reason', sql.NVarChar(500), p.reason ?? null)
      .output('result', sql.VarChar(20))
      .execute('garment.sp_decide_spk');
    return r.output.result as string;
  }
}
