import { z } from 'zod';
import { ORDER_LEVEL, ORDER_STATUS } from '../constants';
import { MSG } from '../errors/order.errors';
import { pageQuery } from './buyers.schema';

const isoDate = z
  .string({ required_error: MSG.REQUIRED })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD.');
const uuid = (message: string = MSG.REQUIRED) => z.string({ required_error: MSG.REQUIRED }).uuid(message);
const optionalPositive = z.coerce.number().positive(MSG.POSITIVE).nullish();

// Satu baris barang = satu style + satu ukuran (RB-50: jumlah > 0)
const shipmentItem = z.object({
  order_detail_id: uuid('Format ID tidak valid.'),
  size: z.string({ required_error: MSG.REQUIRED }).trim().min(1, MSG.REQUIRED).max(10),
  qty: z.coerce.number({ required_error: MSG.REQUIRED }).int('Jumlah harus bilangan bulat.').positive(MSG.POSITIVE),
  carton_no: z.string().trim().max(20).nullish(),
});

// FSD 2.15 Catat Pengiriman
export const createShipmentSchema = z
  .object({
    order_id: uuid('Format ID tidak valid.'),
    ship_date: isoDate,
    expedition_id: uuid('Format ID tidak valid.'),
    destination_address: z.string({ required_error: MSG.REQUIRED }).trim().min(1, MSG.REQUIRED).max(200),
    route_id: z.string().uuid('Format ID tidak valid.').nullish(),
    vehicle_id: z.string().uuid('Format ID tidak valid.').nullish(),
    estimated_arrival: isoDate.nullish(),
    package_count: z.coerce.number().int().positive(MSG.POSITIVE).nullish(),
    total_weight_kg: optionalPositive,
    volume_m3: optionalPositive,
    shipping_cost: z.coerce.number().min(0, 'Nilai tidak boleh negatif.').nullish(),
    items: z.array(shipmentItem, { required_error: MSG.REQUIRED }).min(1, MSG.REQUIRED),
  })
  .superRefine((s, ctx) => {
    if (s.estimated_arrival && s.estimated_arrival < s.ship_date)
      ctx.addIssue({ code: 'custom', path: ['estimated_arrival'], message: 'Perkiraan tiba tidak boleh sebelum tanggal kirim.' });
    const seen = new Set<string>();
    s.items.forEach((it, i) => {
      const key = `${it.order_detail_id.toUpperCase()}|${it.size.toUpperCase()}`;
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['items', i, 'size'], message: 'Style dan ukuran ini sudah ada di baris lain.' });
      seen.add(key);
    });
  });

export const listShipmentsQuery = z
  .object({
    ...pageQuery,
    order_id: z.string().uuid('Format ID tidak valid.').optional(),
    date_from: isoDate.optional(),
    date_to: isoDate.optional(),
  })
  .refine((q) => !q.date_from || !q.date_to || q.date_from <= q.date_to, {
    path: ['date_from'],
    message: MSG.DATE_RANGE,
  });

export const listExpeditionsQuery = z.object({
  level_code: z.nativeEnum(ORDER_LEVEL).optional(),
});

export const dashboardQuery = z.object({
  status: z.nativeEnum(ORDER_STATUS).optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuery>;
export type ListExpeditionsQuery = z.infer<typeof listExpeditionsQuery>;
export type DashboardQuery = z.infer<typeof dashboardQuery>;
