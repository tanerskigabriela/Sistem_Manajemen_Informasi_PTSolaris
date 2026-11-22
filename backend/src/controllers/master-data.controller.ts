import type { NextFunction, Request, Response } from "express";
import type { ListItemsQuery } from "../schemas/orders.schema";
import { MasterDataService } from "../services/master-data.service";
import { getActor } from "../utils/order-actor";
import { sendSuccess } from "../utils/response";

const service = new MasterDataService();

export async function listCountries(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await service.listCountries());
  } catch (error) {
    next(error);
  }
}

export async function listProductTypes(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await service.listProductTypes());
  } catch (error) {
    next(error);
  }
}

export async function listOrderLevels(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(res, await service.listOrderLevels());
  } catch (error) {
    next(error);
  }
}

export async function listItems(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = getActor(req);
    sendSuccess(
      res,
      await service.listItems(req.query as ListItemsQuery, actor.role_code),
    );
  } catch (error) {
    next(error);
  }
}
