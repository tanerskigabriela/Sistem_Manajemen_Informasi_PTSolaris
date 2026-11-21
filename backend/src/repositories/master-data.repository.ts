import { and, asc, eq, like, or, isNull } from "drizzle-orm";
import {
  items,
  order_level_payment_methods,
  order_levels,
  product_types,
} from "../db/schema";
import type { ListItemsQuery } from "../schemas/orders.schema";
import { BaseRepository, type FindAllOptions } from "./base.repository";

// Data master modul B yang hanya dibaca (dropdown form).

export interface Country {
  country_code: string;
  country_name: string;
}

// garment.countries milik A dan belum ada di skema Drizzle, jadi dibaca dengan mssql.
export class CountryRepository extends BaseRepository<Country> {
  constructor() {
    super("garment.countries");
  }

  async findAll(): Promise<Country[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .query<Country>(
        "SELECT country_code, country_name FROM garment.countries ORDER BY country_name",
      );
    return result.recordset;
  }

  async findById(code: string): Promise<Country | null> {
    const rows = await this.findAll();
    return rows.find((c) => c.country_code === code) ?? null;
  }
}

export type ProductType = typeof product_types.$inferSelect;

export class ProductTypeRepository extends BaseRepository<ProductType> {
  constructor() {
    super("garment.product_types");
  }

  async findAll(): Promise<ProductType[]> {
    const db = await this.getDb();
    return db
      .select()
      .from(product_types)
      .orderBy(asc(product_types.type_name));
  }

  async findById(code: string): Promise<ProductType | null> {
    const db = await this.getDb();
    const rows = await db
      .select()
      .from(product_types)
      .where(eq(product_types.type_code, code));
    return rows[0] ?? null;
  }
}

export type OrderLevel = typeof order_levels.$inferSelect & {
  payment_methods: string[];
};

export class OrderLevelRepository extends BaseRepository<OrderLevel> {
  constructor() {
    super("garment.order_levels");
  }

  async findAll(): Promise<OrderLevel[]> {
    const db = await this.getDb();
    const levels = await db
      .select()
      .from(order_levels)
      .orderBy(asc(order_levels.level_code));
    const methods = await db.select().from(order_level_payment_methods);
    return levels.map((l) => ({
      ...l,
      payment_methods: methods
        .filter((m) => m.level_code === l.level_code)
        .map((m) => m.payment_method),
    }));
  }

  async findById(code: string): Promise<OrderLevel | null> {
    const rows = await this.findAll();
    return rows.find((l) => l.level_code === code) ?? null;
  }
}

export type Item = typeof items.$inferSelect & { type_name: string };

export class ItemRepository extends BaseRepository<Item> {
  constructor() {
    super("garment.items");
  }

  private selection() {
    return {
      id: items.id,
      item_code: items.item_code,
      buyer_id: items.buyer_id,
      type_code: items.type_code,
      type_name: product_types.type_name,
      item_name: items.item_name,
      buyer_style_name: items.buyer_style_name,
      buyer_style_code: items.buyer_style_code,
      design_notes: items.design_notes,
      tech_pack_file: items.tech_pack_file,
      base_price: items.base_price,
      status: items.status,
      created_at: items.created_at,
    };
  }

  // Barang AKTIF milik buyer tertentu ditambah barang umum (tanpa buyer).
  async findAll(options: FindAllOptions = {}): Promise<Item[]> {
    const db = await this.getDb();
    const filter = {
      ...(options.filters as ListItemsQuery | undefined),
      q: options.search,
    };
    const conditions = [eq(items.status, "AKTIF")];
    if (filter.buyer_id)
      conditions.push(
        or(eq(items.buyer_id, filter.buyer_id), isNull(items.buyer_id))!,
      );
    if (filter.type_code)
      conditions.push(eq(items.type_code, filter.type_code));
    if (filter.q) {
      const pattern = `%${filter.q}%`;
      conditions.push(
        or(
          like(items.item_code, pattern),
          like(items.item_name, pattern),
          like(items.buyer_style_name, pattern),
        )!,
      );
    }
    return db
      .select(this.selection())
      .from(items)
      .innerJoin(product_types, eq(product_types.type_code, items.type_code))
      .where(and(...conditions))
      .orderBy(asc(items.item_code));
  }

  async findById(id: string): Promise<Item | null> {
    const db = await this.getDb();
    const rows = await db
      .select(this.selection())
      .from(items)
      .innerJoin(product_types, eq(product_types.type_code, items.type_code))
      .where(eq(items.id, id));
    return rows[0] ?? null;
  }
}
