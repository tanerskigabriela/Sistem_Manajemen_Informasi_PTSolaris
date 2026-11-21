# KONTRAK.md pertama (DRAF) — Project Solaris, Database Gabungan RSI + SMBD

Status: **draf untuk dibahas kelompok**, belum berlaku. Disusun 19/11/2026.

Kontrak ini menggantikan KONTRAK v1 setelah database RSI dan SMBD disatukan. Dasarnya adalah dokumen *Skema Konseptual Database Gabungan* (70 entitas, 135 relasi) ditambah keputusan kelompok tanggal 19/11/2026 (Bagian 1). Kontrak ini berisi nama tabel dan kolom fisik, nilai status, role, pembagian file, API, dan halaman.

Bagian yang ditulis "sama dengan v1" (format API, login, pola transaksi, struktur folder, aturan Git) merujuk ke KONTRAK v1. **Simpan KONTRAK v1 di repo sebagai `docs/KONTRAK-v1.md`** supaya bisa dibuka semua anggota. Semua tabel dan nilai status sudah ditulis lengkap di kontrak ini.

Hal yang masih menunggu keputusan atau jawaban dosen ditandai **[TERBUKA]** dan dikumpulkan di Bagian 17.

---

## 1. Keputusan dasar (19/11/2026)

| No | Keputusan |
|---|---|
| K-01 | Satu database `solaris_db` (SQL Server 2022) untuk RSI dan SMBD, dengan dua schema: `app` (tabel sistem) dan `garment` (tabel bisnis pabrik). |
| K-02 | Struktur RSI dirombak mengikuti skema gabungan. Waktu rombak 5 hari. |
| K-03 | SPK dibuat **per style** (satu baris `order_details`, yaitu satu style + satu warna), dengan rincian ukuran di `spk_sizes`. |
| K-04 | Detail order dipecah dua: `order_details` (per style + warna) dan entitas lemah `order_detail_sizes` (per ukuran). |
| K-05 | Fitur salinan bertanda tangan (`signed_documents`) **dibuang**. Bisa ditambahkan lagi kalau ada sisa waktu. |
| K-06 | Multi-pabrik tetap dipakai. Relasi wajib diisi otomatis kalau bisa (Bagian 4.0). Data RSI belum disaring per pabrik. |
| K-07 | Fitur SMBD berbobot ringan dan sedang dimasukkan ke RSI (Bagian 14.1). Fitur berat hanya ada di bagian SMBD. |
| K-08 | Data master untuk fitur tambahan (lini, standar QC, jenis cacat, kebijakan pembatalan, level order, ekspedisi, bahan baku, BOM) dikelola oleh SUPERADMIN di bagian SMBD. Halaman RSI hanya memilih dari daftar. |
| K-09 | Supervisor hanya mengisi jumlah selesai. Reject hanya berasal dari QC. `production_progress` tidak punya kolom masuk dan reject. |
| K-10 | Bagian SMBD tampil di web yang sama, hanya untuk role `SUPERADMIN`. Bagian ini tidak didemokan di RSI. **[TERBUKA: konfirmasi Pak Bawi]** |
| K-11 | Pencatat aktivitas bisnis (pembuat order, penyetuju SPK, pencatat progres, dst.) disimpan sebagai `employee_id`, bukan `user_id`. Siapa yang login tetap tercatat di `app.activity_logs`. |
| K-12 | Satu surat jalan (`shipments`) hanya untuk satu order, tetapi boleh berisi banyak barang. Satu order boleh dikirim bertahap. Aturan bisnis SMBD nomor 11 disesuaikan. *(20/11/2026)* |

---

## 2. Pembagian anggota (USULAN, dibahas)

| Kode | Bagian | Tabel (jumlah) | Role RSI yang dilayani |
|---|---|---|---|
| A | Fondasi, Admin, Organisasi & SDM, Akuntansi | app (6), organisasi & SDM (12), gudang & rak (2), akun, rekening, jurnal, gaji (5) = **25** | ADMIN, SUPERADMIN, semua role |
| B | Order, Pengiriman & Ekspor, Penjualan & Pajak | buyer, produk, order, pembatalan (12), pengiriman & ekspor (8), pajak, invoice, tagihan, pembayaran (5) = **25** | MARKETING, PIMPINAN |
| C | Produksi & QC, Supply Chain, Stok, Aset | produksi & QC (9), supply chain (11), stok (4), aset (3) = **27** | PPIC, SPV, QC |

Total **77 tabel fisik** = 70 entitas di skema konseptual + 2 entitas lemah yang dikembalikan (`order_detail_sizes`, `spk_sizes`) + 3 tabel dari relasi M:N dan ternary (`employee_skills`, `bom`, `supplier_materials`) + 2 tabel dari atribut multivalued (`order_level_payment_methods`, `expedition_transport_modes`). Rinciannya ada di Bagian 4.

Nama anggota: A = Tanerski Gabriela Gienaldi, B = Nabila Azzahra Putri, C = Sausan Nisa Zhaafirah *(tetap seperti v1, boleh ditukar)*.

---

## 3. File skrip database dan urutannya

Semua skrip ada di `db/` dan dijalankan **berurutan**. Antarobjek dipisah `GO`. Urutan file mengikuti ketergantungan FK, jadi satu anggota bisa punya lebih dari satu file.

| Urutan | File | Pemilik | Isi |
|---|---|---|---|
| 0 | `00-reset.sql` | A | `DROP DATABASE` bila ada, `CREATE DATABASE solaris_db`, `CREATE SCHEMA app`, `CREATE SCHEMA garment` |
| 1 | `01-org.sql` | A | factories, countries, production_stages, divisions, positions, shifts, employees, employment_contracts, skills, employee_skills, interns, attendances, warehouses, rack_locations |
| 2 | `02-app.sql` | A | roles, users, sessions, activity_logs, password_reset_requests, notifications |
| 3 | `03-order.sql` | B | buyers, order_levels, order_level_payment_methods, product_types, items, item_variants, orders, order_status_history, order_details, order_detail_sizes, cancellation_policies, order_cancellations, expeditions, expedition_transport_modes, vehicles, routes, shipments, shipment_items, export_documents, shipment_trackings |
| 4 | `04-produksi.sql` | C | production_lines, spk, spk_sizes, production_progress, suppliers, material_categories, raw_materials, bom, supplier_materials, order_materials, material_usages, purchase_orders, purchase_order_items, material_receipts, material_receipt_items, import_documents, qc_standards, defect_types, qc_results, qc_defects, material_stocks, product_stocks, stock_movements, stock_counts, facilities, equipment, maintenances |
| 5 | `05-akuntansi.sql` | A | accounts, company_bank_accounts, journals, journal_lines, payrolls |
| 6 | `06-penjualan.sql` | B | tax_types, taxes, sales_invoices, supplier_bills, payments |
| 7 | `07-objects-core.sql` | A | function, SP, view, trigger milik A (Bagian 5) |
| 8 | `08-objects-produksi.sql` | C | function, SP, view, trigger milik C |
| 9 | `09-objects-order.sql` | B | function, SP, view, trigger milik B |
| 10 | `10-security.sql` | A | login, user, role database, GRANT/DENY (Bagian 13) |
| 11 | `90-seed-core.sql` | A | pabrik, negara, tahap, divisi, jabatan, shift, 7 karyawan, 7 role, 7 akun demo, gudang, rak, akun COA, rekening |
| 12 | `91-seed-order.sql` | B | jenis produk, level order, kebijakan pembatalan, ekspedisi, buyer, barang + varian, minimal 1 order DISETUJUI lengkap dengan detail dan ukuran, jenis pajak |
| 13 | `92-seed-produksi.sql` | C | lini, standar QC, jenis cacat, supplier, kategori bahan, bahan baku, BOM, bahan untuk order seed B |

Catatan:

- Relasi melingkar `divisions.head_employee_id → employees` dan `employees.division_id → divisions`: buat `divisions` tanpa kolom kepala dulu, lalu `ALTER TABLE ... ADD` FK setelah `employees` dibuat (di file 01).
- Objek C (08) dijalankan sebelum objek B (09), karena view dashboard dan SP pengiriman milik B memakai function milik C.
- Semua nama objek **wajib ditulis lengkap dengan schema**: `app.users`, `garment.orders`. Jangan bergantung pada schema default `dbo`.
- Setiap perubahan tabel wajib lewat skrip di repo (R-03).

---

## 4. Tabel dan kolom

### 4.0 Konvensi

- Nama tabel dan kolom `snake_case` bahasa Inggris. Nama tabel jamak, kecuali `spk`, `bom`, `equipment`.
- PK fisik: `id UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()`, walaupun di skema konseptual key-nya bernama lain (mis. `spk_no`, `delivery_note_no`). Key alami seperti itu dijadikan `UNIQUE`.
- Pengecualian PK:
  - tabel kode memakai kode sebagai PK: `roles`, `product_types`, `countries`, `production_stages`, `order_levels`, `accounts`;
  - entitas lemah memakai PK gabungan (pemilik + partial key);
  - `activity_logs` dan `order_status_history` memakai `BIGINT IDENTITY`.
- Teks `NVARCHAR`, kode `VARCHAR`/`CHAR`, uang `DECIMAL(16,2)`, waktu `DATETIME2(0) DEFAULT SYSDATETIME()`, tanggal `DATE`.
- Status disimpan `VARCHAR` + `CHECK` (Bagian 6).
- Atribut **derived** di skema tidak dibuat kolom. Nilainya dihitung lewat view atau function. Pengecualian: `is_at_risk` dan `is_over_reject` **disimpan**, karena notifikasi N-07/N-08 hanya dikirim saat flag pertama kali berubah.
- Atribut **composite** dipecah menjadi kolom komponennya.
- Tidak ada `ON DELETE CASCADE`. Data transaksi tidak dihapus.

**Relasi wajib yang diisi otomatis (K-06):**

| Kolom | Diisi dengan |
|---|---|
| `orders.factory_id` | Pabrik karyawan yang login |
| `orders.level_code` | `DOMESTIK` (default), kecuali Marketing memilih internasional |
| `shipments.origin_warehouse_id` | Gudang barang jadi milik pabrik order |
| Kolom `*_by` yang menunjuk `employees` | `employee_id` dari akun yang login |

Singkatan: PK, FK, UQ (unique), CK (check), DF (default). **(RSI)** menandai kolom yang dipakai halaman RSI.

### 4.1 Milik A — `01-org.sql` (schema garment)

**factories**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| factory_name | NVARCHAR(100) | |
| address | NVARCHAR(200) | |
| city | NVARCHAR(50) | |
| province | NVARCHAR(50) | |
| phone | VARCHAR(20) | |
| email | VARCHAR(100) | NULL |
| bonded_zone_status | BIT | DF 0; status kawasan berikat |
| operating_status | VARCHAR(10) | CK IN (AKTIF, NONAKTIF) |
| created_at | DATETIME2(0) | |

**countries** — `country_code CHAR(2)` PK (ISO 3166, mis. ID, US), `country_name NVARCHAR(60)`.

**production_stages** (dipakai C dan B)

| Kolom | Tipe | Keterangan |
|---|---|---|
| stage_code | VARCHAR(10) | PK; CK IN (CUTTING, SEWING, TRIMMING, FINISHING, IRONING, PACKING) |
| stage_name | NVARCHAR(30) | |
| sequence | TINYINT | UQ; CK 1–6 |

**divisions** — `id` PK, `factory_id` FK → factories, `division_name NVARCHAR(60)`, `head_employee_id` NULL FK → employees (UQ filtered `WHERE head_employee_id IS NOT NULL`, relasi 1:1).

**positions** — `id` PK, `position_name NVARCHAR(60)`, `position_level TINYINT`, `base_salary_min`, `base_salary_max DECIMAL(16,2)` CK min ≤ max.

**shifts** — `id` PK, `shift_name NVARCHAR(30)`, `start_time TIME(0)`, `end_time TIME(0)`.

**employees**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| nik | CHAR(16) | UQ; CK 16 digit |
| full_name | NVARCHAR(100) | (RSI) nama tampilan akun diambil dari sini |
| birth_date | DATE | |
| gender | CHAR(1) | CK IN (L, P) |
| employee_type | VARCHAR(12) | CK IN (TETAP, KONTRAK, HARIAN, MAGANG, OUTSOURCING) |
| address | NVARCHAR(200) | |
| phone | VARCHAR(20) | |
| email | VARCHAR(100) | NULL |
| npwp | VARCHAR(20) | NULL |
| bpjs_health_no, bpjs_employment_no | VARCHAR(20) | NULL |
| bank_name | NVARCHAR(50) | NULL |
| account_no | VARCHAR(30) | NULL |
| factory_id | UNIQUEIDENTIFIER | FK → factories |
| division_id | UNIQUEIDENTIFIER | FK → divisions |
| position_id | UNIQUEIDENTIFIER | FK → positions |
| shift_id | UNIQUEIDENTIFIER | NULL; FK → shifts |
| is_active | BIT | DF 1 |
| join_date | DATE | |
| created_at, updated_at | DATETIME2(0) | |

**employment_contracts** (lemah) — PK (`employee_id`, `contract_seq TINYINT`); `contract_type VARCHAR(10)` CK IN (PKWT, PKWTT, HARIAN, MAGANG); `contract_document_no VARCHAR(30)`; `base_salary DECIMAL(16,2)`; `start_date DATE`; `finish_date DATE NULL`; `status VARCHAR(10)` CK IN (AKTIF, SELESAI, DIPUTUS).

**skills** — `id` PK, `skill_category NVARCHAR(50)`, `skill_name NVARCHAR(80)`.

**employee_skills** (M:N `masters`) — PK (`employee_id`, `skill_id`); `skill_level VARCHAR(10)` CK IN (DASAR, MENENGAH, AHLI); `certified_date DATE NULL`.

**interns** (subclass dari employees)

| Kolom | Tipe | Keterangan |
|---|---|---|
| employee_id | UNIQUEIDENTIFIER | PK; FK → employees |
| mentor_id | UNIQUEIDENTIFIER | FK → employees; CK mentor_id ≠ employee_id |
| institution | NVARCHAR(100) | |
| major | NVARCHAR(80) | |
| program_type | VARCHAR(10) | CK IN (PKL, KAMPUS, MANDIRI) |
| allowance | DECIMAL(16,2) | |
| start_date, finish_date | DATE | CK finish ≥ start |
| final_score | DECIMAL(5,2) | NULL; CK 0–100 |

Aturan "harus `employee_type = MAGANG`" dan "pembimbing harus karyawan aktif" dijaga trigger `trg_interns_check` (A).

**attendances** (lemah) — PK (`employee_id`, `work_date DATE`); `clock_in`, `clock_out TIME(0) NULL`; `overtime_hours DECIMAL(4,1)` DF 0; `attendance_status VARCHAR(10)` CK IN (HADIR, IZIN, SAKIT, ALPA, CUTI).

**warehouses** — `id` PK, `factory_id` FK, `head_employee_id` FK → employees, `warehouse_name NVARCHAR(60)`, `warehouse_type VARCHAR(12)` CK IN (BAHAN, BARANG_JADI, CAMPURAN), `address NVARCHAR(200)`, `capacity_m3 DECIMAL(10,2)`.

**rack_locations** — `id` PK, `warehouse_id` FK, `rack_code VARCHAR(20)`, `capacity INT`; UQ (`warehouse_id`, `rack_code`).

### 4.2 Milik A — `02-app.sql` (schema app)

Kolom tabel `app` sama dengan v1 kecuali yang ditandai **berubah**. Semua kolom ditulis lengkap di sini supaya tidak perlu membuka v1. Kolom yang tidak tercantum **jangan ditambahkan**; nama dan nilainya dipakai langsung oleh kode login, log, dan notifikasi.

**roles**

| Kolom | Tipe | Keterangan |
|---|---|---|
| role_code | VARCHAR(12) | PK; CK IN (SUPERADMIN, ADMIN, PIMPINAN, MARKETING, PPIC, SPV, QC) (Bagian 7) |
| role_name | NVARCHAR(50) | Nama tampilan |
| access_tier | VARCHAR(10) | CK IN (SUPERADMIN, ADMIN, USER) |

**users**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| employee_id | UNIQUEIDENTIFIER | **berubah**: UQ; FK → garment.employees (`has_account`, 1:1) |
| username | VARCHAR(50) | UQ; CK panjang 4–50 |
| password_hash | VARCHAR(100) | bcrypt, tidak pernah teks biasa |
| role_code | VARCHAR(12) | FK → roles |
| is_active | BIT | DF 1 |
| is_locked | BIT | DF 0; jadi 1 setelah 5 kali gagal login |
| failed_login_count | TINYINT | DF 0 |
| must_change_password | BIT | DF 0; jadi 1 setelah reset password |
| last_login_at | DATETIME2(0) | NULL |
| created_at, updated_at | DATETIME2(0) | DF SYSDATETIME() |

`full_name` **dihapus**; nama diambil dari `employees`.

**sessions**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK; disimpan di JWT sebagai klaim `sid` (token sendiri tidak disimpan) |
| user_id | UNIQUEIDENTIFIER | FK → users |
| device | NVARCHAR(150) | Ringkasan User-Agent, mis. "Android · Chrome" |
| ip_address | VARCHAR(45) | |
| login_at | DATETIME2(0) | DF SYSDATETIME() |
| last_activity_at | DATETIME2(0) | Diperbarui setiap request; dasar timeout 30 menit |
| status | VARCHAR(10) | DF 'AKTIF'; CK IN (AKTIF, BERAKHIR) |
| end_reason | VARCHAR(20) | NULL; CK IN (LOGOUT, TIDAK_AKTIF, DIAKHIRI_ADMIN, RESET_PASSWORD, AKUN_NONAKTIF) |
| ended_at | DATETIME2(0) | NULL |

Index: (`user_id`, `status`) dan (`status`, `last_activity_at`).

**activity_logs** (hanya ditambah, tidak pernah diubah atau dihapus)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | BIGINT IDENTITY(1,1) | PK |
| user_id | UNIQUEIDENTIFIER | NULL; FK → users (NULL bila username tidak dikenal) |
| username | VARCHAR(50) | Username saat kejadian (juga untuk login gagal) |
| action_type | VARCHAR(20) | CK IN (LOGIN_BERHASIL, LOGIN_GAGAL, LOGOUT, SESI_BERAKHIR, SESI_DIAKHIRI, AKUN_TERKUNCI, BUKA_KUNCI, RESET_PASSWORD, GANTI_PASSWORD, AKSES_DITOLAK, TAMBAH, UBAH, SETUJU, TOLAK, TARIK, BATAL) |
| resource_type | VARCHAR(40) | NULL; nama tabel, ditulis dengan schema, mis. `garment.orders` |
| resource_id | VARCHAR(36) | NULL; id baris |
| old_values, new_values | NVARCHAR(MAX) | NULL; JSON, CK ISJSON = 1 |
| device | NVARCHAR(150) | NULL |
| ip_address | VARCHAR(45) | |
| created_at | DATETIME2(0) | DF SYSDATETIME() |

Index: (`user_id`, `created_at`), (`created_at`), (`action_type`).

**password_reset_requests**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| user_id | UNIQUEIDENTIFIER | FK → users |
| note | NVARCHAR(200) | NULL |
| status | VARCHAR(10) | DF 'MENUNGGU'; CK IN (MENUNGGU, SELESAI) |
| handled_by | UNIQUEIDENTIFIER | NULL; FK → users |
| requested_at | DATETIME2(0) | DF SYSDATETIME() |
| handled_at | DATETIME2(0) | NULL |

Unique filtered: satu permintaan MENUNGGU per akun (`UNIQUE (user_id) WHERE status = 'MENUNGGU'`, RB-61).

**notifications**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| recipient_id | UNIQUEIDENTIFIER | FK → users |
| event_code | CHAR(4) | CK IN ('N-01' … 'N-11'); N-12 dan N-13 dihapus |
| message | NVARCHAR(300) | Isi mengikuti contoh SRS Tabel 3.2a |
| link | VARCHAR(200) | NULL; route frontend |
| dedup_key | VARCHAR(80) | NULL; mencegah notifikasi ganda (dipakai N-07/N-08) |
| is_read | BIT | DF 0 |
| created_at | DATETIME2(0) | DF SYSDATETIME() |

Index: (`recipient_id`, `is_read`, `created_at`); unique filtered (`recipient_id`, `dedup_key`) `WHERE dedup_key IS NOT NULL`.

### 4.3 Milik B — `03-order.sql` (schema garment)

**buyers**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| buyer_code | CHAR(3) | UQ; CK 3 huruf kapital (RSI) |
| buyer_name | NVARCHAR(100) | (RSI) |
| buyer_type | VARCHAR(5) | CK IN (LOKAL, ASING) |
| country_code | CHAR(2) | FK → countries |
| contact_name | NVARCHAR(100) | (RSI, dulu `contact`) |
| phone | VARCHAR(20) | (RSI) |
| email | VARCHAR(100) | NULL |
| address | NVARCHAR(200) | |
| city | NVARCHAR(50) | |
| tax_id_no | VARCHAR(30) | NULL; NPWP atau Tax ID |
| default_currency | CHAR(3) | DF 'IDR' |
| payment_term_days | SMALLINT | DF 30 |
| credit_limit | DECIMAL(16,2) | NULL |
| created_at, updated_at | DATETIME2(0) | |

**order_levels**

| Kolom | Tipe | Keterangan |
|---|---|---|
| level_code | VARCHAR(13) | PK; CK IN (DOMESTIK, INTERNASIONAL) |
| level_name | NVARCHAR(30) | |
| standard_lead_time_days | SMALLINT | |
| minimum_order_qty | INT | |
| vat_treatment | VARCHAR(5) | CK IN (PPN, PPN_0) |
| min_down_payment_pct | DECIMAL(5,2) | CK 0–100 |
| requires_export_document | BIT | |

**order_level_payment_methods** (multivalued) — PK (`level_code`, `payment_method VARCHAR(8)`); CK IN (TRANSFER, TT, LC, GIRO, TUNAI). Daftar ini **sama persis** dengan `payments.payment_method`, supaya `sp_record_payment` bisa mengecek metode bayar terhadap level order.

**product_types** — sama dengan v1 (`type_code CHAR(2)` PK: CL, KM, KS, PL, DR, JK, SR).

**items**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| item_code | VARCHAR(12) | UQ; format BBB-JJ-NNNN (RSI). Barang tanpa buyer memakai BBB = `GEN` |
| buyer_id | UNIQUEIDENTIFIER | NULL; FK → buyers (`owns_design`, parsial) |
| type_code | CHAR(2) | FK → product_types |
| item_name | NVARCHAR(100) | |
| buyer_style_name | NVARCHAR(100) | NULL (RSI) |
| buyer_style_code | VARCHAR(30) | NULL; **bukan** key (dua buyer bisa memakai kode yang sama) |
| design_notes | NVARCHAR(500) | NULL |
| tech_pack_file | VARCHAR(200) | NULL |
| base_price | DECIMAL(16,2) | NULL |
| status | VARCHAR(8) | CK IN (AKTIF, NONAKTIF) |
| created_at | DATETIME2(0) | |

**item_variants** — `id` PK; `item_id` FK; `sku VARCHAR(30)` UQ (format `{item_code}-{size}-{NN}`); `size VARCHAR(10)`; `color NVARCHAR(50)`; `weight_per_pcs_gram DECIMAL(8,2) NULL`; UQ (`item_id`, `size`, `color`).

**orders**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| order_code | CHAR(12) | UQ; ORD-TTBB-NNN (RSI) |
| buyer_id | UNIQUEIDENTIFIER | FK → buyers (RSI) |
| factory_id | UNIQUEIDENTIFIER | FK → factories; diisi otomatis |
| level_code | VARCHAR(13) | FK → order_levels; DF 'DOMESTIK' (RSI) |
| handled_by | UNIQUEIDENTIFIER | FK → employees (dulu `created_by`) |
| buyer_po_no | VARCHAR(30) | NULL |
| order_date | DATE | DF hari ini (RSI) |
| deadline | DATE | CK ≥ order_date (RSI) |
| finish_date | DATE | NULL |
| scheme | VARCHAR(3) | CK IN (CMT, FOB) (RSI). Ini skema **produksi**, beda dengan Incoterm |
| reject_limit_pct | DECIMAL(5,2) | CK 0–100 (RSI) |
| late_penalty | NVARCHAR(500) | (RSI) |
| currency | CHAR(3) | DF 'IDR' (RSI, isian internasional) |
| exchange_rate | DECIMAL(12,4) | DF 1; CK > 0 |
| incoterm | VARCHAR(3) | NULL; CK IN (EXW, FCA, FOB, CFR, CIF, DAP, DDP) |
| destination_country | CHAR(2) | NULL; FK → countries |
| destination_port | NVARCHAR(60) | NULL |
| notes | NVARCHAR(500) | NULL |
| status | VARCHAR(20) | DF 'MENUNGGU_PERSETUJUAN' (RSI) |
| is_at_risk, is_over_reject | BIT | DF 0 (RSI) |
| created_at | DATETIME2(0) | |

Aturan "order INTERNASIONAL wajib mengisi mata uang, kurs, Incoterm, dan negara serta pelabuhan tujuan" dijaga `sp_create_order`, karena melibatkan tabel `order_levels`.

**order_status_history** — `id BIGINT IDENTITY(1,1)` PK; `order_id` FK → orders; `status VARCHAR(20)` (status baru); `changed_by` FK → **employees**; `reason NVARCHAR(500) NULL`, CK wajib diisi bila status DITOLAK, DITARIK, atau DIBATALKAN; `changed_at DATETIME2(0)` DF SYSDATETIME(). Index (`order_id`, `changed_at`).

**order_details** (per style + warna)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK (RSI, pengganti `order_styles.id`) |
| order_id | UNIQUEIDENTIFIER | FK → orders |
| item_id | UNIQUEIDENTIFIER | FK → items |
| color | NVARCHAR(50) | |
| unit_price | DECIMAL(16,2) | CK > 0 (RSI, dulu `price_per_pcs`) |
| discount_pct | DECIMAL(5,2) | DF 0; CK 0–100 (fitur tambahan RSI) |
| is_at_risk, is_over_reject | BIT | DF 0 |

UQ (`order_id`, `item_id`, `color`).

**order_detail_sizes** (lemah)

| Kolom | Tipe | Keterangan |
|---|---|---|
| order_detail_id | UNIQUEIDENTIFIER | PK 1; FK → order_details |
| size | VARCHAR(10) | PK 2 |
| variant_id | UNIQUEIDENTIFIER | NULL; FK → item_variants (dipakai stok barang jadi) |
| qty | INT | CK > 0 |
| cancelled_qty | INT | DF 0; CK 0 ≤ cancelled_qty ≤ qty |

**cancellation_policies**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| level_code | VARCHAR(13) | FK → order_levels |
| stage_code | VARCHAR(10) | NULL = sebelum produksi; FK → production_stages |
| request_deadline_days | SMALLINT | |
| penalty_pct | DECIMAL(5,2) | CK 0–100 |
| down_payment_refund_pct | DECIMAL(5,2) | CK 0–100 |
| material_owned_by_buyer | BIT | |
| valid_from | DATE | |
| valid_until | DATE | NULL |

**order_cancellations**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| order_id | UNIQUEIDENTIFIER | FK → orders |
| order_detail_id | UNIQUEIDENTIFIER | NULL = batal seluruh order. Di RSI selalu NULL; pembatalan sebagian hanya di SMBD |
| policy_id | UNIQUEIDENTIFIER | FK → cancellation_policies |
| stage_code_at_request | VARCHAR(10) | NULL; FK → production_stages |
| requested_by_party | VARCHAR(10) | CK IN (BUYER, PERUSAHAAN) |
| reason | NVARCHAR(500) | |
| cancelled_qty | INT | NULL |
| penalty_amount, refund_amount | DECIMAL(16,2) | dihitung `fn_cancellation_penalty` |
| status | VARCHAR(10) | CK IN (MENUNGGU, DISETUJUI, DITOLAK) |
| requested_by | UNIQUEIDENTIFIER | FK → employees |
| approved_by | UNIQUEIDENTIFIER | NULL; FK → employees |
| requested_date | DATE | |
| approved_date | DATE | NULL |

Di RSI, Pimpinan membatalkan langsung, jadi barisnya tercipta dengan status DISETUJUI.

**expeditions** — `id` PK; `expedition_name NVARCHAR(100)`; `partner_type VARCHAR(10)` CK IN (EKSPEDISI, FORWARDER, KURIR); `coverage VARCHAR(13)` CK IN (DOMESTIK, INTERNASIONAL, KEDUANYA); `contact_name`, `phone`, `email`; `is_active BIT`.

**expedition_transport_modes** (multivalued) — PK (`expedition_id`, `transport_mode VARCHAR(6)`); CK IN (DARAT, LAUT, UDARA).

**vehicles** — `id` PK; `factory_id` FK; `plate_no VARCHAR(12)` UQ; `vehicle_type NVARCHAR(30)`; `capacity_kg`, `capacity_m3 DECIMAL(10,2)`; `status VARCHAR(9)` CK IN (TERSEDIA, DIPAKAI, PERBAIKAN).

**routes** — `id` PK; `origin_warehouse_id` FK → warehouses; `expedition_id` FK; `destination_city NVARCHAR(60)`; `destination_country` FK → countries; `distance_km DECIMAL(8,1)`; `estimated_days SMALLINT`; `rate_per_kg`, `rate_per_m3`, `minimum_rate DECIMAL(16,2)`; `valid_until DATE NULL`.

**shipments**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| delivery_note_no | CHAR(11) | UQ; SJ-TTBB-NNN (RSI) |
| order_id | UNIQUEIDENTIFIER | FK → orders; **satu surat jalan untuk satu order** (RSI, K-12) |
| origin_warehouse_id | UNIQUEIDENTIFIER | FK → warehouses; diisi otomatis |
| expedition_id | UNIQUEIDENTIFIER | FK → expeditions; **wajib**, dipilih PPIC (RSI) |
| route_id | UNIQUEIDENTIFIER | NULL; FK → routes. Bila diisi, ekspedisi rute harus sama dengan `expedition_id` |
| vehicle_id | UNIQUEIDENTIFIER | NULL; FK → vehicles |
| recorded_by | UNIQUEIDENTIFIER | FK → employees (RSI) |
| destination_address | NVARCHAR(200) | |
| ship_date | DATE | (RSI) |
| estimated_arrival, arrival_date | DATE | NULL |
| package_count | INT | NULL |
| total_weight_kg, volume_m3 | DECIMAL(10,2) | NULL |
| shipping_cost | DECIMAL(16,2) | NULL |
| status | VARCHAR(16) | CK IN (DIKIRIM, DALAM_PERJALANAN, TIBA) |
| created_at | DATETIME2(0) | |

Satu surat jalan hanya untuk satu order, tetapi boleh memuat banyak barang (beberapa style, warna, dan ukuran dari order itu). Satu order boleh dikirim bertahap dengan beberapa surat jalan (K-12).

**shipment_items** (lemah)

| Kolom | Tipe | Keterangan |
|---|---|---|
| shipment_id | UNIQUEIDENTIFIER | PK 1; FK → shipments |
| line_no | SMALLINT | PK 2 |
| order_detail_id, size | | FK gabungan → order_detail_sizes (RSI) |
| qty | INT | CK > 0 (RSI) |
| carton_no | VARCHAR(20) | NULL |

UQ (`shipment_id`, `order_detail_id`, `size`). Semua item wajib milik order yang sama dengan `shipments.order_id`; dicek `sp_record_shipment` dan dijaga trigger `trg_shipment_items_same_order` (B).

**export_documents** — `id` PK; `shipment_id` UQ FK; `peb_no VARCHAR(30)`, `peb_date DATE`; `commercial_invoice_no`, `packing_list_no`, `bl_awb_no`, `coo_no NULL`, `vessel_flight_no VARCHAR(30)`; `container_no NULL`, `container_type VARCHAR(10) NULL`; `etd`, `eta DATE`; `loading_port`, `destination_port NVARCHAR(60)`; `fob_value DECIMAL(16,2)`.

**shipment_trackings** (lemah) — PK (`shipment_id`, `updated_at DATETIME2(0)`); `location NVARCHAR(100)`; `position_status VARCHAR(20)`; `description NVARCHAR(300) NULL`.

### 4.4 Milik C — `04-produksi.sql` (schema garment)

**production_lines** — `id` PK; `factory_id` FK; `supervisor_id` FK → employees; `line_name NVARCHAR(50)`; `capacity_pcs_per_day INT`.

**spk**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| spk_no | CHAR(12) | UQ; SPK-TTBB-NNN (RSI) |
| order_detail_id | UNIQUEIDENTIFIER | FK → order_details (per style, K-03) |
| line_id | UNIQUEIDENTIFIER | FK → production_lines; **wajib**, dipilih PPIC (fitur tambahan) |
| created_by | UNIQUEIDENTIFIER | FK → employees (PPIC) |
| materials_complete_by | UNIQUEIDENTIFIER | FK → employees (RSI) |
| decided_by | UNIQUEIDENTIFIER | NULL; FK → employees (Pimpinan) (RSI) |
| start_date | DATE | NULL |
| target_date | DATE | (RSI) |
| finish_date | DATE | NULL |
| status | VARCHAR(20) | DF 'MENUNGGU_PERSETUJUAN' (RSI) |
| approved_at | DATETIME2(0) | NULL; CK `status IN ('MENUNGGU_PERSETUJUAN','DITOLAK') OR approved_at IS NOT NULL`, jadi tetap berlaku kalau nanti ada status sesudah DISETUJUI |
| reject_reason | NVARCHAR(500) | NULL; CK wajib bila DITOLAK |
| created_at | DATETIME2(0) | |

Unique filtered: satu SPK aktif per `order_detail_id` (`WHERE status IN ('MENUNGGU_PERSETUJUAN','DISETUJUI')`). `target_qty` di skema bersifat derived (jumlah `spk_sizes`).

Status SPK tetap tiga (MENUNGGU_PERSETUJUAN, DISETUJUI, DITOLAK), sama dengan v1. Saat order dibatalkan, status SPK **tidak** diubah. Yang mencegah kelanjutan adalah status order (RB-23). Karena itu `sp_decide_spk` wajib menolak keputusan atas SPK yang ordernya DIBATALKAN, DITOLAK, atau DITARIK. Kalau nanti status SPK ditambah (mis. DIBATALKAN), CK `approved_at` di atas harus ikut diperbarui.

**spk_sizes** (lemah) — PK (`spk_id`, `size`); `qty INT` CK > 0. Sama dengan v1.

**production_progress**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| spk_id | UNIQUEIDENTIFIER | FK → spk |
| stage_code | VARCHAR(10) | FK → production_stages |
| work_date | DATE | |
| qty_done | INT | CK ≥ 0. **Satu-satunya angka yang diisi SPV** (K-09) |
| variance_note | NVARCHAR(300) | NULL; wajib bila kumulatif Cutting ≠ jumlah SPK |
| recorded_by | UNIQUEIDENTIFIER | FK → employees (SPV) |
| created_at, updated_at | DATETIME2(0) | |

UQ (`spk_id`, `stage_code`, `work_date`). Di skema konseptual, `qty_in`, `qty_reject`, dan `stage_status` dihapus atau dijadikan derived (lihat `v_style_progress`).

**suppliers**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| supplier_name | NVARCHAR(100) | (RSI) |
| supplier_type | VARCHAR(6) | CK IN (LOKAL, IMPOR) |
| country_code | CHAR(2) | FK → countries |
| contact_name | NVARCHAR(100) | (RSI, dulu `contact`) |
| phone | VARCHAR(20) | (RSI) |
| email | VARCHAR(100) | NULL |
| address | NVARCHAR(200) | |
| city | NVARCHAR(50) | |
| currency | CHAR(3) | DF 'IDR' |
| tax_id_no | VARCHAR(30) | NULL |
| rating | DECIMAL(2,1) | NULL; CK 1–5 |
| payment_term | VARCHAR(10) | CK IN (LUNAS_AWAL, DP, KREDIT) (RSI) |
| payment_term_days | SMALLINT | DF 0 |
| is_active | BIT | DF 1 |
| created_at | DATETIME2(0) | |

**material_categories** — `id` PK, `category_name NVARCHAR(50)`.

**raw_materials** — `id` PK; `material_code VARCHAR(20)` UQ; `category_id` FK; `material_name NVARCHAR(100)`; `specification NVARCHAR(200) NULL`; `color NVARCHAR(50) NULL`; `unit NVARCHAR(20)`; `hs_code VARCHAR(12) NULL`; `minimum_stock DECIMAL(12,2)` DF 0.

**bom** (M:N `bill_of_materials`) — PK (`item_id`, `material_id`); `qty_per_pcs DECIMAL(10,4)` CK > 0; `unit NVARCHAR(20)`; `waste_tolerance_pct DECIMAL(5,2)` DF 0.

**supplier_materials** (ternary `supplies`, M:N:1) — PK (`supplier_id`, `material_id`); `origin_country` FK → countries (sisi "1"); `offer_price DECIMAL(16,2)`; `currency CHAR(3)`; `lead_time_days SMALLINT`; `minimum_order DECIMAL(12,2)`; `is_main_supplier BIT`.

**order_materials** (RSI `materials`)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| order_detail_id | UNIQUEIDENTIFIER | FK → order_details (dulu `style_id`) |
| material_id | UNIQUEIDENTIFIER | FK → raw_materials; **wajib** (dulu `material_name` teks) |
| qty | DECIMAL(12,2) | CK > 0 |
| unit | NVARCHAR(20) | |
| source | VARCHAR(8) | CK IN (BUYER, SUPPLIER) |
| supplier_id | UNIQUEIDENTIFIER | NULL; FK; wajib bila SUPPLIER |
| material_price | DECIMAL(16,2) | NULL; wajib bila SUPPLIER |
| received_date | DATE | |
| checked_by | UNIQUEIDENTIFIER | FK → employees (PPIC) |
| checked_at, updated_at | DATETIME2(0) | |

**material_usages** — `id` PK; `spk_id` FK; `material_id` FK; `batch_no VARCHAR(30)`; `used_qty DECIMAL(12,2)` CK > 0; `usage_date DATE`; `recorded_by` FK → employees.

**purchase_orders** — `id` PK; `po_no CHAR(11)` UQ (PO-TTBB-NNN); `supplier_id` FK; `factory_id` FK; `order_id` NULL FK; `created_by` FK → employees; `approved_by` NULL FK → employees; `po_date`, `required_date DATE`; `incoterm VARCHAR(3) NULL`; `currency CHAR(3)`; `exchange_rate DECIMAL(12,4)`; `status VARCHAR(17)` CK IN (DRAF, DISETUJUI, DITERIMA_SEBAGIAN, SELESAI, DIBATALKAN).

**purchase_order_items** — `id` PK; `po_id` FK; `material_id` FK; `ordered_qty DECIMAL(12,2)`; `unit_price DECIMAL(16,2)`; UQ (`po_id`, `material_id`).

**material_receipts** — `id` PK; `po_id` FK; `warehouse_id` FK; `received_by` FK → employees; `supplier_delivery_note_no VARCHAR(30)`; `arrival_date DATE`.

**material_receipt_items** — `id` PK; `receipt_id` FK; `po_item_id` FK; `origin_country` FK → countries; `batch_no VARCHAR(30)`; `received_qty`, `rejected_qty DECIMAL(12,2)` (rejected DF 0).

**import_documents** — `id` PK; `receipt_id` UQ FK; `forwarder_id` NULL FK → expeditions; `customs_document_type VARCHAR(4)` CK IN (BC20, BC23); `customs_document_no VARCHAR(30)`; `document_date DATE`; `bl_awb_no VARCHAR(30)`; `loading_port`, `discharge_port NVARCHAR(60)`; `cif_value`, `import_duty`, `import_vat`, `import_pph22 DECIMAL(16,2)`; `customs_status VARCHAR(7)` CK IN (PROSES, SELESAI).

**qc_standards** — `id` PK; `type_code` NULL FK → product_types; `parameter_name NVARCHAR(100)`; `tolerance_value NVARCHAR(50)`; `sampling_reference VARCHAR(30)`.

**defect_types** — `id` PK; `defect_name NVARCHAR(60)`; `level VARCHAR(6)` CK IN (MINOR, MAYOR, KRITIS).

**qc_results**

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | UNIQUEIDENTIFIER | PK |
| inspection_type | VARCHAR(8) | CK IN (INCOMING, INLINE, FINAL). RSI memakai INLINE |
| spk_id | UNIQUEIDENTIFIER | NULL; FK → spk (RSI) |
| stage_code | VARCHAR(10) | NULL; FK → production_stages; CK ≠ PACKING (RSI) |
| receipt_item_id | UNIQUEIDENTIFIER | NULL; FK → material_receipt_items |
| standard_id | UNIQUEIDENTIFIER | FK → qc_standards; **wajib** (fitur tambahan) |
| inspected_by | UNIQUEIDENTIFIER | FK → employees (QC) |
| check_date | DATE | (RSI) |
| sample_qty | INT | NULL |
| qty_passed | INT | CK ≥ 0 (RSI) |
| final_result | VARCHAR(11) | NULL; CK IN (LOLOS, TIDAK_LOLOS) |
| inspected_by_buyer | BIT | DF 0 |
| created_at | DATETIME2(0) | |

CK: INCOMING → `receipt_item_id` terisi dan `spk_id` kosong; selain itu → `spk_id` dan `stage_code` terisi. Atribut `defect_qty` dari skema dijadikan derived (jumlah `qc_defects.qty`).

**qc_defects** — `id` PK; `qc_id` FK; `defect_type_id` FK; `qty INT` CK > 0; `action_taken NVARCHAR(200) NULL`; UQ (`qc_id`, `defect_type_id`).

**material_stocks** — `id` PK; `location_id` FK → rack_locations; `material_id` FK; `batch_no VARCHAR(30)`; `available_qty`, `allocated_qty DECIMAL(12,2)` (CK allocated ≤ available); `updated_at`. UQ (`location_id`, `material_id`, `batch_no`). `free_qty` derived.

**product_stocks** — `id` PK; `location_id` FK; `variant_id` FK → item_variants; `spk_id` NULL FK; `available_qty INT`; `goods_condition VARCHAR(5)` CK IN (BAIK, RUSAK); `updated_at`.

**stock_movements** — `id` PK; `movement_type VARCHAR(11)` CK IN (MASUK, KELUAR, PINDAH, PENYESUAIAN); `from_location_id`, `to_location_id` NULL FK; `material_id` NULL FK; `variant_id` NULL FK; `batch_no NULL`; `qty DECIMAL(12,2)`; `reference_type VARCHAR(20)`; `reference_no VARCHAR(30)`; `moved_by` FK → employees; `movement_date DATETIME2(0)`. CK: tepat satu dari `material_id`/`variant_id` terisi.

**stock_counts** — `id` PK; `location_id` FK; `material_id`, `variant_id` NULL (tepat satu terisi); `counted_by` FK → employees; `count_date DATE`; `system_stock`, `physical_stock DECIMAL(12,2)`. `difference` derived.

**facilities** — `id` PK; `factory_id` NULL FK; `facility_name NVARCHAR(60)`; `facility_type NVARCHAR(30)`; `status VARCHAR(10)` CK IN (BAIK, RUSAK, PERBAIKAN).

**equipment** — `id` PK; `factory_id` FK; `line_id` NULL FK; `supplier_id` NULL FK; `equipment_name`, `equipment_type`, `brand NVARCHAR(60)`; `serial_no VARCHAR(40)` UQ; `purchase_date DATE`; `purchase_price DECIMAL(16,2)`; `service_interval_days SMALLINT`; `status VARCHAR(10)` CK IN (AKTIF, PERBAIKAN, RUSAK).

**maintenances** — `id` PK; `equipment_id`, `facility_id` NULL FK (CK tepat satu terisi); `reported_by` FK → employees; `technician_id` NULL FK → employees; `vendor_id` NULL FK → suppliers; `maintenance_type VARCHAR(9)` CK IN (PREVENTIF, KOREKTIF); `damage_description NVARCHAR(300)`; `corrective_action NVARCHAR(300) NULL`; `repair_cost DECIMAL(16,2) NULL`; `status VARCHAR(10)` CK IN (DILAPORKAN, DIKERJAKAN, SELESAI); `reported_date DATETIME2(0)`; `finish_date DATETIME2(0) NULL`.

### 4.5 Milik A — `05-akuntansi.sql`

**accounts** — `account_code VARCHAR(10)` PK; `parent_code` NULL FK → accounts (rekursif); `account_name NVARCHAR(80)`; `account_type VARCHAR(10)` CK IN (ASET, KEWAJIBAN, EKUITAS, PENDAPATAN, BEBAN).

**company_bank_accounts** — `id` PK; `factory_id` FK; `account_code` FK → accounts; `bank_name NVARCHAR(50)`; `account_no VARCHAR(30)` UQ; `currency CHAR(3)`.

**journals** — `id` PK; `journal_no CHAR(11)` UQ (JU-TTBB-NNN); `factory_id` FK; `created_by` FK → employees; `journal_date DATE`; `description NVARCHAR(200)`; `reference_type VARCHAR(20)`; `reference_no VARCHAR(30)`.

**journal_lines** (lemah) — PK (`journal_id`, `line_no SMALLINT`); `account_code` FK; `debit`, `credit DECIMAL(16,2)` DF 0; CK tepat satu dari debit/kredit > 0. Keseimbangan jurnal dijaga `sp_post_journal`.

**payrolls** (lemah) — PK (`employee_id`, `period_year SMALLINT`, `period_month TINYINT`); `bank_account_id` FK → company_bank_accounts; `base_salary`, `position_allowance`, `meal_allowance`, `transport_allowance`, `overtime_pay`, `bpjs_deduction`, `pph21_deduction`, `other_deduction DECIMAL(16,2)`; `status VARCHAR(7)` CK IN (DRAF, DIBAYAR); `paid_date DATE NULL`. `net_salary` derived.

### 4.6 Milik B — `06-penjualan.sql`

**tax_types** — `id` PK; `tax_name NVARCHAR(40)`; `rate_pct DECIMAL(5,2)`; `valid_from DATE`; `account_code` FK → accounts.

**taxes** — `id` PK; `tax_type_id` FK; `factory_id` FK; `tax_year SMALLINT`, `tax_month TINYINT`; `tax_base_amount DECIMAL(16,2)`; `tax_invoice_no VARCHAR(30) NULL`; `reference_type`, `reference_no`; `ntpn VARCHAR(20) NULL`; `status VARCHAR(8)` CK IN (TERUTANG, DISETOR); `deposit_date DATE NULL`. `tax_amount` derived.

**sales_invoices** — `id` PK; `invoice_no CHAR(12)` UQ (INV-TTBB-NNN); `order_id` FK; `shipment_id` NULL FK; `cancellation_id` NULL FK; `invoice_type VARCHAR(9)` CK IN (DP, PELUNASAN, DENDA); `currency`, `exchange_rate`; `subtotal`, `discount`, `vat_amount DECIMAL(16,2)`; `due_date DATE`; `status VARCHAR(11)` CK IN (BELUM_LUNAS, LUNAS, BATAL); `created_at`.

**supplier_bills** — `id` PK; `po_id` FK; `supplier_invoice_no VARCHAR(30)`; `bill_date`, `due_date DATE`; `currency CHAR(3)`; `total DECIMAL(16,2)`; `status VARCHAR(11)` CK IN (BELUM_LUNAS, LUNAS).

**payments** — `id` PK; `direction VARCHAR(6)` CK IN (MASUK, KELUAR); `invoice_id`, `bill_id`, `cancellation_id` NULL FK (CK tepat satu terisi); `bank_account_id` FK; `amount DECIMAL(16,2)` CK > 0 (di skema tertulis `qty`, diperbaiki jadi `amount`); `currency`, `exchange_rate`; `payment_method VARCHAR(8)` CK IN (TRANSFER, TT, LC, GIRO, TUNAI) (sama dengan `order_level_payment_methods`); `reference_no VARCHAR(30)`; `status VARCHAR(8)` CK IN (BERHASIL, GAGAL, PENDING); `paid_date DATE`. `amount_idr` derived.

---

## 5. Objek database dan pemiliknya

| Pemilik | Stored procedure | Function | View | Trigger |
|---|---|---|---|---|
| A | sp_record_login, sp_reset_password, sp_create_notification, sp_post_journal, sp_process_payroll | fn_next_doc_no, fn_employee_of_user | v_active_sessions, v_login_history, v_employee_directory (tanpa gaji dan rekening) | trg_activity_logs_append_only, trg_interns_check, trg_no_delete_transactions (tabel A: attendances, journals, journal_lines, payrolls, employment_contracts) |
| B | sp_create_order, sp_change_order_status, sp_cancel_order, sp_record_shipment, sp_issue_invoice, sp_record_payment | fn_next_order_code, fn_next_item_code, fn_cancellation_penalty | v_order_summary, v_price_history, v_dashboard_orders, v_shipment_history | trg_orders_immutable, trg_shipment_items_same_order, trg_no_delete_transactions (tabel B) |
| C | sp_submit_spk, sp_decide_spk, sp_evaluate_flags, sp_receive_material, sp_record_stock_movement | fn_material_readiness, fn_material_requirement, fn_material_locked, fn_stage_max_allowed, fn_detail_completion_pct, fn_time_elapsed_pct, fn_reject_pct, fn_ready_to_ship | v_style_progress, v_supplier_materials, v_spk_list, v_stock_summary | trg_materials_lock, trg_no_delete_transactions (tabel C) |

Function yang dipakai lintas anggota (**nama dan parameter tidak boleh diubah tanpa persetujuan pemakainya**):

| Function | Dibuat | Dipakai | Untuk |
|---|---|---|---|
| fn_ready_to_ship(@order_detail_id, @size) | C | B | Batas kiriman: Packing selesai dikurangi yang sudah dikirim |
| fn_detail_completion_pct(@order_detail_id) | C | B | Persen selesai di dashboard (dulu fn_style_completion_pct) |
| fn_time_elapsed_pct(@order_detail_id) | C | B | Persen waktu terpakai |
| fn_reject_pct(@order_detail_id) | C | B | Persen tidak lolos, dari QC |
| fn_material_requirement(@order_detail_id) | C | C, SMBD | Kebutuhan bahan dari BOM × jumlah per ukuran |
| fn_cancellation_penalty(@order_id) | B | B, SMBD | Denda dan refund sesuai level order dan tahap terakhir |
| fn_next_doc_no(@prefix, @at) | A | B (SJ, INV), C (SPK, PO), A (JU) | Nomor dokumen |
| fn_employee_of_user(@user_id) | A | B, C | Mengambil `employee_id` dari akun login |
| sp_create_notification | A | B, C | Notifikasi |

---

## 6. Nilai status dan pilihan tetap

Nilai yang dibawa dari v1:

| Tabel.kolom | Nilai |
|---|---|
| orders.status | MENUNGGU_PERSETUJUAN, DISETUJUI, DITOLAK, DITARIK, DALAM_PRODUKSI, SELESAI, DIBATALKAN |
| spk.status | MENUNGGU_PERSETUJUAN, DISETUJUI, DITOLAK |
| orders.scheme | CMT, FOB |
| suppliers.payment_term | LUNAS_AWAL, DP, KREDIT |
| order_materials.source | BUYER, SUPPLIER |
| production_stages.stage_code | CUTTING, SEWING, TRIMMING, FINISHING, IRONING, PACKING (urutan 1–6) |
| qc_results.stage_code | Semua tahap kecuali PACKING |
| product_types.type_code | CL, KM, KS, PL, DR, JK, SR |
| Status kesiapan bahan (hasil fn_material_readiness) | SIAP, BELUM_SIAP |

Nilai `sessions`, `password_reset_requests`, dan `activity_logs` ada di Bagian 4.2.

**Perpindahan status order** (sama dengan v1):

| Dari | Ke | Oleh |
|---|---|---|
| (baru) | MENUNGGU_PERSETUJUAN | MARKETING |
| MENUNGGU_PERSETUJUAN | DISETUJUI / DITOLAK (final, alasan wajib) | PIMPINAN |
| MENUNGGU_PERSETUJUAN | DITARIK (final, alasan wajib) | MARKETING |
| DISETUJUI | DALAM_PRODUKSI | otomatis saat SPK pertama order itu disetujui |
| DISETUJUI atau DALAM_PRODUKSI | DIBATALKAN (alasan wajib) | PIMPINAN |
| DALAM_PRODUKSI | SELESAI | otomatis saat pengiriman dicatat |

Nilai baru ada di kolom Keterangan di Bagian 4 (setiap `CK IN (...)`). Semua ditulis huruf kapital dengan garis bawah, dan di backend diambil dari `constants.ts`.

Perpindahan status order sama dengan v1, dengan satu tambahan. Saat Pimpinan membatalkan order (`POST /orders/{id}/cancel`), `sp_cancel_order` juga membuat baris `order_cancellations` berstatus DISETUJUI, lengkap dengan denda dan refund hasil `fn_cancellation_penalty`.

---

## 7. Role

| role_code | Nama tampilan | access_tier | Lingkup |
|---|---|---|---|
| SUPERADMIN | Super Admin | SUPERADMIN | **Hanya SMBD.** Seluruh halaman `/smbd/*` dan data master |
| ADMIN | Administrator Sistem | ADMIN | RSI (dulu tier SUPERADMIN) |
| PIMPINAN | Pimpinan | ADMIN | RSI |
| MARKETING | Marketing | USER | RSI |
| PPIC | PPIC | USER | RSI |
| SPV | Supervisor | USER | RSI |
| QC | Quality Control | USER | RSI |

Role ditentukan oleh akun, bukan dipilih saat login. Tidak ada pilihan role di halaman login. **[TERBUKA: konfirmasi Pak Bawi soal role di luar lingkup RSI]**

---

## 8. Konvensi kode

Struktur folder dan lapisan sama dengan v1 (router → controller → service → repository; `authenticate → authorize → validate → controller`). Tambahan:

- Modul SMBD ada di `routes/smbd/`, `controllers/smbd/`, dan seterusnya, dengan prefix URL `/api/v1/smbd`. Semua dijaga `authorize(ROLE.SUPERADMIN)`.
- Skema Drizzle dipisah per schema database (`app`, `garment`) memakai helper schema dari drizzle-orm. Nama tabel di query mentah selalu ditulis lengkap (`garment.orders`).
- `req.user` berisi `{ id, username, role_code, employee_id, factory_id }`. Nilai ini diisi `authenticate` lewat satu query join `users → employees`. Service memakai `req.user.employee_id` untuk semua kolom `*_by`.
- **Ketentuan OOP RSI** (enkapsulasi, inheritance, overriding, overloading, polymorphism, komposisi, agregasi, asosiasi) diterapkan di lapisan service dan repository: `BaseRepository<T>` diturunkan ke repository tiap modul, `AppError extends Error`, dan seterusnya. Contohnya ditulis A saat membuat kerangka backend (Hari 1–2), lalu dipakai semua anggota.

Tambahan `constants.ts`:

```ts
export const ROLE = {
  SUPERADMIN: 'SUPERADMIN', ADMIN: 'ADMIN', PIMPINAN: 'PIMPINAN',
  MARKETING: 'MARKETING', PPIC: 'PPIC', SPV: 'SPV', QC: 'QC',
} as const;
export const ORDER_LEVEL = { DOMESTIK: 'DOMESTIK', INTERNASIONAL: 'INTERNASIONAL' } as const;
export const INSPECTION_TYPE = { INCOMING: 'INCOMING', INLINE: 'INLINE', FINAL: 'FINAL' } as const;
export const PAYMENT_METHOD = ['TRANSFER', 'TT', 'LC', 'GIRO', 'TUNAI'] as const;
export const CANCELLATION_STATUS = { MENUNGGU: 'MENUNGGU', DISETUJUI: 'DISETUJUI', DITOLAK: 'DITOLAK' } as const;
// DOC_TYPE dihapus bersama fitur salinan bertanda tangan
```

---

## 9. Format API

Sama dengan v1 Bagian 8: bentuk response, kode HTTP, kode error, dan aturan kolom harga. Tambahan:

- Kolom harga yang disembunyikan dari role selain MARKETING dan PIMPINAN sekarang meliputi `unit_price`, `discount_pct`, `material_price`, `total_value`, `penalty_amount`, dan `refund_amount`.
- `total_value` **bukan kolom tabel**. Nilainya dihitung `v_order_summary` dengan rumus `total_value = Σ (qty − cancelled_qty) × unit_price × (1 − discount_pct/100)` atas semua baris `order_detail_sizes` milik order itu (`unit_price` dan `discount_pct` diambil dari `order_details`). Pembatalan sebagian ikut terhitung lewat `cancelled_qty`. Di skema konseptual atribut derived ini bernama `total_order_value`; namanya diseragamkan menjadi `total_value` (T-06). Field API dan kolom view memakai nama `total_value`.
- Kode error baru per modul (`ERR-BTL-xx` pembatalan, `ERR-STK-xx` stok, `ERR-JRN-xx` jurnal, dst.) dicatat pemilik modul di tabel kode error, lalu disalin ke FSD saat revisi dokumen.

---

## 10. Login, sesi, log aktivitas, notifikasi

- Login dan sesi sama dengan v1 Bagian 9. `GET /auth/me` sekarang mengembalikan `full_name` dari `employees`, ditambah `factory_id`.
- Log aktivitas sama dengan v1 Bagian 10 dan 10.1 (pola `withTransaction`). `action_type` UNGGAH_DOKUMEN dihapus.
- Notifikasi N-01 sampai N-11 sama dengan v1. N-12 dan N-13 dihapus. Notifikasi untuk modul SMBD tidak dibuat.

---

## 11. Format nomor

| Nomor | Format | Function |
|---|---|---|
| Kode order | ORD-TTBB-NNN | fn_next_order_code |
| Kode barang | BBB-JJ-NNNN (BBB = `GEN` bila tanpa buyer) | fn_next_item_code |
| SKU varian | {kode barang}-{ukuran}-{NN} | dibuat di service B |
| SPK | SPK-TTBB-NNN | fn_next_doc_no('SPK') |
| Surat jalan | SJ-TTBB-NNN | fn_next_doc_no('SJ') |
| Purchase order | PO-TTBB-NNN | fn_next_doc_no('PO') |
| Invoice | INV-TTBB-NNN | fn_next_doc_no('INV') |
| Jurnal | JU-TTBB-NNN | fn_next_doc_no('JU') |

---

## 12. Akun demo

Setiap akun wajib terhubung ke satu karyawan (`has_account`). Seed A membuat 1 pabrik, 1 gudang barang jadi, 1 gudang bahan, dan 7 karyawan.

| username | role_code | Karyawan seed | Password |
|---|---|---|---|
| superadmin | SUPERADMIN | Staf Sistem Informasi | `Solaris#2026` |
| admin.solaris | ADMIN | Staf IT | `Solaris#2026` |
| pimpinan | PIMPINAN | Direktur | `Solaris#2026` |
| marketing | MARKETING | Staf Marketing | `Solaris#2026` |
| ppic | PPIC | Staf PPIC | `Solaris#2026` |
| supervisor | SPV | Supervisor Lini 1 | `Solaris#2026` |
| qc.solaris | QC | Staf QC | `Solaris#2026` |

---

## 13. Keamanan database (SMBD, file `10-security.sql`, pemilik A)

Mengikuti materi *Security and Authorization*:

| Login / user | Dipakai oleh | Hak |
|---|---|---|
| `app_rsi` | Backend saat role RSI login, **dan semua proses login** (sebelum login role belum diketahui) | Schema `app`: SELECT/INSERT/UPDATE `users` (buat akun FSD-2.2, reset dan ganti password, kunci akun, `last_login_at`); SELECT `roles`; SELECT/INSERT/UPDATE `sessions` (login, `last_activity_at`, logout, akhiri sesi); SELECT/INSERT `activity_logs` (tulis log, halaman Log Aktivitas FSD-2.23); SELECT/INSERT/UPDATE `password_reset_requests`; SELECT/INSERT/UPDATE `notifications`; SELECT `v_login_history` (FSD-2.19) dan `v_active_sessions` (FSD-2.22); EXECUTE SP milik A. Schema `garment`: SELECT/INSERT/UPDATE pada tabel yang dipakai RSI; EXECUTE SP RSI. DENY DELETE di semua tabel (RB-67 hanya mengizinkan tambah/ubah bahan, jadi tidak perlu izin hapus) |
| `app_smbd` | Backend saat SUPERADMIN login | Schema `app`: **hak yang sama dengan `app_rsi`** (SUPERADMIN tetap melewati `authenticate`, logout, ganti password, dan `logActivity` di dalam `withTransaction`, yang harus memakai login yang sama dengan transaksinya). Schema `garment`: SELECT/INSERT/UPDATE semua tabel; EXECUTE semua SP. DENY DELETE pada tabel transaksi |
| Role database `rl_keuangan`, `rl_gudang`, `rl_hrd` | Demo SMBD di SSMS | Contoh hak per tabel/kolom. Contohnya `rl_hrd` boleh melihat gaji, sedangkan role lain hanya melihat `v_employee_directory` |

Backend memakai dua pool koneksi (`getPool('rsi')`, `getPool('smbd')`) sesuai role yang login. **[TERBUKA: dipakai atau cukup satu login]**

---

## 14. Endpoint

### 14.1 RSI: fitur tambahan yang masuk (K-07) dan prioritasnya

| Fitur | Halaman | Pemilik | Prioritas |
|---|---|---|---|
| Ekspedisi dipilih dari daftar | Pengiriman | B | W |
| Diskon per style | Form Order | B | W |
| Level order (isian internasional) | Form Order | B | W |
| Lini produksi pada SPK | SPK | C | W |
| Jenis cacat di hasil QC | Hasil QC | C | W |
| Denda dan refund otomatis saat pembatalan | Persetujuan, Detail Order | B | S |
| Standar QC | Hasil QC | C | S |
| Master bahan + BOM (kebutuhan otomatis) | Bahan Baku | C | S |
| Pemakaian bahan per SPK | Halaman baru SCR-26 | C | T |

W = Wajib, S = Kalau sempat, T = Terakhir. Tabelnya tetap dibuat lengkap sejak Hari 1; yang bertahap hanya tampilannya.

### 14.2 RSI: endpoint yang berubah dari v1

| v1 | v2 | Pemilik |
|---|---|---|
| GET, POST /order-styles/{styleId}/materials | GET, POST /order-details/{id}/materials | C |
| POST /spk (style_id, sizes) | POST /spk (order_detail_id, line_id, sizes) | C |
| POST /spk/{id}/qc-results (stage, qty_passed) | + standard_id, sample_qty, defects[] | C |
| POST /shipments (order_id, expedition teks) | POST /shipments (order_id, expedition_id, items[]: order_detail_id, size, qty) | B |
| POST /orders/{id}/cancel | Response ditambah penalty_amount dan refund_amount | B |
| POST /spk/{id}/signed-documents, /shipments/{id}/signed-documents, /signed-documents/{id}/file, GET /spk/{id}/print | **dihapus** (cetak SPK boleh tetap kalau sempat) | B, C |

### 14.3 RSI: endpoint baru (hanya baca, untuk dropdown)

| Method | URL | Role | Pemilik |
|---|---|---|---|
| GET | /order-levels | MARKETING | B |
| GET | /expeditions | PPIC | B |
| GET | /orders/{id}/cancellation-preview | PIMPINAN | B |
| GET | /production-lines | PPIC | C |
| GET | /qc-standards?type_code= | QC | C |
| GET | /defect-types | QC | C |
| GET | /raw-materials | PPIC | C |
| GET | /order-details/{id}/material-requirement | PPIC | C |
| GET, POST | /spk/{id}/material-usages | SPV, PPIC | C |

Endpoint v1 lain (auth, users, sessions, buyers, orders, approve/reject, progress, dashboard, dst.) tetap, dengan `styleId` diganti `orderDetailId` di semua path.

### 14.4 SMBD: `/api/v1/smbd/*` (SUPERADMIN)

| Jenis | Endpoint | Pemilik |
|---|---|---|
| Penampil tabel umum | GET /smbd/tables, GET /smbd/tables/{table}?page=&q= — **hanya schema `garment`**. Nama tabel dicek terhadap daftar tabel `garment` (whitelist), sehingga tabel `app` (termasuk `password_hash`) tidak pernah bisa dibuka | A |
| Master data RSI | CRUD /smbd/production-lines, /qc-standards, /defect-types, /raw-materials, /bom | C |
| | CRUD /smbd/order-levels, /cancellation-policies, /expeditions | B |
| SDM | CRUD /smbd/employees, /contracts, /interns, /attendances; POST /smbd/payrolls/process | A |
| Akuntansi | POST /smbd/journals (lewat sp_post_journal) | A |
| Supply chain dan stok | POST /smbd/purchase-orders, /smbd/receipts (sp_receive_material), /smbd/stock-movements, /smbd/stock-counts | C |
| Penjualan | POST /smbd/invoices, /smbd/payments; pembatalan sebagian | B |
| Aset | CRUD /smbd/equipment, /smbd/maintenances | C |

**[TERBUKA]** Daftar halaman transaksi SMBD final mengikuti jawaban dosen SMBD.

---

## 15. Halaman frontend

### 15.1 RSI

Sama dengan v1 Bagian 14, dengan perubahan:

| SCR | Halaman | Perubahan | Pemilik |
|---|---|---|---|
| SCR-03 | Manajemen Pengguna | Buat akun = pilih karyawan yang belum punya akun, lalu username dan role | A |
| SCR-05 | Formulir Order Baru | Tambah diskon per style dan level order (isian internasional muncul bila dipilih) | B |
| SCR-06 / SCR-08 | Detail Order, Persetujuan | Pembatalan menampilkan denda dan refund | B |
| SCR-10 | Bahan Baku | Bahan dipilih dari master; tampil kebutuhan dari BOM | C |
| SCR-11 | SPK | Pilih lini produksi | C |
| SCR-12 | Progres Harian | **Tidak berubah** (K-09) | C |
| SCR-13 | Hasil QC | Pilih standar, jumlah sampel, daftar jenis cacat | C |
| SCR-16 / SCR-17 | Pengiriman, Surat Jalan | Ekspedisi dari daftar; item dipilih per style dan ukuran | B |
| SCR-25 | SPK Siap Cetak dan Salinan | **Dihapus** | C |
| SCR-26 | Pemakaian Bahan per SPK | **Baru** (prioritas T) | C |

### 15.2 SMBD (hanya SUPERADMIN, path `/smbd/*`)

| Halaman | Path | Pemilik |
|---|---|---|
| Penampil tabel umum (pilih modul → tabel → lihat dan cari) | /smbd/data | A |
| Master Produksi (lini, standar QC, jenis cacat, bahan, BOM) | /smbd/master-produksi | C |
| Master Order (level order, kebijakan pembatalan, ekspedisi) | /smbd/master-order | B |
| Karyawan dan Penggajian | /smbd/sdm | A |
| Jurnal | /smbd/jurnal | A |
| PO, Penerimaan, dan Stok | /smbd/gudang | C |
| Invoice dan Pembayaran | /smbd/keuangan | B |
| Aset dan Maintenance | /smbd/aset | C |

Menu SMBD hanya dikirim `/auth/me` untuk role SUPERADMIN. Login dengan role RSI tidak akan pernah melihat menu ini.

---

## 16. Rencana 5 hari rombak (usulan)

| Hari | A | B | C |
|---|---|---|---|
| 1 | Finalisasi kontrak bersama; `00`, `01`, `02` | Finalisasi kontrak; mulai `03` | Finalisasi kontrak; mulai `04` |
| 2 | `05`; seed `90`; kerangka backend + contoh OOP | `03` selesai; `06` | `04` selesai |
| 3 | `07-objects-core`, `10-security` | seed `91`; `09-objects-order` | seed `92`; `08-objects-produksi` |
| 4 | Jalankan semua dari nol, perbaiki FK/urutan; revisi mockup SCR-03 | Revisi mockup SCR-05/06/08/16/17 | Revisi mockup SCR-10/11/13 |
| 5 | Uji bersama: login 7 akun, alur order → SPK → progres → QC → kirim | | |

Aturan Git sama dengan v1 Bagian 16.

---

## 17. Hal yang belum diputuskan [TERBUKA]

| No | Pertanyaan | Pengaruh |
|---|---|---|
| T-01 | Pak Bawi: perombakan RSI, role SUPERADMIN di sistem yang sama, fitur tambahan, OOP di class diagram atau kode | K-02, K-07, K-10, Bagian 7 |
| T-02 | Dosen SMBD: halaman SMBD cukup penampil umum + halaman transaksi di Bagian 15.2? | Bagian 14.4, 15.2 |
| ~~T-03~~ | **Selesai 20/11/2026 (K-12):** satu surat jalan untuk satu order, boleh banyak barang. `shipments.order_id` ditambahkan | Bagian 4.3 |
| T-04 | Dua login database (`app_rsi`, `app_smbd`) atau cukup satu? | Bagian 13, `db/pool.ts` |
| T-05 | Pembagian anggota dan jumlah tabel di Bagian 2 sudah adil? | Bagian 2, 3 |
| T-06 | Dokumen skema konseptual perlu direvisi menyesuaikan kontrak ini: K-03/K-04 (order_detail_sizes, spk_sizes), K-05, K-09, `buyer_style_code` bukan key, `payments.qty` → `amount`, `total_order_value` → `total_value`, metode bayar di `order_levels` dan `payments` diseragamkan, relasi baru `ships_order` (orders 1 : N shipments, partisipasi shipments total), aturan bisnis SMBD nomor 11 diubah menjadi "satu order boleh dikirim bertahap; satu pengiriman hanya untuk satu order" | Laporan SMBD |

---

## 18. Riwayat perubahan

| Tanggal | Diubah oleh | Perubahan |
|---|---|---|
| 14/11/2026 | Kelompok 1 | v1: versi awal dari TSD v1.1, FSD v2.0, SRS v2.0 |
| 16/11/2026 | Kelompok 1 | v1: tambah pola transaksi (Bagian 10.1) |
| 20/11/2026 | Kelompok 1 | v2 DRAF revisi 4: Bagian 4.2 dan 6 ditulis lengkap (tidak lagi merujuk v1), karena KONTRAK v1 tidak ada di repo baru |
| 20/11/2026 | Kelompok 1 | v2 DRAF revisi 3: K-12, `shipments.order_id` ditambahkan, trigger `trg_shipment_items_same_order`, T-03 ditutup |
| 20/11/2026 | Kelompok 1 | v2 DRAF revisi 2: hak `app` lengkap untuk `app_rsi` (buat akun, baca log, baca permintaan reset, view riwayat login dan sesi aktif); `app_smbd` disamakan dengan `app_rsi` di schema `app` (logout dan ganti password); rumus `total_value` memakai `cancelled_qty`; proses login selalu memakai `app_rsi` |
| 19/11/2026 | Kelompok 1 | v2 DRAF revisi 1: hak `app` untuk kedua login DB, penampil tabel dibatasi ke `garment`, metode bayar diseragamkan, `orders.level_code`, CK `spk.approved_at`, trigger hapus untuk tabel A, `total_value` dijelaskan, nama B diperbaiki |
| 19/11/2026 | Kelompok 1 | v2 DRAF: database gabungan RSI + SMBD, 2 schema, 77 tabel, role SUPERADMIN, fitur tambahan RSI, `signed_documents` dihapus |
