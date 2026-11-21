import type { NextFunction, Request, Response } from "express";
import { ROLE } from "../constants";
import type { ListBuyersQuery } from "../schemas/buyers.schema";
import { BuyerService } from "../services/buyers.service";
import { getActor, getRequestMeta } from "../utils/order-actor";
import { sendSuccess } from "../utils/response";

const service = new BuyerService();

export async function listBuyers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { rows, meta } = await service.list(
      req.query as unknown as ListBuyersQuery,
    );
    sendSuccess(res, rows, undefined, meta);
  } catch (error) {
    next(error);
  }
}

export async function getBuyer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await service.getById(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function createBuyer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = await getActor(req, ROLE.MARKETING);
    const data = await service.create(req.body, actor, getRequestMeta(req));
    sendSuccess(res, data, "Buyer berhasil disimpan.", undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateBuyer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = await getActor(req, ROLE.MARKETING);
    const data = await service.update(
      req.params.id,
      req.body,
      actor,
      getRequestMeta(req),
    );
    sendSuccess(res, data, "Buyer berhasil diubah.");
  } catch (error) {
    next(error);
  }
}
