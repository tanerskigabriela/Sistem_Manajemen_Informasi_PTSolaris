/**
 * Dokumentasi Swagger modul C (produksi).
 * Digabung ke swaggerDocument di docs/swagger.ts.
 *
 * Login dulu lewat POST /auth/login (cookie `token` otomatis tersimpan di browser),
 * lalu endpoint di bawah bisa langsung dicoba sesuai role akun.
 */

const uuid = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date', example: '2026-12-20' };
const security = [{ cookieAuth: [] }];

const idParam = (description: string) => ({
  name: 'id',
  in: 'path',
  required: true,
  description,
  schema: uuid,
});

const queryParam = (name: string, schema: object, description?: string) => ({
  name,
  in: 'query',
  required: false,
  ...(description ? { description } : {}),
  schema,
});

const jsonBody = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
});

/** Respons sukses dan daftar kode error FSD per endpoint. */
const responses = (success: string, errors: Record<string, string> = {}) => ({
  '200': { description: success },
  '401': { description: 'ERR-AUTH-01 Silakan login terlebih dahulu.' },
  '403': { description: 'ERR-AUTH-03 Anda tidak memiliki akses ke halaman ini.' },
  ...Object.fromEntries(Object.entries(errors).map(([code, d]) => [code, { description: d }])),
});

const created = (success: string, errors: Record<string, string> = {}) => {
  const { '200': _ok, ...rest } = responses(success, errors);
  return { '201': { description: success }, ...rest };
};

const supplierBody = {
  type: 'object',
  properties: {
    supplier_name: { type: 'string', example: 'PT Kain Nusantara' },
    supplier_type: { type: 'string', enum: ['LOKAL', 'IMPOR'] },
    country_code: { type: 'string', example: 'ID' },
    contact_name: { type: 'string', example: 'Budi' },
    phone: { type: 'string', example: '0811111111' },
    email: { type: 'string', nullable: true, example: 'sales@kain.co.id' },
    address: { type: 'string', example: 'Jl. Industri 1' },
    city: { type: 'string', example: 'Bandung' },
    currency: { type: 'string', example: 'IDR' },
    tax_id_no: { type: 'string', nullable: true },
    rating: { type: 'number', nullable: true, example: 4.5 },
    payment_term: { type: 'string', enum: ['LUNAS_AWAL', 'DP', 'KREDIT'] },
    payment_term_days: { type: 'integer', example: 30 },
  },
};

const materialBody = {
  type: 'object',
  properties: {
    material_id: { ...uuid, description: 'id dari GET /raw-materials' },
    qty: { type: 'number', example: 120 },
    unit: { type: 'string', description: 'Kosongkan untuk memakai satuan master bahan' },
    source: { type: 'string', enum: ['BUYER', 'SUPPLIER'] },
    supplier_id: { ...uuid, nullable: true, description: 'Wajib bila source = SUPPLIER' },
    material_price: { type: 'number', nullable: true, description: 'Wajib bila source = SUPPLIER' },
    received_date: date,
    eligibility_confirmed: { type: 'boolean', example: true },
  },
};

export const produksiTags = [
  { name: 'C - Supplier', description: 'Data supplier (FSD-2.8)' },
  { name: 'C - Data master', description: 'Dropdown bahan, lini, jenis cacat, standar QC' },
  { name: 'C - Bahan baku style', description: 'Catat dan ubah bahan per style (FSD-2.9)' },
  { name: 'C - SPK', description: 'Buat, daftar, detail, setujui, tolak SPK (FSD-2.10, 2.11)' },
  { name: 'C - Progres', description: 'Progres harian per SPK dan tahap (FSD-2.12)' },
  { name: 'C - Hasil QC', description: 'Hasil QC per SPK dan tahap, standar, sampel, jenis cacat (FSD-2.13)' },
];

const stageEnum = {
  type: 'string',
  enum: ['CUTTING', 'SEWING', 'TRIMMING', 'FINISHING', 'IRONING', 'PACKING'],
};

/** Modul C memakai cookieAuth milik A (auth.swagger.ts); tidak ada skema tambahan. */
export const produksiSecuritySchemes = {};

export const produksiPaths = {
  '/suppliers': {
    get: {
      tags: ['C - Supplier'],
      summary: 'Daftar supplier (PPIC, PIMPINAN)',
      security,
      parameters: [
        queryParam('search', { type: 'string' }, 'Cari nama atau kota'),
        queryParam('is_active', { type: 'string', enum: ['true', 'false'] }),
      ],
      responses: responses('Daftar supplier'),
    },
    post: {
      tags: ['C - Supplier'],
      summary: 'Tambah supplier (PPIC)',
      security,
      requestBody: jsonBody(supplierBody),
      responses: created('Supplier berhasil disimpan.', {
        '422': 'ERR-VAL-01 Kolom ini wajib diisi.',
      }),
    },
  },
  '/suppliers/{id}': {
    patch: {
      tags: ['C - Supplier'],
      summary: 'Ubah supplier (PPIC)',
      security,
      parameters: [idParam('id supplier')],
      requestBody: jsonBody({
        ...supplierBody,
        properties: { ...supplierBody.properties, is_active: { type: 'boolean' } },
      }),
      responses: responses('Supplier berhasil diubah.', {
        '404': 'ERR-SYS-02 Supplier tidak ditemukan.',
        '422': 'ERR-VAL-01 Kolom ini wajib diisi.',
      }),
    },
  },
  '/suppliers/{id}/materials': {
    get: {
      tags: ['C - Supplier'],
      summary: 'Bahan yang pernah dipasok supplier (PPIC, PIMPINAN)',
      security,
      parameters: [idParam('id supplier')],
      responses: responses('Daftar bahan (material_price disembunyikan untuk PPIC)', {
        '404': 'ERR-SYS-02 Supplier tidak ditemukan.',
      }),
    },
  },

  '/raw-materials': {
    get: {
      tags: ['C - Data master'],
      summary: 'Master bahan baku (PPIC)',
      security,
      parameters: [
        queryParam('search', { type: 'string' }),
        queryParam('category_id', uuid),
      ],
      responses: responses('Daftar bahan baku'),
    },
  },
  '/production-lines': {
    get: {
      tags: ['C - Data master'],
      summary: 'Lini produksi (PPIC)',
      security,
      parameters: [
        queryParam('order_detail_id', uuid, 'Hanya lini di pabrik order style ini'),
      ],
      responses: responses('Daftar lini produksi'),
    },
  },
  '/defect-types': {
    get: {
      tags: ['C - Data master'],
      summary: 'Jenis cacat (QC)',
      security,
      responses: responses('Daftar jenis cacat'),
    },
  },
  '/qc-standards': {
    get: {
      tags: ['C - Data master'],
      summary: 'Standar QC (QC)',
      security,
      parameters: [queryParam('type_code', { type: 'string', example: 'KS' })],
      responses: responses('Standar QC jenis produk + yang berlaku umum'),
    },
  },

  '/order-details/{id}/materials': {
    get: {
      tags: ['C - Bahan baku style'],
      summary: 'Bahan baku satu style + status kesiapan (PPIC, PIMPINAN)',
      security,
      parameters: [idParam('id order_details (style)')],
      responses: responses('Kepala style, readiness, locked, dan daftar bahan', {
        '404': 'ERR-SYS-02 Style tidak ditemukan.',
      }),
    },
    post: {
      tags: ['C - Bahan baku style'],
      summary: 'Catat bahan baku style (PPIC)',
      security,
      parameters: [idParam('id order_details (style)')],
      requestBody: jsonBody(materialBody),
      responses: created('Bahan berhasil disimpan.', {
        '404': 'ERR-SYS-02 Style tidak ditemukan.',
        '409': 'ERR-BHN-01 SPK style sudah diajukan | ERR-ORD-05 Order final',
        '422': 'ERR-VAL-01 | ERR-VAL-02 Nilai harus > 0 | ERR-VAL-08 Supplier & harga wajib | ERR-VAL-13 Centang pernyataan',
      }),
    },
  },
  '/materials/{id}': {
    patch: {
      tags: ['C - Bahan baku style'],
      summary: 'Ubah bahan baku sebelum SPK diajukan (PPIC)',
      security,
      parameters: [idParam('id order_materials')],
      requestBody: jsonBody(materialBody),
      responses: responses('Bahan berhasil diubah.', {
        '404': 'ERR-SYS-02 Data bahan tidak ditemukan.',
        '409': 'ERR-BHN-01 | ERR-ORD-05',
        '422': 'ERR-VAL-02 | ERR-VAL-08 | ERR-VAL-13',
      }),
    },
  },
  '/order-details/{id}/material-requirement': {
    get: {
      tags: ['C - Bahan baku style'],
      summary: 'Kebutuhan bahan dari BOM vs yang sudah dicatat (PPIC)',
      security,
      parameters: [idParam('id order_details (style)')],
      responses: responses('required_qty, recorded_qty, shortage_qty per bahan', {
        '404': 'ERR-SYS-02 Style tidak ditemukan.',
      }),
    },
  },

  '/spk': {
    get: {
      tags: ['C - SPK'],
      summary: 'Daftar SPK (PPIC, PIMPINAN, SPV, QC). SPV/QC hanya DISETUJUI',
      security,
      parameters: [
        queryParam('status', {
          type: 'string',
          enum: ['MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DITOLAK'],
        }),
        queryParam('order_id', uuid),
        queryParam('page', { type: 'integer', default: 1 }),
        queryParam('per_page', { type: 'integer', default: 10 }),
      ],
      responses: responses('Daftar SPK + meta halaman'),
    },
    post: {
      tags: ['C - SPK'],
      summary: 'Ajukan SPK (PPIC)',
      security,
      requestBody: jsonBody({
        type: 'object',
        properties: {
          order_detail_id: uuid,
          line_id: { ...uuid, description: 'id dari GET /production-lines' },
          target_date: date,
          sizes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                size: { type: 'string', example: 'M' },
                qty: { type: 'integer', example: 150 },
              },
            },
          },
          materials_complete_confirmed: { type: 'boolean', example: true },
        },
      }),
      responses: created('SPK berhasil diajukan.', {
        '404': 'ERR-SYS-02 Style tidak ditemukan.',
        '409': 'ERR-SPK-01 Order belum disetujui | ERR-SPK-02 Bahan belum ada | ERR-SPK-03 Style sudah punya SPK',
        '422': 'ERR-VAL-01 Lini tidak valid | ERR-VAL-02 Ukuran/jumlah | ERR-VAL-13 Centang pernyataan',
      }),
    },
  },
  '/spk/{id}': {
    get: {
      tags: ['C - SPK'],
      summary: 'Detail SPK + ukuran + sisa pekerjaan per tahap',
      security,
      parameters: [idParam('id SPK')],
      responses: responses('Detail SPK', { '404': 'ERR-SYS-02 SPK tidak ditemukan.' }),
    },
  },
  '/spk/{id}/approve': {
    post: {
      tags: ['C - SPK'],
      summary: 'Setujui SPK (PIMPINAN)',
      security,
      parameters: [idParam('id SPK')],
      responses: responses('SPK disetujui. Order menjadi DALAM_PRODUKSI', {
        '404': 'ERR-SYS-02 SPK tidak ditemukan.',
        '409': 'ERR-SPK-04 Sudah diputuskan | ERR-ORD-05 Order final',
      }),
    },
  },
  '/spk/{id}/reject': {
    post: {
      tags: ['C - SPK'],
      summary: 'Tolak SPK (PIMPINAN), alasan wajib',
      security,
      parameters: [idParam('id SPK')],
      requestBody: jsonBody({
        type: 'object',
        properties: { reason: { type: 'string', example: 'Target selesai terlalu mepet.' } },
      }),
      responses: responses('SPK ditolak.', {
        '404': 'ERR-SYS-02 SPK tidak ditemukan.',
        '409': 'ERR-SPK-04 | ERR-ORD-05',
        '422': 'ERR-VAL-06 Alasan wajib diisi.',
      }),
    },
  },

  '/spk/{id}/progress': {
    get: {
      tags: ['C - Progres'],
      summary: 'Progres SPK + sisa pekerjaan per tahap (SPV, PPIC, PIMPINAN, QC)',
      security,
      parameters: [idParam('id SPK')],
      responses: responses('stages (kumulatif, sisa, maksimum) dan entries (data harian)', {
        '404': 'ERR-SYS-02 SPK tidak ditemukan.',
      }),
    },
    post: {
      tags: ['C - Progres'],
      summary: 'Catat progres harian (SPV)',
      security,
      parameters: [idParam('id SPK')],
      requestBody: jsonBody({
        type: 'object',
        properties: {
          stage_code: { ...stageEnum, example: 'CUTTING' },
          work_date: { ...date, example: '2026-11-22' },
          qty_done: { type: 'integer', example: 500 },
          variance_note: {
            type: 'string',
            nullable: true,
            description: 'Wajib bila kumulatif Cutting berbeda dari jumlah SPK',
          },
        },
      }),
      responses: created('Progres berhasil disimpan. Mengembalikan cumulative_done dan remaining', {
        '404': 'ERR-SYS-02 SPK tidak ditemukan.',
        '409': 'ERR-PRG-01 SPK belum disetujui/order dibatalkan | ERR-PRG-02 Data tanggal ini sudah ada',
        '422': 'ERR-PRG-03 Melebihi lolos QC tahap sebelumnya | ERR-PRG-04 Keterangan selisih Cutting | ERR-VAL-09 Negatif',
      }),
    },
  },
  '/progress/{id}': {
    patch: {
      tags: ['C - Progres'],
      summary: 'Ubah data progres lama (SPV)',
      security,
      parameters: [idParam('id production_progress')],
      requestBody: jsonBody({
        type: 'object',
        properties: {
          qty_done: { type: 'integer', example: 450 },
          variance_note: { type: 'string', nullable: true },
        },
      }),
      responses: responses('Progres berhasil diubah.', {
        '404': 'ERR-SYS-02 Data progres tidak ditemukan.',
        '409': 'ERR-PRG-01',
        '422': 'ERR-PRG-03 | ERR-PRG-04 | ERR-QC-01 di bawah lolos QC | ERR-VAL-09',
      }),
    },
  },

  '/spk/{id}/qc-results': {
    get: {
      tags: ['C - Hasil QC'],
      summary: 'Hasil QC SPK + tidak lolos per tahap dan per style (QC, PPIC, PIMPINAN)',
      security,
      parameters: [idParam('id SPK')],
      responses: responses('stages (selesai, lolos, tidak lolos, %), style (reject_pct vs batas), entries', {
        '404': 'ERR-SYS-02 SPK tidak ditemukan.',
      }),
    },
    post: {
      tags: ['C - Hasil QC'],
      summary: 'Catat hasil QC (QC)',
      security,
      parameters: [idParam('id SPK')],
      requestBody: jsonBody({
        type: 'object',
        properties: {
          stage_code: { ...stageEnum, example: 'CUTTING', description: 'PACKING ditolak (ERR-QC-02)' },
          check_date: { ...date, example: '2026-11-22' },
          qty_passed: { type: 'integer', example: 490 },
          standard_id: { ...uuid, description: 'id dari GET /qc-standards' },
          sample_qty: { type: 'integer', nullable: true, example: 80 },
          inspection_type: { type: 'string', enum: ['INLINE', 'FINAL'], default: 'INLINE' },
          defects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                defect_type_id: { ...uuid, description: 'id dari GET /defect-types' },
                qty: { type: 'integer', example: 10 },
                action_taken: { type: 'string', nullable: true, example: 'Dipotong ulang' },
              },
            },
          },
        },
      }),
      responses: created('Hasil QC berhasil disimpan. Mengembalikan tidak lolos, % dan status batas reject', {
        '404': 'ERR-SYS-02 SPK tidak ditemukan.',
        '409': 'ERR-PRG-01 SPK belum disetujui/order dibatalkan',
        '422': 'ERR-QC-01 Lolos > selesai | ERR-QC-02 Packing | ERR-VAL-09 | ERR-VAL-02 sampel/cacat',
      }),
    },
  },
};
