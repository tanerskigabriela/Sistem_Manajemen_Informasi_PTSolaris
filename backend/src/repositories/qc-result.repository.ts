import sql from 'mssql';
import { BaseRepository } from './base.repository';

export interface QcDefectRow {
  defect_type_id: string;
  defect_name: string;
  level: string;
  qty: number;
  action_taken: string | null;
}

export interface QcResultRow {
  id: string;
  spk_id: string;
  stage_code: string;
  stage_name: string;
  inspection_type: string;
  check_date: string;
  qty_passed: number;
  sample_qty: number | null;
  standard_id: string;
  parameter_name: string;
  tolerance_value: string;
  inspected_by_name: string;
  created_at: Date;
  defects: QcDefectRow[];
}

export interface StyleRejectSummary {
  reject_pct: number;
  reject_limit_pct: number;
  is_over_reject: boolean;
}

/** Defect digabung jadi JSON per hasil QC supaya satu query cukup. */
const SELECT_QC = `
  SELECT q.id, q.spk_id, q.stage_code, ps.stage_name, q.inspection_type,
         CONVERT(VARCHAR(10), q.check_date, 23) AS check_date,
         q.qty_passed, q.sample_qty, q.standard_id, st.parameter_name, st.tolerance_value,
         e.full_name AS inspected_by_name, q.created_at,
         (SELECT d.defect_type_id, dt.defect_name, dt.level, d.qty, d.action_taken
          FROM garment.qc_defects d
          JOIN garment.defect_types dt ON dt.id = d.defect_type_id
          WHERE d.qc_id = q.id
          FOR JSON PATH) AS defects_json
  FROM garment.qc_results q
  JOIN garment.production_stages ps ON ps.stage_code = q.stage_code
  JOIN garment.qc_standards st      ON st.id = q.standard_id
  JOIN garment.employees e          ON e.id = q.inspected_by`;

type RawQcRow = Omit<QcResultRow, 'defects'> & { defects_json: string | null };

function toRow({ defects_json, ...rest }: RawQcRow): QcResultRow {
  return { ...rest, defects: defects_json ? (JSON.parse(defects_json) as QcDefectRow[]) : [] };
}

/** garment.qc_results + qc_defects untuk QC INLINE/FINAL per SPK dan tahap (FSD-2.13). */
export class QcResultRepository extends BaseRepository<QcResultRow> {
  constructor() {
    super('garment.qc_results');
  }

  async findById(id: string, tx?: sql.Transaction): Promise<QcResultRow | null> {
    const request = tx ? new sql.Request(tx) : (await this.getPool()).request();
    const result = await request
      .input('id', sql.UniqueIdentifier, id)
      .query<RawQcRow>(`${SELECT_QC} WHERE q.id = @id`);
    const row = result.recordset[0];
    return row ? toRow(row) : null;
  }

  /** Daftar hasil QC selalu per SPK (findBySpk). */
  async findAll(): Promise<QcResultRow[]> {
    return [];
  }

  async findBySpk(spkId: string): Promise<QcResultRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('spk_id', sql.UniqueIdentifier, spkId)
      .query<RawQcRow>(
        `${SELECT_QC}
         WHERE q.spk_id = @spk_id AND q.inspection_type IN ('INLINE','FINAL')
         ORDER BY q.check_date DESC, ps.[sequence]`,
      );
    return result.recordset.map(toRow);
  }

  async insert(
    tx: sql.Transaction,
    p: {
      inspection_type: string;
      spk_id: string;
      stage_code: string;
      standard_id: string;
      inspected_by: string;
      check_date: string;
      sample_qty: number | null;
      qty_passed: number;
    },
  ): Promise<string> {
    const result = await new sql.Request(tx)
      .input('inspection_type', sql.VarChar(8), p.inspection_type)
      .input('spk_id', sql.UniqueIdentifier, p.spk_id)
      .input('stage_code', sql.VarChar(10), p.stage_code)
      .input('standard_id', sql.UniqueIdentifier, p.standard_id)
      .input('inspected_by', sql.UniqueIdentifier, p.inspected_by)
      .input('check_date', sql.Date, p.check_date)
      .input('sample_qty', sql.Int, p.sample_qty)
      .input('qty_passed', sql.Int, p.qty_passed)
      .query<{ id: string }>(
        `DECLARE @new TABLE (id UNIQUEIDENTIFIER);
         INSERT INTO garment.qc_results
           (inspection_type, spk_id, stage_code, standard_id, inspected_by, check_date, sample_qty, qty_passed)
         OUTPUT inserted.id INTO @new
         VALUES (@inspection_type, @spk_id, @stage_code, @standard_id, @inspected_by, @check_date, @sample_qty, @qty_passed);
         SELECT id FROM @new;`,
      );
    return result.recordset[0].id;
  }

  async insertDefect(
    tx: sql.Transaction,
    qcId: string,
    d: { defect_type_id: string; qty: number; action_taken?: string | null },
  ): Promise<void> {
    await new sql.Request(tx)
      .input('qc_id', sql.UniqueIdentifier, qcId)
      .input('defect_type_id', sql.UniqueIdentifier, d.defect_type_id)
      .input('qty', sql.Int, d.qty)
      .input('action_taken', sql.NVarChar(200), d.action_taken ?? null)
      .query(
        `INSERT INTO garment.qc_defects (qc_id, defect_type_id, qty, action_taken)
         VALUES (@qc_id, @defect_type_id, @qty, @action_taken);`,
      );
  }

  /** RB-43/44: persentase tidak lolos style vs batas reject order. */
  async styleRejectSummary(orderDetailId: string, tx?: sql.Transaction): Promise<StyleRejectSummary> {
    const request = tx ? new sql.Request(tx) : (await this.getPool()).request();
    const result = await request
      .input('order_detail_id', sql.UniqueIdentifier, orderDetailId)
      .query<StyleRejectSummary>(
        `SELECT garment.fn_reject_pct(d.id) AS reject_pct, o.reject_limit_pct,
                d.is_over_reject
         FROM garment.order_details d
         JOIN garment.orders o ON o.id = d.order_id
         WHERE d.id = @order_detail_id`,
      );
    return result.recordset[0];
  }
}
