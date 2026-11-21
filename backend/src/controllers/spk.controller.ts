import type { NextFunction, Request, Response } from 'express';
import type { ListSpkQuery, RejectSpkInput, SubmitSpkInput } from '../schemas/spk.schema';
import { SpkService } from '../services/spk.service';
import { getActor } from '../utils/actor';
import { sendSuccess } from '../utils/response';

const service = new SpkService();

export async function listSpk(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows, meta } = await service.list(req.query as unknown as ListSpkQuery, getActor(res));
    sendSuccess(res, rows, undefined, meta);
  } catch (err) {
    next(err);
  }
}

export async function getSpk(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.getById(req.params.id, getActor(res)));
  } catch (err) {
    next(err);
  }
}

export async function submitSpk(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.submit(req.body as SubmitSpkInput, getActor(res));
    sendSuccess(res, data, 'SPK berhasil diajukan.', undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function approveSpk(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await service.approve(req.params.id, getActor(res)), 'SPK disetujui.');
  } catch (err) {
    next(err);
  }
}

export async function rejectSpk(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.reject(req.params.id, req.body as RejectSpkInput, getActor(res));
    sendSuccess(res, data, 'SPK ditolak.');
  } catch (err) {
    next(err);
  }
}
