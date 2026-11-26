import type { NextFunction, Request, Response } from 'express';
import type { DashboardQuery, ListExpeditionsQuery, ListShipmentsQuery } from '../schemas/shipments.schema';
import { DashboardService } from '../services/dashboard.service';
import { ShipmentService } from '../services/shipments.service';
import { getActor, getRequestMeta } from '../utils/order-actor';
import { sendSuccess } from '../utils/response';

const shipments = new ShipmentService();
const dashboard = new DashboardService();

export async function listExpeditions(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await shipments.listExpeditions(req.query as ListExpeditionsQuery));
  } catch (error) {
    next(error);
  }
}

export async function getReadyToShip(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await shipments.readyToShip(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function createShipment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await shipments.create(req.body, getActor(req), getRequestMeta(req));
    sendSuccess(res, data, 'Pengiriman berhasil dicatat.', undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function listShipments(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows, meta } = await shipments.list(req.query as unknown as ListShipmentsQuery);
    sendSuccess(res, rows, undefined, meta);
  } catch (error) {
    next(error);
  }
}

export async function getDeliveryNote(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await shipments.deliveryNote(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, await dashboard.get(req.query as DashboardQuery));
  } catch (error) {
    next(error);
  }
}
