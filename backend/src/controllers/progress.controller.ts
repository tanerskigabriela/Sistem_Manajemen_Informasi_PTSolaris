import type { NextFunction, Request, Response } from 'express';
import type { CreateProgressInput, UpdateProgressInput } from '../schemas/progress.schema';
import { ProgressService } from '../services/progress.service';
import { getActor } from '../utils/actor';
import { sendSuccess } from '../utils/response';

const service = new ProgressService();

export async function listProgress(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.listBySpk(req.params.id, getActor(res)));
  } catch (err) {
    next(err);
  }
}

export async function createProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.create(req.params.id, req.body as CreateProgressInput, getActor(res));
    sendSuccess(res, data, 'Progres berhasil disimpan.', undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.update(req.params.id, req.body as UpdateProgressInput, getActor(res));
    sendSuccess(res, data, 'Progres berhasil diubah.');
  } catch (err) {
    next(err);
  }
}
