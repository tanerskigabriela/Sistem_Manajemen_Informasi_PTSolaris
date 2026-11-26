import { Router } from "express";
import { ROLE } from "../constants";
import {
  createBuyer,
  getBuyer,
  listBuyers,
  updateBuyer,
} from "../controllers/buyers.controller";
import {
  listCountries,
  listItems,
  listOrderLevels,
  listProductTypes,
} from "../controllers/master-data.controller";
import {
  approveOrder,
  cancelOrder,
  getCancellationPreview,
  rejectOrder,
  withdrawOrder,
} from "../controllers/order-status.controller";
import {
  createOrder,
  getOrder,
  listOrders,
} from "../controllers/orders.controller";
import {
  createShipment,
  getDashboard,
  getDeliveryNote,
  getReadyToShip,
  listExpeditions,
  listShipments,
} from "../controllers/shipments.controller";
import {
  createShipmentSchema,
  dashboardQuery,
  listExpeditionsQuery,
  listShipmentsQuery,
} from "../schemas/shipments.schema";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import {
  createBuyerSchema,
  idParams,
  listBuyersQuery,
  updateBuyerSchema,
} from "../schemas/buyers.schema";
import {
  cancelOrderSchema,
  createOrderSchema,
  listItemsQuery,
  listOrdersQuery,
  reasonSchema,
} from "../schemas/orders.schema";

// Router modul B. Urutan tiap route: authenticate -> authorize(...) -> validate -> controller.
// Role mengikuti KONTRAK v1 Bagian 13 dan KONTRAK v2 Bagian 14.3.
const { MARKETING, PIMPINAN, PPIC, SPV, QC } = ROLE;
const router = Router();

// Dropdown. /countries juga dipakai form supplier milik C (PPIC).
router.get(
  "/countries",
  authenticate,
  authorize(MARKETING, PPIC),
  listCountries,
);
router.get(
  "/product-types",
  authenticate,
  authorize(MARKETING),
  listProductTypes,
);
router.get(
  "/order-levels",
  authenticate,
  authorize(MARKETING),
  listOrderLevels,
);
router.get(
  "/items",
  authenticate,
  authorize(MARKETING),
  validate({ query: listItemsQuery }),
  listItems,
);

// Buyer (FSD 2.3)
router.get(
  "/buyers",
  authenticate,
  authorize(MARKETING, PIMPINAN),
  validate({ query: listBuyersQuery }),
  listBuyers,
);
router.get(
  "/buyers/:id",
  authenticate,
  authorize(MARKETING, PIMPINAN),
  validate({ params: idParams }),
  getBuyer,
);
router.post(
  "/buyers",
  authenticate,
  authorize(MARKETING),
  validate(createBuyerSchema),
  createBuyer,
);
router.patch(
  "/buyers/:id",
  authenticate,
  authorize(MARKETING),
  validate({ params: idParams, body: updateBuyerSchema }),
  updateBuyer,
);

// Order (FSD 2.4, 2.5)
router.post(
  "/orders",
  authenticate,
  authorize(MARKETING),
  validate(createOrderSchema),
  createOrder,
);
router.get(
  "/orders",
  authenticate,
  authorize(MARKETING, PIMPINAN, PPIC, SPV, QC),
  validate({ query: listOrdersQuery }),
  listOrders,
);
router.get(
  "/orders/:id",
  authenticate,
  authorize(MARKETING, PIMPINAN, PPIC, SPV, QC),
  validate({ params: idParams }),
  getOrder,
);

// Status order (FSD 2.6, 2.7, 2.25)
router.post(
  "/orders/:id/approve",
  authenticate,
  authorize(PIMPINAN),
  validate({ params: idParams }),
  approveOrder,
);
router.post(
  "/orders/:id/reject",
  authenticate,
  authorize(PIMPINAN),
  validate({ params: idParams, body: reasonSchema }),
  rejectOrder,
);
router.post(
  "/orders/:id/withdraw",
  authenticate,
  authorize(MARKETING),
  validate({ params: idParams, body: reasonSchema }),
  withdrawOrder,
);
router.get(
  "/orders/:id/cancellation-preview",
  authenticate,
  authorize(PIMPINAN),
  validate({ params: idParams }),
  getCancellationPreview,
);
router.post(
  "/orders/:id/cancel",
  authenticate,
  authorize(PIMPINAN),
  validate({ params: idParams, body: cancelOrderSchema }),
  cancelOrder,
);

// Pengiriman (FSD 2.15) dan Dashboard (FSD 2.14)
router.get(
  "/expeditions",
  authenticate,
  authorize(PPIC),
  validate({ query: listExpeditionsQuery }),
  listExpeditions,
);
router.get(
  "/orders/:id/ready-to-ship",
  authenticate,
  authorize(PPIC),
  validate({ params: idParams }),
  getReadyToShip,
);
router.post(
  "/shipments",
  authenticate,
  authorize(PPIC),
  validate(createShipmentSchema),
  createShipment,
);
router.get(
  "/shipments",
  authenticate,
  authorize(PPIC, PIMPINAN),
  validate({ query: listShipmentsQuery }),
  listShipments,
);
router.get(
  "/shipments/:id/delivery-note",
  authenticate,
  authorize(PPIC),
  validate({ params: idParams }),
  getDeliveryNote,
);
router.get(
  "/dashboard",
  authenticate,
  authorize(PIMPINAN),
  validate({ query: dashboardQuery }),
  getDashboard,
);

export default router;
