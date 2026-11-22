import sql from "mssql";
import { BaseRepository } from "./base.repository";

// Perubahan status order: sp_change_order_status, sp_cancel_order, fn_cancellation_penalty (09).

export type StatusAction = "APPROVE" | "REJECT" | "WITHDRAW";

export interface OrderStatusRow {
  id: string;
  order_code: string;
  status: string;
}

export interface CancelResult {
  cancellation_id: string | null;
  penalty_amount: number | null;
  refund_amount: number | null;
  result: string;
}

export interface CancellationPreview {
  order_id: string;
  order_code: string;
  status: string;
  level_code: string;
  currency: string;
  stage_code_at_request: string | null;
  policy_id: string | null;
  penalty_pct: number | null;
  down_payment_refund_pct: number | null;
  material_owned_by_buyer: boolean | null;
  total_value: number;
  dp_paid: number;
  penalty_amount: number;
  refund_amount: number;
}

export class OrderStatusRepository extends BaseRepository<OrderStatusRow> {
  constructor() {
    super("garment.orders");
  }

  async findAll(): Promise<OrderStatusRow[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .query<OrderStatusRow>(
        "SELECT id, order_code, status FROM garment.orders ORDER BY created_at DESC",
      );
    return result.recordset;
  }

  async findById(id: string): Promise<OrderStatusRow | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query<OrderStatusRow>(
        "SELECT id, order_code, status FROM garment.orders WHERE id = @id",
      );
    return result.recordset[0] ?? null;
  }

  // Dibaca di dalam transaksi yang sama setelah SP menolak, untuk memilih kode error
  async findStatus(
    tx: sql.Transaction,
    id: string,
  ): Promise<OrderStatusRow | null> {
    const result = await new sql.Request(tx)
      .input("id", sql.UniqueIdentifier, id)
      .query<OrderStatusRow>(
        "SELECT id, order_code, status FROM garment.orders WHERE id = @id",
      );
    return result.recordset[0] ?? null;
  }

  async changeStatus(
    tx: sql.Transaction,
    orderId: string,
    action: StatusAction,
    employeeId: string,
    reason: string | null,
  ): Promise<string> {
    const result = await new sql.Request(tx)
      .input("order_id", sql.UniqueIdentifier, orderId)
      .input("action", sql.VarChar(10), action)
      .input("employee_id", sql.UniqueIdentifier, employeeId)
      .input("reason", sql.NVarChar(500), reason)
      .output("result", sql.VarChar(20))
      .execute("garment.sp_change_order_status");
    return (result.output.result as string | null) ?? "UNKNOWN";
  }

  async cancel(
    tx: sql.Transaction,
    orderId: string,
    employeeId: string,
    reason: string,
    requestedByParty: string,
  ): Promise<CancelResult> {
    const result = await new sql.Request(tx)
      .input("order_id", sql.UniqueIdentifier, orderId)
      .input("employee_id", sql.UniqueIdentifier, employeeId)
      .input("reason", sql.NVarChar(500), reason)
      .input("requested_by_party", sql.VarChar(10), requestedByParty)
      .output("cancellation_id", sql.UniqueIdentifier)
      .output("penalty_amount", sql.Decimal(16, 2))
      .output("refund_amount", sql.Decimal(16, 2))
      .output("result", sql.VarChar(20))
      .execute("garment.sp_cancel_order");
    const out = result.output as Partial<CancelResult>;
    return {
      cancellation_id: out.cancellation_id ?? null,
      penalty_amount: out.penalty_amount ?? null,
      refund_amount: out.refund_amount ?? null,
      result: out.result ?? "UNKNOWN",
    };
  }

  // Perkiraan denda dan refund sebelum Pimpinan menekan tombol Batalkan
  async cancellationPreview(
    orderId: string,
  ): Promise<CancellationPreview | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input("id", sql.UniqueIdentifier, orderId).query<CancellationPreview>(`
        SELECT o.id AS order_id, o.order_code, o.status, o.level_code, o.currency,
               p.stage_code_at_request, p.policy_id, p.penalty_pct, p.down_payment_refund_pct,
               p.material_owned_by_buyer, ISNULL(p.total_value, 0) AS total_value,
               ISNULL(p.dp_paid, 0) AS dp_paid, ISNULL(p.penalty_amount, 0) AS penalty_amount,
               ISNULL(p.refund_amount, 0) AS refund_amount
        FROM garment.orders o
        OUTER APPLY garment.fn_cancellation_penalty(o.id) p
        WHERE o.id = @id`);
    return result.recordset[0] ?? null;
  }
}
