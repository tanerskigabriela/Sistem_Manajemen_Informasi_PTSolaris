import { ORDER_STATUS } from '../constants';
import { DashboardRepository } from '../repositories/dashboard.repository';
import type { DashboardQuery } from '../schemas/shipments.schema';
import { BaseService } from './base.service';

// FSD 2.14 Dashboard Pimpinan
export class DashboardService extends BaseService {
  private readonly repo = new DashboardRepository();

  async get(query: DashboardQuery) {
    const orders = await this.repo.findAll({ filters: query });

    // Kartu ringkasan dihitung dari baris yang sama dengan tabel, supaya angkanya selalu cocok
    const count = (status: string) => orders.filter((o) => o.status === status).length;
    const summary = {
      total_orders: orders.length,
      waiting_approval: count(ORDER_STATUS.MENUNGGU_PERSETUJUAN),
      approved: count(ORDER_STATUS.DISETUJUI),
      in_production: count(ORDER_STATUS.DALAM_PRODUKSI),
      finished: count(ORDER_STATUS.SELESAI),
      cancelled: count(ORDER_STATUS.DIBATALKAN),
      at_risk: orders.filter((o) => o.is_at_risk).length,
      over_reject: orders.filter((o) => o.is_over_reject).length,
    };
    return { summary, orders };
  }
}
