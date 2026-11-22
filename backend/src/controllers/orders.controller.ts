import type { NextFunction, Request, Response } from "express";
import type { ListOrdersQuery } from "../schemas/orders.schema";
import { OrderService } from "../services/orders.service";
import { getActor, getRequestMeta } from "../utils/order-actor";
import { sendSuccess } from "../utils/response";

const service = new OrderService();

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await service.create(
      req.body,
      getActor(req),
      getRequestMeta(req),
    );
    sendSuccess(res, data, "Order berhasil disimpan.", undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = getActor(req);
    const { rows, meta } = await service.list(
      req.query as unknown as ListOrdersQuery,
      actor.role_code,
    );
    sendSuccess(res, rows, undefined, meta);
  } catch (error) {
    next(error);
  }
}

export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = getActor(req);
    sendSuccess(res, await service.getById(req.params.id, actor.role_code));
  } catch (error) {
    next(error);
  }
}
