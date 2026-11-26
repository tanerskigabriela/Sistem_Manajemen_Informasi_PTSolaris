// Dokumentasi Swagger modul B. Dipasang di swagger.ts.

const ok = { "200": { description: "Berhasil" } };
const idParam = [
  {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  },
];
const pageParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "per_page", in: "query", schema: { type: "integer", default: 20 } },
  {
    name: "q",
    in: "query",
    schema: { type: "string" },
    description: "Kata pencarian",
  },
];
const body = (example: object) => ({
  required: true,
  content: { "application/json": { schema: { type: "object" }, example } },
});

const buyerExample = {
  buyer_code: "SKB",
  buyer_name: "PT Sandang Kita Bersama",
  buyer_type: "LOKAL",
  country_code: "ID",
  contact_name: "Rina",
  phone: "081355500012",
  email: "po@sandangkita.local",
  address: "Jl. Slamet Riyadi No. 21",
  city: "Surakarta",
  default_currency: "IDR",
  payment_term_days: 30,
};

const orderExample = {
  buyer_id: "ISI dari GET /buyers (contoh: BRT)",
  level_code: "DOMESTIK",
  deadline: "2027-01-15",
  scheme: "FOB",
  reject_limit_pct: 3,
  late_penalty:
    "Denda 1% per hari keterlambatan, maksimal 10% dari nilai order",
  buyer_po_no: "PO-BRT-0002",
  styles: [
    {
      item_id: "ISI dari GET /items?buyer_id=... (contoh: Basic Tee)",
      color: "Abu",
      unit_price: 46000,
      discount_pct: 0,
      sizes: [
        { size: "M", qty: 200 },
        { size: "L", qty: 150 },
      ],
    },
    {
      item_id: null,
      type_code: "CL",
      item_name: "Celana Chino",
      buyer_style_name: "Slim Chino",
      color: "Khaki",
      unit_price: 110000,
      sizes: [{ size: "32", qty: 100 }],
    },
  ],
  confirmed: true,
};

export const orderSwaggerTags = [
  {
    name: "Master",
    description: "Dropdown form: negara, jenis produk, level order, barang",
  },
  { name: "Buyer", description: "FSD 2.3 Kelola Buyer" },
  {
    name: "Order",
    description: "FSD 2.4 Input Order, 2.5 Daftar dan Detail Order",
  },  { name: "Pengiriman", description: "FSD 2.15 Catat Pengiriman dan Surat Jalan" },
  { name: "Dashboard", description: "FSD 2.14 Dashboard Pimpinan" },
];

export const orderSwaggerPaths = {
  "/countries": {
    get: { tags: ["Master"], summary: "Daftar negara", responses: ok },
  },
  "/product-types": {
    get: {
      tags: ["Master"],
      summary: "Daftar jenis produk",
      responses: ok,
    },
  },
  "/order-levels": {
    get: {
      tags: ["Master"],
      summary: "Daftar level order beserta metode bayar",
      responses: ok,
    },
  },
  "/items": {
    get: {
      tags: ["Master"],
      summary: "Barang aktif milik buyer ditambah barang umum",
      parameters: [
        {
          name: "buyer_id",
          in: "query",
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "type_code",
          in: "query",
          schema: {
            type: "string",
            enum: ["CL", "KM", "KS", "PL", "DR", "JK", "SR"],
          },
        },
        { name: "q", in: "query", schema: { type: "string" } },
      ],
      responses: ok,
    },
  },
  "/buyers": {
    get: {
      tags: ["Buyer"],
      summary: "Daftar buyer",
      parameters: [
        ...pageParams,
        {
          name: "buyer_type",
          in: "query",
          schema: { type: "string", enum: ["LOKAL", "ASING"] },
        },
      ],
      responses: ok,
    },
    post: {
      tags: ["Buyer"],
      summary: "Tambah buyer",
      requestBody: body(buyerExample),
      responses: {
        "201": { description: "Buyer tersimpan" },
        "409": { description: "ERR-VAL-05" },
        "422": { description: "ERR-VAL-01" },
      },
    },
  },
  "/buyers/{id}": {
    get: {
      tags: ["Buyer"],
      summary: "Detail buyer",
      parameters: idParam,
      responses: ok,
    },
    patch: {
      tags: ["Buyer"],
      summary: "Ubah buyer (kode buyer tidak bisa diubah)",
      parameters: idParam,
      requestBody: body({ phone: "081355500099", payment_term_days: 45 }),
      responses: ok,
    },
  },
  "/orders": {
    get: {
      tags: ["Order"],
      summary: "Daftar order (dari v_order_summary)",
      parameters: [
        ...pageParams,
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: [
              "MENUNGGU_PERSETUJUAN",
              "DISETUJUI",
              "DITOLAK",
              "DITARIK",
              "DALAM_PRODUKSI",
              "SELESAI",
              "DIBATALKAN",
            ],
          },
        },
        {
          name: "buyer_id",
          in: "query",
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "level_code",
          in: "query",
          schema: { type: "string", enum: ["DOMESTIK", "INTERNASIONAL"] },
        },
        {
          name: "date_from",
          in: "query",
          schema: { type: "string", format: "date" },
        },
        {
          name: "date_to",
          in: "query",
          schema: { type: "string", format: "date" },
        },
      ],
      responses: ok,
    },
    post: {
      tags: ["Order"],
      summary: "Simpan order baru (sp_create_order)",
      requestBody: body(orderExample),
      responses: {
        "201": { description: "Order tersimpan, status MENUNGGU_PERSETUJUAN" },
        "422": { description: "ERR-ORD-01 / ERR-VAL-xx" },
      },
    },
  },
  "/orders/{id}": {
    get: {
      tags: ["Order"],
      summary: "Detail order: style, ukuran, riwayat status",
      parameters: idParam,
      responses: ok,
    },
  },
  "/orders/{id}/approve": {
    post: {
      tags: ["Order"],
      summary: "Setujui order (PIMPINAN)",
      parameters: idParam,
      responses: {
        "200": { description: "Status menjadi DISETUJUI" },
        "409": { description: "ERR-ORD-02 / ERR-ORD-05" },
      },
    },
  },
  "/orders/{id}/reject": {
    post: {
      tags: ["Order"],
      summary: "Tolak order, alasan wajib (PIMPINAN)",
      parameters: idParam,
      requestBody: body({ reason: "Harga di bawah biaya produksi." }),
      responses: {
        "200": { description: "Status menjadi DITOLAK" },
        "409": { description: "ERR-ORD-02 / ERR-ORD-05" },
        "422": { description: "ERR-VAL-06" },
      },
    },
  },
  "/orders/{id}/withdraw": {
    post: {
      tags: ["Order"],
      summary: "Tarik pengajuan order, alasan wajib (MARKETING)",
      parameters: idParam,
      requestBody: body({ reason: "Buyer merevisi jumlah pesanan." }),
      responses: {
        "200": { description: "Status menjadi DITARIK" },
        "409": { description: "ERR-ORD-04 / ERR-ORD-05" },
        "422": { description: "ERR-VAL-06" },
      },
    },
  },
  "/orders/{id}/cancellation-preview": {
    get: {
      tags: ["Order"],
      summary: "Perkiraan denda dan refund sebelum membatalkan (PIMPINAN)",
      parameters: idParam,
      responses: ok,
    },
  },
  "/orders/{id}/cancel": {
    post: {
      tags: ["Order"],
      summary: "Batalkan order DISETUJUI/DALAM_PRODUKSI (PIMPINAN)",
      parameters: idParam,
      requestBody: body({
        reason: "Buyer menghentikan kerja sama.",
        requested_by_party: "BUYER",
      }),
      responses: {
        "200": {
          description:
            "Status menjadi DIBATALKAN, berisi penalty_amount dan refund_amount",
        },
        "409": { description: "ERR-ORD-03 / ERR-ORD-05 / ERR-BTL-01" },
        "422": { description: "ERR-VAL-06" },
      },
    },
  },
  "/expeditions": {
    get: {
      tags: ["Pengiriman"],
      summary: "Daftar ekspedisi aktif (PPIC)",
      parameters: [
        {
          name: "level_code",
          in: "query",
          schema: { type: "string", enum: ["DOMESTIK", "INTERNASIONAL"] },
          description: "Isi dengan level order supaya hanya ekspedisi yang cakupannya sesuai",
        },
      ],
      responses: ok,
    },
  },
  "/orders/{id}/ready-to-ship": {
    get: {
      tags: ["Pengiriman"],
      summary: "Sisa barang siap kirim per style per ukuran (PPIC)",
      parameters: idParam,
      responses: ok,
    },
  },
  "/shipments": {
    get: {
      tags: ["Pengiriman"],
      summary: "Daftar pengiriman (PPIC, PIMPINAN)",
      parameters: [
        ...pageParams,
        { name: "order_id", in: "query", schema: { type: "string", format: "uuid" } },
        { name: "date_from", in: "query", schema: { type: "string", format: "date" } },
        { name: "date_to", in: "query", schema: { type: "string", format: "date" } },
      ],
      responses: ok,
    },
    post: {
      tags: ["Pengiriman"],
      summary: "Catat pengiriman dan buat nomor surat jalan (PPIC)",
      requestBody: body({
        order_id: "ISI id order DALAM_PRODUKSI",
        ship_date: "2026-11-24",
        expedition_id: "ISI dari GET /expeditions",
        destination_address: "Jl. Contoh No. 10, Kota Contoh",
        package_count: 5,
        items: [
          {
            order_detail_id: "ISI dari GET /orders/{id}/ready-to-ship",
            size: "M",
            qty: 50,
          },
        ],
      }),
      responses: {
        "201": { description: "Pengiriman tercatat, berisi delivery_note_no SJ-TTBB-NNN" },
        "409": { description: "ERR-KRM-01 / ERR-KRM-08" },
        "422": { description: "ERR-KRM-02 / ERR-KRM-03 / ERR-KRM-04 / ERR-KRM-07 / ERR-VAL-01" },
      },
    },
  },
  "/shipments/{id}/delivery-note": {
    get: {
      tags: ["Pengiriman"],
      summary: "Data surat jalan siap cetak, tanpa harga (PPIC)",
      parameters: idParam,
      responses: ok,
    },
  },
  "/dashboard": {
    get: {
      tags: ["Dashboard"],
      summary: "Ringkasan dan daftar order untuk Pimpinan",
      parameters: [
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["MENUNGGU_PERSETUJUAN", "DISETUJUI", "DALAM_PRODUKSI", "SELESAI", "DIBATALKAN"],
          },
        },
      ],
      responses: ok,
    },
  },
};
