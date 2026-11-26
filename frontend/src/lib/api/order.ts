import { http } from '../http';
import type { ApiSuccessResponse, PaginationMeta } from '../../types/api';

// Pemanggil endpoint modul B (KONTRAK v1 Bagian 13, v2 Bagian 14). Bentuk data mengikuti response backend B.

export interface Option {
  value: string;
  label: string;
}

export interface Country {
  country_code: string;
  country_name: string;
}

export interface ProductType {
  type_code: string;
  type_name: string;
}

export interface OrderLevel {
  level_code: string;
  level_name: string;
  standard_lead_time_days: number;
  minimum_order_qty: number;
  payment_methods: string[];
}

export interface Item {
  id: string;
  item_code: string;
  buyer_id: string | null;
  type_code: string;
  type_name: string;
  item_name: string;
  buyer_style_name: string | null;
  base_price?: number | null;
}

export interface Buyer {
  id: string;
  buyer_code: string;
  buyer_name: string;
  buyer_type: 'LOKAL' | 'ASING';
  country_code: string;
  contact_name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  tax_id_no: string | null;
  default_currency: string;
  payment_term_days: number;
}

export type BuyerInput = Omit<Buyer, 'id'>;

export interface OrderSummary {
  order_id: string;
  order_code: string;
  order_date: string;
  deadline: string;
  status: string;
  level_code: string;
  scheme: string;
  currency: string;
  reject_limit_pct: number;
  is_at_risk: boolean;
  is_over_reject: boolean;
  buyer_id: string;
  buyer_code: string;
  buyer_name: string;
  handled_by_name: string;
  style_count: number;
  total_qty: number;
  total_value?: number;
  shipped_qty: number;
  remaining_shipment: number;
}

export interface OrderDetail extends OrderSummary {
  buyer_po_no: string | null;
  late_penalty: string;
  incoterm: string | null;
  destination_country: string | null;
  destination_port: string | null;
  notes: string | null;
  details: {
    id: string;
    item_code: string;
    item_name: string;
    buyer_style_name: string | null;
    type_name: string;
    color: string;
    unit_price?: number;
    discount_pct?: number;
    completion_pct: number;
    sizes: { size: string; qty: number; cancelled_qty: number }[];
  }[];
  status_history: { status: string; changed_by_name: string; reason: string | null; changed_at: string }[];
}

export interface NewOrderStyle {
  item_id: string | null;
  type_code?: string;
  item_name?: string;
  buyer_style_name?: string;
  color: string;
  unit_price: number;
  discount_pct: number;
  sizes: { size: string; qty: number }[];
}

export interface NewOrderInput {
  buyer_id: string;
  level_code: string;
  deadline: string;
  scheme: string;
  reject_limit_pct: number;
  late_penalty: string;
  buyer_po_no?: string;
  notes?: string;
  currency?: string;
  exchange_rate?: number;
  incoterm?: string;
  destination_country?: string;
  destination_port?: string;
  styles: NewOrderStyle[];
  confirmed: boolean;
}

export interface CancellationPreview {
  order_code: string;
  currency: string;
  stage_code_at_request: string | null;
  penalty_pct: number;
  down_payment_refund_pct: number;
  total_value: number;
  dp_paid: number;
  penalty_amount: number;
  refund_amount: number;
}

export interface Expedition {
  id: string;
  expedition_name: string;
  coverage: string;
}

export interface ReadyToShip {
  order_id: string;
  order_code: string;
  status: string;
  level_code: string;
  buyer_name: string;
  buyer_address: string;
  buyer_city: string;
  can_ship: boolean;
  styles: {
    order_detail_id: string;
    item_code: string;
    item_name: string;
    color: string;
    style_ready_qty: number;
    sizes: { size: string; ordered_qty: number; shipped_qty: number; ready_qty: number }[];
  }[];
}

export interface ShipmentRow {
  id: string;
  delivery_note_no: string;
  ship_date: string;
  status: string;
  order_code: string;
  buyer_name: string;
  expedition_name: string;
  total_qty: number;
}

export interface NewShipmentInput {
  order_id: string;
  ship_date: string;
  expedition_id: string;
  destination_address: string;
  package_count?: number;
  items: { order_detail_id: string; size: string; qty: number }[];
}

export interface DeliveryNote {
  delivery_note_no: string;
  ship_date: string;
  estimated_arrival: string | null;
  destination_address: string;
  package_count: number | null;
  total_weight_kg: number | null;
  order_code: string;
  buyer_po_no: string | null;
  buyer_name: string;
  buyer_phone: string;
  factory_name: string;
  factory_address: string;
  factory_city: string;
  factory_phone: string;
  warehouse_name: string;
  expedition_name: string;
  expedition_contact: string;
  expedition_phone: string;
  plate_no: string | null;
  recorded_by_name: string;
  total_qty: number;
  items: { line_no: number; item_code: string; item_name: string; color: string; size: string; qty: number }[];
}

export interface DashboardData {
  summary: {
    total_orders: number;
    waiting_approval: number;
    approved: number;
    in_production: number;
    finished: number;
    at_risk: number;
    over_reject: number;
  };
  orders: {
    order_id: string;
    order_code: string;
    buyer_name: string;
    deadline: string;
    status: string;
    completion_pct: number;
    time_pct: number;
    reject_pct: number;
    is_at_risk: boolean;
    is_over_reject: boolean;
    remaining_shipment: number;
  }[];
}

export interface Paged<T> {
  rows: T[];
  meta?: PaginationMeta;
}

async function get<T>(url: string, params?: object): Promise<T> {
  const res = await http.get<ApiSuccessResponse<T>>(url, { params });
  return res.data.data;
}

async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const res = await http.get<ApiSuccessResponse<T[]>>(url, { params });
  return { rows: res.data.data, meta: res.data.meta };
}

async function post<T>(url: string, body?: object): Promise<{ data: T; message?: string }> {
  const res = await http.post<ApiSuccessResponse<T>>(url, body ?? {});
  return { data: res.data.data, message: res.data.message };
}

// Buang isian kosong supaya backend menerima undefined, bukan string kosong
function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined)) as Partial<T>;
}

export const orderApi = {
  countries: () => get<Country[]>('/countries'),
  productTypes: () => get<ProductType[]>('/product-types'),
  orderLevels: () => get<OrderLevel[]>('/order-levels'),
  items: (buyerId: string) => get<Item[]>('/items', { buyer_id: buyerId }),

  buyers: (params: { page?: number; q?: string; per_page?: number }) => getPaged<Buyer>('/buyers', clean(params)),
  createBuyer: (body: BuyerInput) => post<Buyer>('/buyers', body),
  updateBuyer: async (id: string, body: Partial<BuyerInput>) => {
    const res = await http.patch<ApiSuccessResponse<Buyer>>(`/buyers/${id}`, body);
    return { data: res.data.data, message: res.data.message };
  },

  orders: (params: { page?: number; q?: string; status?: string; date_from?: string; date_to?: string }) =>
    getPaged<OrderSummary>('/orders', clean(params)),
  order: (id: string) => get<OrderDetail>(`/orders/${id}`),
  createOrder: (body: NewOrderInput) => post<{ id: string; order_code: string }>('/orders', body),
  approve: (id: string) => post(`/orders/${id}/approve`),
  reject: (id: string, reason: string) => post(`/orders/${id}/reject`, { reason }),
  withdraw: (id: string, reason: string) => post(`/orders/${id}/withdraw`, { reason }),
  cancellationPreview: (id: string) => get<CancellationPreview>(`/orders/${id}/cancellation-preview`),
  cancel: (id: string, reason: string, requested_by_party: string) =>
    post<{ penalty_amount: number; refund_amount: number }>(`/orders/${id}/cancel`, { reason, requested_by_party }),

  expeditions: (levelCode?: string) => get<Expedition[]>('/expeditions', clean({ level_code: levelCode })),
  readyToShip: (orderId: string) => get<ReadyToShip>(`/orders/${orderId}/ready-to-ship`),
  shipments: (params: { page?: number; q?: string }) => getPaged<ShipmentRow>('/shipments', clean(params)),
  createShipment: (body: NewShipmentInput) => post<{ id: string; delivery_note_no: string }>('/shipments', body),
  deliveryNote: (id: string) => get<DeliveryNote>(`/shipments/${id}/delivery-note`),

  dashboard: () => get<DashboardData>('/dashboard'),
};
