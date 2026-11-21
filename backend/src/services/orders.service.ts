import { ACTION_TYPE } from "../constants";
import { MSG, createOrderError, notFound } from "../errors/order.errors";
import { OrderRepository } from "../repositories/orders.repository";
import type {
  CreateOrderInput,
  ListOrdersQuery,
} from "../schemas/orders.schema";
import type { Actor } from "../utils/actor";
import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

interface RequestMeta {
  device: string | null;
  ip_address: string;
}

export class OrderService extends BaseService {
  private readonly repo = new OrderRepository();

  // FSD 2.4 Input Order: semua validasi bisnis dan penomoran ada di sp_create_order
  async create(input: CreateOrderInput, actor: Actor, meta: RequestMeta) {
    if (input.styles.length === 0)
      throw new AppError(422, "ERR-ORD-01", MSG.NO_STYLE);

    const { confirmed: _confirmed, ...payload } = input;

    return this.runInTransaction(async (tx) => {
      const out = await this.repo.create(
        tx,
        actor.employee_id,
        JSON.stringify(payload),
      );
      if (out.result !== "SUCCESS" || !out.order_id)
        throw createOrderError(out.result);

      await this.recordActivity(tx, {
        user_id: actor.user_id,
        username: actor.username,
        action_type: ACTION_TYPE.TAMBAH,
        resource_type: "orders",
        resource_id: out.order_id,
        new_values: {
          order_code: out.order_code,
          buyer_id: input.buyer_id,
          level_code: input.level_code,
          style_count: input.styles.length,
        },
        ...meta,
      });
      return { id: out.order_id, order_code: out.order_code };
    });
  }

  async list(query: ListOrdersQuery, roleCode: string) {
    const [rows, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return {
      rows: this.maskPriceFields(rows, roleCode),
      meta: {
        current_page: query.page,
        per_page: query.per_page,
        total,
        last_page: Math.max(1, Math.ceil(total / query.per_page)),
      },
    };
  }

  async getById(id: string, roleCode: string) {
    const header = await this.repo.findById(id);
    if (!header) throw notFound();

    const [{ details, sizes }, history] = await Promise.all([
      this.repo.findDetails(id),
      this.repo.findHistory(id),
    ]);

    const data = {
      ...header,
      details: details.map((d) => ({
        ...d,
        sizes: sizes
          .filter((s) => s.order_detail_id === d.id)
          .map(({ size, qty, cancelled_qty }) => ({
            size,
            qty,
            cancelled_qty,
          })),
      })),
      status_history: history,
    };
    return this.maskPriceFields(data, roleCode);
  }
}
