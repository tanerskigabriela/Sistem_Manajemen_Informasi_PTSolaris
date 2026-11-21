import { ACTION_TYPE } from "../constants";
import { MSG, fieldError, notFound } from "../errors/order.errors";
import { BuyerRepository } from "../repositories/buyers.repository";
import type {
  CreateBuyerInput,
  ListBuyersQuery,
  UpdateBuyerInput,
} from "../schemas/buyers.schema";
import type { Actor } from "../utils/order-actor";
import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

interface RequestMeta {
  device: string | null;
  ip_address: string;
}

export class BuyerService extends BaseService {
  private readonly repo = new BuyerRepository();

  async list(query: ListBuyersQuery) {
    const [rows, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return {
      rows,
      meta: {
        current_page: query.page,
        per_page: query.per_page,
        total,
        last_page: Math.max(1, Math.ceil(total / query.per_page)),
      },
    };
  }

  async getById(id: string) {
    const buyer = await this.repo.findById(id);
    if (!buyer) throw notFound();
    return buyer;
  }

  async create(input: CreateBuyerInput, actor: Actor, meta: RequestMeta) {
    return this.runInTransaction(async (tx) => {
      if (await this.repo.codeExists(tx, input.buyer_code))
        throw new AppError(409, "ERR-VAL-05", MSG.BUYER_CODE_TAKEN, [
          { field: "buyer_code", message: MSG.BUYER_CODE_TAKEN },
        ]);
      if (!(await this.repo.countryExists(tx, input.country_code)))
        throw fieldError([
          { field: "country_code", message: "Negara tidak terdaftar." },
        ]);

      const id = await this.repo.create(tx, input);
      await this.recordActivity(tx, {
        user_id: actor.user_id,
        username: actor.username,
        action_type: ACTION_TYPE.TAMBAH,
        resource_type: "buyers",
        resource_id: id,
        new_values: input,
        ...meta,
      });
      return { id, ...input };
    });
  }

  async update(
    id: string,
    input: UpdateBuyerInput,
    actor: Actor,
    meta: RequestMeta,
  ) {
    return this.runInTransaction(async (tx) => {
      const old = await this.repo.findByIdForUpdate(tx, id);
      if (!old) throw notFound();
      if (
        input.country_code &&
        !(await this.repo.countryExists(tx, input.country_code))
      )
        throw fieldError([
          { field: "country_code", message: "Negara tidak terdaftar." },
        ]);

      // hanya kolom yang benar-benar berubah yang disimpan dan dicatat di log
      const changed: Record<string, unknown> = {};
      const before: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        const oldValue = old[key as keyof typeof old];
        if (String(oldValue ?? "").trim() !== String(value ?? "").trim()) {
          changed[key] = value;
          before[key] = oldValue;
        }
      }
      if (Object.keys(changed).length === 0) return old;

      await this.repo.update(tx, id, changed as UpdateBuyerInput);
      await this.recordActivity(tx, {
        user_id: actor.user_id,
        username: actor.username,
        action_type: ACTION_TYPE.UBAH,
        resource_type: "buyers",
        resource_id: id,
        old_values: before,
        new_values: changed,
        ...meta,
      });
      return { ...old, ...changed };
    });
  }
}
