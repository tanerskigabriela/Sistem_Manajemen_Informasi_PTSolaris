import sql from 'mssql';
import { BaseRepository } from './base.repository';

export interface ProgressRow {
  id: string;
  spk_id: string;
  stage_code: string;
  stage_name: string;
  sequence: number;
  work_date: string;
  qty_done: number;
  variance_note: string | null;
  recorded_by_name: string;
  created_at: Date;
  updated_at: Date;
}

const SELECT_PROGRESS = `
  SELECT p.id, p.spk_id, p.stage_code, ps.stage_name, ps.[sequence],
         CONVERT(VARCHAR(10), p.work_date, 23) AS work_date,
         p.qty_done, p.variance_note, e.full_name AS recorded_by_name,
         p.created_at, p.updated_at
  FROM garment.production_progress p
  JOIN garment.production_stages ps ON ps.stage_code = p.stage_code
  JOIN garment.employees e          ON e.id = p.recorded_by`;

/** garment.production_progress: progres harian per SPK, tahap, dan tanggal (FSD-2.12). */
export class ProgressRepository extends BaseRepository<ProgressRow> {
  constructor() {
    super('garment.production_progress');
  }

  async findById(id: string, tx?: sql.Transaction): Promise<ProgressRow | null> {
    const request = tx ? new sql.Request(tx) : (await this.getPool()).request();
    const result = await request
      .input('id', sql.UniqueIdentifier, id)
      .query<ProgressRow>(`${SELECT_PROGRESS} WHERE p.id = @id`);
    return result.recordset[0] ?? null;
  }

  /** Daftar progres selalu per SPK (findBySpk). */
  async findAll(): Promise<ProgressRow[]> {
    return [];
  }

  async findBySpk(spkId: string): Promise<ProgressRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('spk_id', sql.UniqueIdentifier, spkId)
      .query<ProgressRow>(
        `${SELECT_PROGRESS} WHERE p.spk_id = @spk_id
         ORDER BY p.work_date DESC, ps.[sequence]`,
      );
    return result.recordset;
  }

  async existsForDate(
    tx: sql.Transaction,
    spkId: string,
    stageCode: string,
    workDate: string,
  ): Promise<string | null> {
    const result = await new sql.Request(tx)
      .input('spk_id', sql.UniqueIdentifier, spkId)
      .input('stage_code', sql.VarChar(10), stageCode)
      .input('work_date', sql.Date, workDate)
      .query<{ id: string }>(
        `SELECT id FROM garment.production_progress
         WHERE spk_id = @spk_id AND stage_code = @stage_code AND work_date = @work_date`,
      );
    return result.recordset[0]?.id ?? null;
  }

  /** Kumulatif selesai satu tahap, bisa tanpa menghitung satu baris (dipakai saat ubah data). */
  async cumulativeDone(
    tx: sql.Transaction,
    spkId: string,
    stageCode: string,
    excludeId?: string,
  ): Promise<number> {
    const result = await new sql.Request(tx)
      .input('spk_id', sql.UniqueIdentifier, spkId)
      .input('stage_code', sql.VarChar(10), stageCode)
      .input('exclude_id', sql.UniqueIdentifier, excludeId ?? null)
      .query<{ total: number }>(
        `SELECT ISNULL(SUM(qty_done), 0) AS total
         FROM garment.production_progress
         WHERE spk_id = @spk_id AND stage_code = @stage_code
           AND (@exclude_id IS NULL OR id <> @exclude_id)`,
      );
    return result.recordset[0].total;
  }

  /** Batas kumulatif tahap = lolos QC kumulatif tahap sebelumnya (RB-37); Cutting = jumlah SPK. */
  async maxAllowed(tx: sql.Transaction, spkId: string, stageCode: string): Promise<number> {
    const result = await new sql.Request(tx)
      .input('spk_id', sql.UniqueIdentifier, spkId)
      .input('stage_code', sql.VarChar(10), stageCode)
      .query<{ max_allowed: number }>(
        'SELECT garment.fn_stage_max_allowed(@spk_id, @stage_code) AS max_allowed',
      );
    return result.recordset[0].max_allowed;
  }

  /** Kumulatif lolos QC satu tahap (untuk menjaga selesai >= lolos saat data diubah). */
  async cumulativePassed(tx: sql.Transaction, spkId: string, stageCode: string): Promise<number> {
    const result = await new sql.Request(tx)
      .input('spk_id', sql.UniqueIdentifier, spkId)
      .input('stage_code', sql.VarChar(10), stageCode)
      .query<{ total: number }>(
        `SELECT ISNULL(SUM(qty_passed), 0) AS total
         FROM garment.qc_results
         WHERE spk_id = @spk_id AND stage_code = @stage_code
           AND inspection_type IN ('INLINE','FINAL')`,
      );
    return result.recordset[0].total;
  }

  async insert(
    tx: sql.Transaction,
    p: {
      spk_id: string;
      stage_code: string;
      work_date: string;
      qty_done: number;
      variance_note: string | null;
      recorded_by: string;
    },
  ): Promise<string> {
    const result = await new sql.Request(tx)
      .input('spk_id', sql.UniqueIdentifier, p.spk_id)
      .input('stage_code', sql.VarChar(10), p.stage_code)
      .input('work_date', sql.Date, p.work_date)
      .input('qty_done', sql.Int, p.qty_done)
      .input('variance_note', sql.NVarChar(300), p.variance_note)
      .input('recorded_by', sql.UniqueIdentifier, p.recorded_by)
      .query<{ id: string }>(
        `DECLARE @new TABLE (id UNIQUEIDENTIFIER);
         INSERT INTO garment.production_progress
           (spk_id, stage_code, work_date, qty_done, variance_note, recorded_by)
         OUTPUT inserted.id INTO @new
         VALUES (@spk_id, @stage_code, @work_date, @qty_done, @variance_note, @recorded_by);
         SELECT id FROM @new;`,
      );
    return result.recordset[0].id;
  }

  async update(
    tx: sql.Transaction,
    id: string,
    p: { qty_done: number; variance_note: string | null; recorded_by: string },
  ): Promise<void> {
    await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, id)
      .input('qty_done', sql.Int, p.qty_done)
      .input('variance_note', sql.NVarChar(300), p.variance_note)
      .input('recorded_by', sql.UniqueIdentifier, p.recorded_by)
      .query(
        `UPDATE garment.production_progress
         SET qty_done = @qty_done, variance_note = @variance_note,
             recorded_by = @recorded_by, updated_at = SYSDATETIME()
         WHERE id = @id;`,
      );
  }
}
