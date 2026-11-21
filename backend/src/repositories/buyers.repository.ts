import { and, asc, count, eq, like, or, type SQL } from "drizzle-orm";
import sql from "mssql";
import { buyers } from "../db/schema";
import type {
  CreateBuyerInput,
  ListBuyersQuery,
  UpdateBuyerInput,
} from "../schemas/buyers.schema";
import { BaseRepository } from "./base.repository";

export type Buyer = typeof buyers.$inferSelect;

// Tipe kolom untuk INSERT/UPDATE lewat mssql (nama kolom = nama field)
const COLUMN_TYPES: Record<string, sql.ISqlType | (() => sql.ISqlType)> = {
  buyer_code: sql.Char(3),
  buyer_name: sql.NVarChar(100),
  buyer_type: sql.VarChar(5),
  country_code: sql.Char(2),
  contact_name: sql.NVarChar(100),
  phone: sql.VarChar(20),
  email: sql.VarChar(100),
  address: sql.NVarChar(200),
  city: sql.NVarChar(50),
  tax_id_no: sql.VarChar(30),
  default_currency: sql.Char(3),
  payment_term_days: sql.SmallInt,
  credit_limit: sql.Decimal(16, 2),
};

export class BuyerRepository extends BaseRepository<Buyer> {
  constructor() {
    super("garment.buyers");
  }

  private where(filter: ListBuyersQuery): SQL | undefined {
    const conditions: SQL[] = [];
    if (filter.buyer_type)
      conditions.push(eq(buyers.buyer_type, filter.buyer_type));
    if (filter.q) {
      const pattern = `%${filter.q}%`;
      conditions.push(
        or(like(buyers.buyer_code, pattern), like(buyers.buyer_name, pattern))!,
      );
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async findAll(filter: ListBuyersQuery): Promise<Buyer[]> {
    const db = await this.getDb();
    return db
      .select()
      .from(buyers)
      .where(this.where(filter))
      .orderBy(asc(buyers.buyer_code))
      .offset((filter.page - 1) * filter.per_page)
      .fetch(filter.per_page);
  }

  async count(filter: ListBuyersQuery): Promise<number> {
    const db = await this.getDb();
    const rows = await db
      .select({ total: count() })
      .from(buyers)
      .where(this.where(filter));
    return Number(rows[0]?.total ?? 0);
  }

  async findById(id: string): Promise<Buyer | null> {
    const db = await this.getDb();
    const rows = await db.select().from(buyers).where(eq(buyers.id, id));
    return rows[0] ?? null;
  }

  // Dipakai di dalam transaksi supaya pengecekan dan penyimpanan memakai koneksi yang sama
  async codeExists(tx: sql.Transaction, code: string): Promise<boolean> {
    const result = await new sql.Request(tx)
      .input("code", sql.Char(3), code)
      .query(
        "SELECT 1 AS found FROM garment.buyers WITH (UPDLOCK, HOLDLOCK) WHERE buyer_code = @code",
      );
    return result.recordset.length > 0;
  }

  async countryExists(tx: sql.Transaction, code: string): Promise<boolean> {
    const result = await new sql.Request(tx)
      .input("code", sql.Char(2), code)
      .query(
        "SELECT 1 AS found FROM garment.countries WHERE country_code = @code",
      );
    return result.recordset.length > 0;
  }

  async findByIdForUpdate(
    tx: sql.Transaction,
    id: string,
  ): Promise<Buyer | null> {
    const result = await new sql.Request(tx)
      .input("id", sql.UniqueIdentifier, id)
      .query<Buyer>(
        "SELECT * FROM garment.buyers WITH (UPDLOCK, ROWLOCK) WHERE id = @id",
      );
    return result.recordset[0] ?? null;
  }

  async create(tx: sql.Transaction, input: CreateBuyerInput): Promise<string> {
    const request = new sql.Request(tx);
    const columns = Object.keys(input).filter((c) => c in COLUMN_TYPES);
    for (const col of columns)
      request.input(
        col,
        COLUMN_TYPES[col],
        input[col as keyof CreateBuyerInput],
      );
    const result = await request.query<{ id: string }>(`
      INSERT INTO garment.buyers (${columns.join(", ")})
      OUTPUT INSERTED.id
      VALUES (${columns.map((c) => `@${c}`).join(", ")})`);
    return result.recordset[0].id;
  }

  async update(
    tx: sql.Transaction,
    id: string,
    input: UpdateBuyerInput,
  ): Promise<void> {
    const request = new sql.Request(tx).input("id", sql.UniqueIdentifier, id);
    const columns = Object.keys(input).filter(
      (c) =>
        c in COLUMN_TYPES && input[c as keyof UpdateBuyerInput] !== undefined,
    );
    for (const col of columns)
      request.input(
        col,
        COLUMN_TYPES[col],
        input[col as keyof UpdateBuyerInput],
      );
    await request.query(`
      UPDATE garment.buyers
      SET ${columns.map((c) => `${c} = @${c}`).join(", ")}, updated_at = SYSDATETIME()
      WHERE id = @id`);
  }
}
