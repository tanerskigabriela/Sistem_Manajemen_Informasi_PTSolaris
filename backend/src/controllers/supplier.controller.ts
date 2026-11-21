import type { NextFunction, Request, Response } from 'express';
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
} from '../schemas/supplier.schema';
import { SupplierService } from '../services/supplier.service';
import { getActor } from '../utils/actor';
import { sendSuccess } from '../utils/response';

const service = new SupplierService();

export async function listSuppliers(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.list(req.query as unknown as ListSuppliersQuery);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function listSupplierMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listMaterials(req.params.id, getActor(res));
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.create(req.body as CreateSupplierInput, getActor(res));
    sendSuccess(res, data, 'Supplier berhasil disimpan.', undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.update(
      req.params.id,
      req.body as UpdateSupplierInput,
      getActor(res),
    );
    sendSuccess(res, data, 'Supplier berhasil diubah.');
  } catch (err) {
    next(err);
  }
}
