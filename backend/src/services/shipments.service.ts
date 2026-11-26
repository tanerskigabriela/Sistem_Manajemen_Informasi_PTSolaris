import { ACTION_TYPE, ORDER_STATUS } from '../constants';
import { exceedsReadyToShip, notFound, shipmentError } from '../errors/order.errors';
import { ExpeditionRepository, ShipmentRepository } from '../repositories/shipments.repository';
import type { CreateShipmentInput, ListExpeditionsQuery, ListShipmentsQuery } from '../schemas/shipments.schema';
import type { Actor } from '../utils/order-actor';
import type { RequestMeta } from '../utils/request-meta';
import { BaseService } from './base.service';

// FSD 2.15 Catat Pengiriman, Surat Jalan, dan Riwayat Pengiriman
export class ShipmentService extends BaseService {
  private readonly repo = new ShipmentRepository();
  private readonly expeditions = new ExpeditionRepository();

  listExpeditions(query: ListExpeditionsQuery) {
    return this.expeditions.findAll({ filters: query });
  }

  async readyToShip(orderId: string) {
    const { order, rows } = await this.repo.readyToShip(orderId);
    if (!order) throw notFound();

    // Kelompokkan per style supaya form SCR-16 bisa menampilkan satu baris style berisi ukurannya
    const styles = new Map<string, {
      order_detail_id: string;
      item_code: string;
      item_name: string;
      buyer_style_name: string | null;
      color: string;
      style_ready_qty: number;
      sizes: { size: string; ordered_qty: number; shipped_qty: number; ready_qty: number }[];
    }>();
    for (const r of rows) {
      const style = styles.get(r.order_detail_id) ?? {
        order_detail_id: r.order_detail_id,
        item_code: r.item_code,
        item_name: r.item_name,
        buyer_style_name: r.buyer_style_name,
        color: r.color,
        style_ready_qty: r.style_ready_qty,
        sizes: [],
      };
      style.sizes.push({ size: r.size, ordered_qty: r.ordered_qty, shipped_qty: r.shipped_qty, ready_qty: r.ready_qty });
      styles.set(r.order_detail_id, style);
    }

    return {
      ...order,
      can_ship: order.status === ORDER_STATUS.DALAM_PRODUKSI,
      styles: [...styles.values()],
    };
  }

  async create(input: CreateShipmentInput, actor: Actor, meta: RequestMeta) {
    return this.runInTransaction(async (tx) => {
      const out = await this.repo.create(tx, actor.employee_id, input);

      // EXCEEDS:{order_detail_id}:{ukuran atau *}:{maksimum}
      if (out.result.startsWith('EXCEEDS:')) {
        const [, detailId, size, max] = out.result.split(':');
        const itemCode = (await this.repo.itemCode(detailId)) ?? detailId;
        throw exceedsReadyToShip(itemCode, size, Number(max));
      }
      if (out.result !== 'SUCCESS' || !out.shipment_id) throw shipmentError(out.result);

      await this.recordActivity(tx, {
        user_id: actor.user_id,
        username: actor.username,
        action_type: ACTION_TYPE.TAMBAH,
        resource_type: 'garment.shipments',
        resource_id: out.shipment_id,
        new_values: {
          delivery_note_no: out.delivery_note_no,
          order_id: input.order_id,
          expedition_id: input.expedition_id,
          ship_date: input.ship_date,
          items: input.items,
        },
        ...meta,
      });
      return { id: out.shipment_id, delivery_note_no: out.delivery_note_no };
    });
  }

  async list(query: ListShipmentsQuery) {
    const [rows, total] = await Promise.all([this.repo.findAll(query), this.repo.count(query)]);
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

  async deliveryNote(id: string) {
    const { header, lines } = await this.repo.deliveryNote(id);
    if (!header) throw notFound();
    return { ...header, total_qty: lines.reduce((sum, l) => sum + l.qty, 0), items: lines };
  }
}
