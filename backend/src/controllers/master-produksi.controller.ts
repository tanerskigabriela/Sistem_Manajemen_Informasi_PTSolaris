import type { NextFunction, Request, Response } from 'express';
import type {
  ListProductionLinesQuery,
  ListQcStandardsQuery,
  ListRawMaterialsQuery,
} from '../schemas/master-produksi.schema';
import { MasterProduksiService } from '../services/master-produksi.service';
import { sendSuccess } from '../utils/response';

const service = new MasterProduksiService();

export async function listRawMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.listRawMaterials(req.query as ListRawMaterialsQuery));
  } catch (err) {
    next(err);
  }
}

export async function listProductionLines(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.listProductionLines(req.query as ListProductionLinesQuery));
  } catch (err) {
    next(err);
  }
}

export async function listDefectTypes(_req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.listDefectTypes());
  } catch (err) {
    next(err);
  }
}

export async function listQcStandards(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.listQcStandards(req.query as ListQcStandardsQuery));
  } catch (err) {
    next(err);
  }
}
