import { Router } from "express";
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
  createOrder,
  getOrder,
  listOrders,
} from "../controllers/orders.controller";
import { validate } from "../middlewares/validate";
import {
  createBuyerSchema,
  idParams,
  listBuyersQuery,
  updateBuyerSchema,
} from "../schemas/buyers.schema";
import {
  createOrderSchema,
  listItemsQuery,
  listOrdersQuery,
} from "../schemas/orders.schema";

// Router modul B. authenticate dan authorize ditambahkan setelah login A masuk:
// urutan tiap route menjadi authenticate -> authorize(...) -> validate -> controller.
const router = Router();

router.get("/countries", listCountries);
router.get("/product-types", listProductTypes);
router.get("/order-levels", listOrderLevels);
router.get("/items", validate({ query: listItemsQuery }), listItems);

router.get("/buyers", validate({ query: listBuyersQuery }), listBuyers);
router.get("/buyers/:id", validate({ params: idParams }), getBuyer);
router.post("/buyers", validate(createBuyerSchema), createBuyer);
router.patch(
  "/buyers/:id",
  validate({ params: idParams, body: updateBuyerSchema }),
  updateBuyer,
);

router.post("/orders", validate(createOrderSchema), createOrder);
router.get("/orders", validate({ query: listOrdersQuery }), listOrders);
router.get("/orders/:id", validate({ params: idParams }), getOrder);

export default router;
