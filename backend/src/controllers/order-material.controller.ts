import type { NextFunction, Request, Response } from 'express';
import type {
  CreateOrderMaterialInput,
  UpdateOrderMaterialInput,
} from '../schemas/order-material.schema';
import { OrderMaterialService } from '../services/order-material.service';
import { getActor } from '../utils/actor';
import { sendSuccess } from '../utils/response';

const service = new OrderMaterialService();

export async function listOrderMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.listByOrderDetail(req.params.id, getActor(res)));
  } catch (err) {
    next(err);
  }
}

export async function getMaterialRequirement(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.requirement(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createOrderMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.create(
      req.params.id,
      req.body as CreateOrderMaterialInput,
      getActor(res),
    );
    sendSuccess(res, data, 'Bahan berhasil disimpan.', undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.update(
      req.params.id,
      req.body as UpdateOrderMaterialInput,
      getActor(res),
    );
    sendSuccess(res, data, 'Bahan berhasil diubah.');
  } catch (err) {
    next(err);
  }
}
