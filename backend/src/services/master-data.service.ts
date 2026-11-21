import {
  CountryRepository,
  ItemRepository,
  OrderLevelRepository,
  ProductTypeRepository,
} from "../repositories/master-data.repository";
import type { ListItemsQuery } from "../schemas/orders.schema";
import { BaseService } from "./base.service";

export class MasterDataService extends BaseService {
  private readonly countries = new CountryRepository();
  private readonly productTypes = new ProductTypeRepository();
  private readonly orderLevels = new OrderLevelRepository();
  private readonly items = new ItemRepository();

  listCountries() {
    return this.countries.findAll();
  }

  listProductTypes() {
    return this.productTypes.findAll();
  }

  listOrderLevels() {
    return this.orderLevels.findAll();
  }

  // base_price ikut disembunyikan untuk role selain MARKETING dan PIMPINAN
  async listItems(query: ListItemsQuery, roleCode: string) {
    const { q, ...filters } = query;
    const rows = await this.items.findAll({ search: q, filters });
    return this.maskPriceFields(rows, roleCode);
  }
}
