import { Router } from 'express';
import { ROLE } from '../constants';
import {
  createOrderMaterial,
  getMaterialRequirement,
  listOrderMaterials,
  updateOrderMaterial,
} from '../controllers/order-material.controller';
import { validate } from '../middlewares/validate';
import {
  createOrderMaterialBody,
  materialIdParams,
  orderDetailIdParams,
  updateOrderMaterialBody,
} from '../schemas/order-material.schema';
import { requireRole } from '../utils/actor';

const router = Router();

router.get(
  '/order-details/:id/materials',
  requireRole(ROLE.PPIC, ROLE.PIMPINAN),
  validate({ params: orderDetailIdParams }),
  listOrderMaterials,
);
router.post(
  '/order-details/:id/materials',
  requireRole(ROLE.PPIC),
  validate({ params: orderDetailIdParams, body: createOrderMaterialBody }),
  createOrderMaterial,
);
router.patch(
  '/materials/:id',
  requireRole(ROLE.PPIC),
  validate({ params: materialIdParams, body: updateOrderMaterialBody }),
  updateOrderMaterial,
);
router.get(
  '/order-details/:id/material-requirement',
  requireRole(ROLE.PPIC),
  validate({ params: orderDetailIdParams }),
  getMaterialRequirement,
);

export default router;
