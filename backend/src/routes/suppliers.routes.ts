import { Router } from 'express';
import { ROLE } from '../constants';
import {
  createSupplier,
  listSupplierMaterials,
  listSuppliers,
  updateSupplier,
} from '../controllers/supplier.controller';
import { validate } from '../middlewares/validate';
import {
  createSupplierBody,
  listSuppliersQuery,
  supplierIdParams,
  updateSupplierBody,
} from '../schemas/supplier.schema';
import { requireRole } from '../utils/actor';

const router = Router();

router.get(
  '/suppliers',
  requireRole(ROLE.PPIC, ROLE.PIMPINAN),
  validate({ query: listSuppliersQuery }),
  listSuppliers,
);
router.post(
  '/suppliers',
  requireRole(ROLE.PPIC),
  validate({ body: createSupplierBody }),
  createSupplier,
);
router.patch(
  '/suppliers/:id',
  requireRole(ROLE.PPIC),
  validate({ params: supplierIdParams, body: updateSupplierBody }),
  updateSupplier,
);
router.get(
  '/suppliers/:id/materials',
  requireRole(ROLE.PPIC, ROLE.PIMPINAN),
  validate({ params: supplierIdParams }),
  listSupplierMaterials,
);

export default router;
