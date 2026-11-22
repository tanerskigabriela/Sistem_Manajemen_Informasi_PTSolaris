import {
  ACTION_TYPE,
  ORDER_STATUS,
  type ActionType,
  type OrderStatus,
} from "../constants";
import {
  cancelOrderError,
  changeStatusError,
  notFound,
  reasonRequired,
} from "../errors/order.errors";
import {
  OrderStatusRepository,
  type StatusAction,
} from "../repositories/order-status.repository";
import type { CancelOrderInput } from "../schemas/orders.schema";
import type { Actor } from "../utils/order-actor";
import type { RequestMeta } from "../utils/request-meta";
import { BaseService } from "./base.service";

// Jenis log untuk tiap aksi (KONTRAK Bagian 4.2, activity_logs.action_type)
const LOG_ACTION: Record<StatusAction, ActionType> = {
  APPROVE: ACTION_TYPE.SETUJU,
  REJECT: ACTION_TYPE.TOLAK,
  WITHDRAW: ACTION_TYPE.TARIK,
};

const NEW_STATUS: Record<StatusAction, OrderStatus> = {
  APPROVE: ORDER_STATUS.DISETUJUI,
  REJECT: ORDER_STATUS.DITOLAK,
  WITHDRAW: ORDER_STATUS.DITARIK,
};

const CANCELLABLE: readonly string[] = [
  ORDER_STATUS.DISETUJUI,
  ORDER_STATUS.DALAM_PRODUKSI,
];

// FSD 2.6 Persetujuan Order, 2.7 Pembatalan Order, 2.25 Tarik Pengajuan
export class OrderStatusService extends BaseService {
  private readonly repo = new OrderStatusRepository();

  async changeStatus(
    orderId: string,
    action: StatusAction,
    reason: string,
    actor: Actor,
    meta: RequestMeta,
  ) {
    const cleanReason = reason.trim();
    if (action !== "APPROVE" && cleanReason === "") throw reasonRequired();

    return this.runInTransaction(async (tx) => {
      const result = await this.repo.changeStatus(
        tx,
        orderId,
        action,
        actor.employee_id,
        cleanReason || null,
      );
      if (result !== "SUCCESS") {
        const current = await this.repo.findStatus(tx, orderId);
        throw changeStatusError(result, current?.status ?? null);
      }

      const order = await this.repo.findStatus(tx, orderId);
      await this.recordActivity(tx, {
        user_id: actor.user_id,
        username: actor.username,
        action_type: LOG_ACTION[action],
        resource_type: "garment.orders",
        resource_id: orderId,
        old_values: { status: ORDER_STATUS.MENUNGGU_PERSETUJUAN },
        new_values: { status: NEW_STATUS[action], reason: cleanReason || null },
        ...meta,
      });
      return {
        id: orderId,
        order_code: order?.order_code,
        status: NEW_STATUS[action],
      };
    });
  }

  async cancel(
    orderId: string,
    input: CancelOrderInput,
    actor: Actor,
    meta: RequestMeta,
  ) {
    const reason = input.reason.trim();
    if (reason === "") throw reasonRequired();

    return this.runInTransaction(async (tx) => {
      // Status awal dibaca dengan kunci baris supaya tidak berubah sampai SP selesai
      const before = await this.repo.findStatus(tx, orderId, true);
      const out = await this.repo.cancel(
        tx,
        orderId,
        actor.employee_id,
        reason,
        input.requested_by_party,
      );
      if (out.result !== "SUCCESS")
        throw cancelOrderError(out.result, before?.status ?? null);

      await this.recordActivity(tx, {
        user_id: actor.user_id,
        username: actor.username,
        action_type: ACTION_TYPE.BATAL,
        resource_type: "garment.orders",
        resource_id: orderId,
        old_values: { status: before?.status },
        new_values: {
          status: ORDER_STATUS.DIBATALKAN,
          reason,
          requested_by_party: input.requested_by_party,
          cancellation_id: out.cancellation_id,
          penalty_amount: out.penalty_amount,
          refund_amount: out.refund_amount,
        },
        ...meta,
      });
      return {
        id: orderId,
        order_code: before?.order_code,
        status: ORDER_STATUS.DIBATALKAN,
        cancellation_id: out.cancellation_id,
        penalty_amount: out.penalty_amount,
        refund_amount: out.refund_amount,
      };
    });
  }

  // Aturan dan pesan error sama dengan sp_cancel_order, jadi memakai cancelOrderError yang sama
  async cancellationPreview(orderId: string) {
    const preview = await this.repo.cancellationPreview(orderId);
    if (!preview) throw notFound();
    if (!CANCELLABLE.includes(preview.status))
      throw cancelOrderError("NOT_CANCELLABLE", preview.status);
    if (!preview.policy_id) throw cancelOrderError("NO_POLICY", preview.status);
    return preview;
  }
}
