import { ACTION_TYPE, type ActionType } from "../constants";
import {
  STATUS_MSG,
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
import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

interface RequestMeta {
  device: string | null;
  ip_address: string;
}

// Jenis log untuk tiap aksi (KONTRAK Bagian 4.2, activity_logs.action_type)
const LOG_ACTION: Record<StatusAction, ActionType> = {
  APPROVE: ACTION_TYPE.SETUJU,
  REJECT: ACTION_TYPE.TOLAK,
  WITHDRAW: ACTION_TYPE.TARIK,
};

const NEW_STATUS: Record<StatusAction, string> = {
  APPROVE: "DISETUJUI",
  REJECT: "DITOLAK",
  WITHDRAW: "DITARIK",
};

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
        resource_type: "orders",
        resource_id: orderId,
        old_values: { status: "MENUNGGU_PERSETUJUAN" },
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
      const before = await this.repo.findStatus(tx, orderId);
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
        resource_type: "orders",
        resource_id: orderId,
        old_values: { status: before?.status },
        new_values: {
          status: "DIBATALKAN",
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
        status: "DIBATALKAN",
        cancellation_id: out.cancellation_id,
        penalty_amount: out.penalty_amount,
        refund_amount: out.refund_amount,
      };
    });
  }

  async cancellationPreview(orderId: string) {
    const preview = await this.repo.cancellationPreview(orderId);
    if (!preview) throw notFound();
    if (preview.status !== "DISETUJUI" && preview.status !== "DALAM_PRODUKSI") {
      const final =
        preview.status === "DITOLAK" || preview.status === "DITARIK";
      throw final
        ? new AppError(409, "ERR-ORD-05", STATUS_MSG.ORDER_FINAL)
        : new AppError(409, "ERR-ORD-03", STATUS_MSG.NOT_CANCELLABLE);
    }
    if (!preview.policy_id)
      throw new AppError(409, "ERR-BTL-01", STATUS_MSG.NO_POLICY);
    return preview;
  }
}
