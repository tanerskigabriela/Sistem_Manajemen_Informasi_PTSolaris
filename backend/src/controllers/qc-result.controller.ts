import type { NextFunction, Request, Response } from 'express';
import type { CreateQcResultInput } from '../schemas/qc-result.schema';
import { QcResultService } from '../services/qc-result.service';
import { getActor } from '../utils/actor';
import { sendSuccess } from '../utils/response';

const service = new QcResultService();

export async function listQcResults(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.listBySpk(req.params.id, getActor(res)));
  } catch (err) {
    next(err);
  }
}

export async function createQcResult(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.create(req.params.id, req.body as CreateQcResultInput, getActor(res));
    sendSuccess(res, data, 'Hasil QC berhasil disimpan.', undefined, 201);
  } catch (err) {
    next(err);
  }
}
