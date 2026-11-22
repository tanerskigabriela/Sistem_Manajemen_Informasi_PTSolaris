import type { NextFunction, Request, Response } from "express";
import type { StatusAction } from "../repositories/order-status.repository";
import type { CancelOrderInput, ReasonInput } from "../schemas/orders.schema";
import { OrderStatusService } from "../services/order-status.service";
import { getActor, getRequestMeta } from "../utils/order-actor";
import { sendSuccess } from "../utils/response";

const service = new OrderStatusService();

const SUCCESS_MESSAGE: Record<StatusAction, string> = {
  APPROVE: "Order berhasil disetujui.",
  REJECT: "Order berhasil ditolak.",
  WITHDRAW: "Pengajuan order berhasil ditarik.",
};

// Satu pembuat handler untuk approve, reject, dan withdraw
function statusHandler(action: StatusAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = (req.body ?? {}) as Partial<ReasonInput>;
      const data = await service.changeStatus(
        req.params.id,
        action,
        reason ?? "",
        getActor(req),
        getRequestMeta(req),
      );
      sendSuccess(res, data, SUCCESS_MESSAGE[action]);
    } catch (error) {
      next(error);
    }
  };
}

export const approveOrder = statusHandler("APPROVE");
export const rejectOrder = statusHandler("REJECT");
export const withdrawOrder = statusHandler("WITHDRAW");

export async function cancelOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await service.cancel(
      req.params.id,
      req.body as CancelOrderInput,
      getActor(req),
      getRequestMeta(req),
    );
    sendSuccess(res, data, "Order berhasil dibatalkan.");
  } catch (error) {
    next(error);
  }
}

export async function getCancellationPreview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await service.cancellationPreview(req.params.id));
  } catch (error) {
    next(error);
  }
}
