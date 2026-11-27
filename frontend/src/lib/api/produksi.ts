import { http } from '../http';
import type { ApiSuccessResponse, PaginationMeta } from '../../types/api';

// Pemanggil endpoint modul C (Produksi). Bentuk data mengikuti response backend C
// (routes: suppliers, master-produksi, order-materials, spk, progress, qc-results).

export const STAGES = ['CUTTING', 'SEWING', 'TRIMMING', 'FINISHING', 'IRONING', 'PACKING'] as const;
export const QC_STAGES = ['CUTTING', 'SEWING', 'TRIMMING', 'FINISHING', 'IRONING'] as const;
export type StageCode = (typeof STAGES)[number];

export const PAYMENT_TERMS = [
  { value: 'LUNAS_AWAL', label: 'Lunas di awal' },
  { value: 'DP', label: 'DP' },
  { value: 'KREDIT', label: 'Kredit (Tempo)' },
] as const;

// ---------- Supplier (SCR-09) ----------
export interface Supplier {
  id: string;
  supplier_name: string;
  supplier_type: 'LOKAL' | 'IMPOR';
  country_code: string;
  contact_name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  currency: string;
  tax_id_no: string | null;
  rating: number | null;
  payment_term: 'LUNAS_AWAL' | 'DP' | 'KREDIT';
  payment_term_days: number;
  is_active: boolean;
}

export type SupplierInput = Omit<Supplier, 'id' | 'is_active' | 'rating'>;

export interface SupplierMaterial {
  order_code: string;
  item_code: string;
  color: string;
  material_code: string;
  material_name: string;
  qty: number;
  unit: string;
  material_price?: number | null;
  received_date: string;
}

// ---------- Data master ----------
export interface RawMaterial {
  id: string;
  material_code: string;
  material_name: string;
  category_name: string;
  color: string | null;
  unit: string;
}

export interface ProductionLine {
  id: string;
  line_name: string;
  capacity_pcs_per_day: number;
  factory_name: string;
  supervisor_name: string;
}

export interface DefectType {
  id: string;
  defect_name: string;
  level: string;
}

export interface QcStandard {
  id: string;
  type_code: string | null;
  parameter_name: string;
  tolerance_value: string;
  sampling_reference: string;
}

// ---------- Bahan per style (SCR-10) ----------
export interface StyleHeader {
  order_detail_id: string;
  order_id: string;
  order_code: string;
  order_status: string;
  item_code: string;
  item_name: string;
  color: string;
  readiness: 'SIAP' | 'BELUM_SIAP';
  locked: boolean;
}

export interface OrderMaterial {
  id: string;
  material_id: string;
  material_code: string;
  material_name: string;
  qty: number;
  unit: string;
  source: 'BUYER' | 'SUPPLIER';
  supplier_id: string | null;
  supplier_name: string | null;
  material_price?: number | null;
  received_date: string;
  checked_by_name: string;
  checked_at: string;
}

export interface MaterialInput {
  material_id: string;
  qty: number;
  unit?: string;
  source: 'BUYER' | 'SUPPLIER';
  supplier_id?: string | null;
  material_price?: number | null;
  received_date: string;
  eligibility_confirmed: boolean;
}

// ---------- SPK (SCR-11, SCR-08) ----------
export interface SpkRow {
  spk_id: string;
  spk_no: string;
  order_id: string;
  order_code: string;
  order_status: string;
  order_detail_id: string;
  item_code: string;
  item_name: string;
  color: string;
  line_name: string;
  total_qty: number;
  target_date: string;
  status: string;
  approved_at: string | null;
  created_at: string;
}

export interface StageSummary {
  stage_code: StageCode;
  stage_name: string;
  sequence: number;
  cumulative_done: number;
  cumulative_passed: number | null;
  max_allowed: number;
  remaining: number;
}

export interface SpkDetail extends SpkRow {
  line_id: string;
  created_by_name: string;
  decided_by_name: string | null;
  reject_reason: string | null;
  sizes: { size: string; qty: number }[];
  stages: StageSummary[];
}

export interface SpkInput {
  order_detail_id: string;
  line_id: string;
  target_date: string;
  sizes: { size: string; qty: number }[];
  materials_complete_confirmed: boolean;
}

// ---------- Progres (SCR-12) ----------
export interface ProgressEntry {
  id: string;
  stage_code: StageCode;
  stage_name: string;
  work_date: string;
  qty_done: number;
  variance_note: string | null;
  recorded_by_name: string;
}

export interface ProgressView {
  spk_id: string;
  spk_no: string;
  order_code: string;
  item_code: string;
  color: string;
  total_qty: number;
  stages: StageSummary[];
  entries: ProgressEntry[];
}

// ---------- Hasil QC (SCR-13) ----------
export interface QcStageSummary {
  stage_code: StageCode;
  stage_name: string;
  cumulative_done: number;
  cumulative_passed: number;
  failed: number;
  failed_pct: number;
  max_passed_input: number;
}

export interface QcView {
  spk_id: string;
  spk_no: string;
  order_code: string;
  item_code: string;
  color: string;
  stages: QcStageSummary[];
  style: { reject_pct: number; reject_limit_pct: number; is_over_reject: boolean };
}

export interface QcInput {
  stage_code: StageCode;
  check_date: string;
  qty_passed: number;
  standard_id: string;
  sample_qty?: number | null;
  defects: { defect_type_id: string; qty: number }[];
}

// ---------- helper ----------
async function get<T>(url: string, params?: object): Promise<T> {
  const res = await http.get<ApiSuccessResponse<T>>(url, { params });
  return res.data.data;
}

async function getPaged<T>(url: string, params?: object): Promise<{ rows: T[]; meta?: PaginationMeta }> {
  const res = await http.get<ApiSuccessResponse<T[]>>(url, { params });
  return { rows: res.data.data, meta: res.data.meta };
}

async function send<T>(method: 'post' | 'patch', url: string, body?: object): Promise<{ data: T; message?: string }> {
  const res = await http[method]<ApiSuccessResponse<T>>(url, body ?? {});
  return { data: res.data.data, message: res.data.message };
}

function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as Partial<T>;
}

export const produksiApi = {
  // SCR-09
  suppliers: (params: { search?: string } = {}) => get<Supplier[]>('/suppliers', clean(params)),
  createSupplier: (body: SupplierInput) => send<Supplier>('post', '/suppliers', body),
  updateSupplier: (id: string, body: Partial<SupplierInput>) => send<Supplier>('patch', `/suppliers/${id}`, body),
  supplierMaterials: (id: string) => get<SupplierMaterial[]>(`/suppliers/${id}/materials`),

  // Data master
  rawMaterials: () => get<RawMaterial[]>('/raw-materials'),
  productionLines: (orderDetailId?: string) =>
    get<ProductionLine[]>('/production-lines', clean({ order_detail_id: orderDetailId })),
  defectTypes: () => get<DefectType[]>('/defect-types'),
  qcStandards: (typeCode?: string) => get<QcStandard[]>('/qc-standards', clean({ type_code: typeCode })),

  // SCR-10
  styleMaterials: (orderDetailId: string) =>
    get<StyleHeader & { materials: OrderMaterial[] }>(`/order-details/${orderDetailId}/materials`),
  addMaterial: (orderDetailId: string, body: MaterialInput) =>
    send<{ id: string; readiness: string }>('post', `/order-details/${orderDetailId}/materials`, body),
  updateMaterial: (id: string, body: Partial<MaterialInput>) =>
    send<{ id: string; readiness: string }>('patch', `/materials/${id}`, body),

  // SCR-11 / SCR-08
  spkList: (params: { status?: string; order_id?: string; page?: number; per_page?: number } = {}) =>
    getPaged<SpkRow>('/spk', clean({ per_page: 100, ...params })),
  spk: (id: string) => get<SpkDetail>(`/spk/${id}`),
  submitSpk: (body: SpkInput) => send<{ id: string; spk_no: string; status: string }>('post', '/spk', body),
  approveSpk: (id: string) => send<{ id: string; status: string; order_status: string }>('post', `/spk/${id}/approve`),
  rejectSpk: (id: string, reason: string) => send<{ id: string; status: string }>('post', `/spk/${id}/reject`, { reason }),

  // SCR-12
  progress: (spkId: string) => get<ProgressView>(`/spk/${spkId}/progress`),
  addProgress: (spkId: string, body: { stage_code: StageCode; work_date: string; qty_done: number; variance_note?: string | null }) =>
    send<{ id: string; cumulative_done: number; remaining: number }>('post', `/spk/${spkId}/progress`, body),
  updateProgress: (id: string, body: { qty_done: number; variance_note?: string | null }) =>
    send<{ id: string; cumulative_done: number; remaining: number }>('patch', `/progress/${id}`, body),

  // SCR-13
  qcResults: (spkId: string) => get<QcView>(`/spk/${spkId}/qc-results`),
  addQcResult: (spkId: string, body: QcInput) =>
    send<{ id: string; failed: number; failed_pct: number }>('post', `/spk/${spkId}/qc-results`, body),
};

/** Kode jenis produk diambil dari kode barang BBB-JJ-NNNN (bagian JJ). */
export function typeCodeOf(itemCode: string): string | undefined {
  return itemCode.split('-')[1];
}
