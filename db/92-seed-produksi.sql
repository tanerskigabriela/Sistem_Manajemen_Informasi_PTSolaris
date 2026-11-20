-- =============================================================================
-- 92-seed-produksi.sql | Pemilik: C | KONTRAK v2 Bagian 3 dan 12
-- Seed: lini produksi, jenis cacat, standar QC, kategori bahan, bahan baku,
-- supplier, bahan per supplier, BOM, dan bahan untuk order seed B.
-- Ditambah data contoh untuk demo SMBD: saldo awal stok bahan, mesin, fasilitas.
-- Dijalankan setelah 91-seed-order.sql. Data hanya contoh.
--
-- Hasil yang bisa langsung dicoba di halaman RSI:
--   Order PO-BRT-0001 (DISETUJUI):
--     - Kaos Basic Hitam  : bahan lengkap -> SIAP, PPIC bisa mengajukan SPK
--     - Kaos Basic Putih  : bahan lengkap -> SIAP, PPIC bisa mengajukan SPK
--     - Kemeja Kerja Biru : bahan belum dicatat -> BELUM_SIAP (contoh ERR-SPK-02)
-- =============================================================================
USE solaris_db;
GO

SET NOCOUNT ON;
GO

-- ---------------------------------------------------------------------------
-- Lini produksi (supervisor = karyawan seed A "Supervisor Lini 1")
-- ---------------------------------------------------------------------------
INSERT INTO garment.production_lines (factory_id, supervisor_id, line_name, capacity_pcs_per_day)
SELECT f.id, e.id, v.line_name, v.capacity
FROM garment.factories f
JOIN garment.employees e ON e.full_name = N'Supervisor Lini 1'
CROSS JOIN (VALUES (N'Lini 1', 500), (N'Lini 2', 400)) AS v(line_name, capacity)
WHERE f.factory_name = N'PT Solaris Garment';
GO

-- ---------------------------------------------------------------------------
-- Jenis cacat
-- ---------------------------------------------------------------------------
INSERT INTO garment.defect_types (defect_name, level) VALUES
(N'Jahitan loncat',      'MINOR'),
(N'Noda',                'MINOR'),
(N'Benang tidak dipotong','MINOR'),
(N'Ukuran tidak sesuai', 'MAYOR'),
(N'Warna belang',        'MAYOR'),
(N'Kancing lepas',       'MAYOR'),
(N'Kain sobek',          'KRITIS');
GO

-- ---------------------------------------------------------------------------
-- Standar QC per jenis produk (type_code NULL = berlaku untuk semua produk)
-- ---------------------------------------------------------------------------
INSERT INTO garment.qc_standards (type_code, parameter_name, tolerance_value, sampling_reference) VALUES
('KS', N'Panjang badan',     N'± 1 cm',                           'AQL 2.5'),
('KS', N'Lebar dada',        N'± 1 cm',                           'AQL 2.5'),
('KS', N'Kerapian jahitan',  N'Maks. 1 jahitan loncat per 10 cm', 'AQL 2.5'),
('KM', N'Panjang lengan',    N'± 0,5 cm',                         'AQL 2.5'),
('KM', N'Posisi kancing',    N'± 0,3 cm',                         'AQL 1.5'),
('KM', N'Kerapian kerah',    N'Simetris, tanpa kerut',            'AQL 1.5'),
('PL', N'Lebar dada',        N'± 1 cm',                           'AQL 2.5'),
('SR', N'Panjang badan',     N'± 1 cm',                           'AQL 2.5'),
(NULL, N'Kebersihan',        N'Bebas noda dan sisa benang',       'AQL 2.5');
GO

-- ---------------------------------------------------------------------------
-- Kategori bahan dan bahan baku
-- Bahan dicatat tanpa warna supaya satu BOM berlaku untuk semua warna style.
-- ---------------------------------------------------------------------------
INSERT INTO garment.material_categories (category_name) VALUES
(N'Kain'), (N'Benang'), (N'Aksesoris'), (N'Kemasan');
GO

INSERT INTO garment.raw_materials (material_code, category_id, material_name, specification, color, unit, hs_code, minimum_stock)
SELECT v.code, c.id, v.name, v.spec, NULL, v.unit, v.hs, v.min_stock
FROM (VALUES
  ('KN-CTN-30S', N'Kain',      N'Kain Cotton Combed 30s', N'Rajut single jersey, 150 gsm', N'kg',    '6006', 200),
  ('KN-OXF-01',  N'Kain',      N'Kain Oxford',            N'Tenun, lebar 150 cm',          N'meter', '5208', 300),
  ('BN-PLY-40',  N'Benang',    N'Benang Polyester 40/2',  N'5.000 yard per cone',          N'cone',  '5508',  50),
  ('AK-KCG-14',  N'Aksesoris', N'Kancing Kemeja 14L',     N'4 lubang',                     N'pcs',   '9606',2000),
  ('AK-LBL-01',  N'Aksesoris', N'Label Merek',            N'Label tenun',                  N'pcs',   NULL,  2000),
  ('KM-PLS-01',  N'Kemasan',   N'Plastik Kemasan',        N'OPP 25 x 35 cm',               N'pcs',   '3923',2000)
) AS v(code, category, name, spec, unit, hs, min_stock)
JOIN garment.material_categories c ON c.category_name = v.category;
GO

-- ---------------------------------------------------------------------------
-- Supplier (2 lokal, 1 impor)
-- ---------------------------------------------------------------------------
INSERT INTO garment.suppliers
    (supplier_name, supplier_type, country_code, contact_name, phone, email, address, city,
     currency, tax_id_no, rating, payment_term, payment_term_days)
VALUES
(N'PT Tekstil Contoh',           'LOKAL', 'ID', N'Kontak Tekstil',   '081500000001', 'sales@tekstil.local',
 N'Jl. Tekstil No. 5',  N'Kota Contoh', 'IDR', '01.000.000.0-000.000', 4.5, 'KREDIT',     30),
(N'CV Aksesoris Garmen Contoh',  'LOKAL', 'ID', N'Kontak Aksesoris', '081500000002', 'sales@aksesoris.local',
 N'Jl. Pasar No. 8',    N'Kota Contoh', 'IDR', NULL,                   4.0, 'LUNAS_AWAL',  0),
(N'Shanghai Fabric Contoh Co.',  'IMPOR', 'CN', N'Kontak Shanghai',  '+86000000001', 'sales@shfabric.local',
 N'1 Contoh Road',      N'Shanghai',    'USD', NULL,                   4.2, 'DP',         30);
GO

-- Bahan per supplier (relasi ternary supplies). Supplier utama selalu lokal (IDR),
-- supaya harga bahan di order_materials tercatat dalam rupiah.
INSERT INTO garment.supplier_materials
    (supplier_id, material_id, origin_country, offer_price, currency, lead_time_days, minimum_order, is_main_supplier)
SELECT s.id, m.id, v.origin, v.price, v.cur, v.lead, v.min_order, v.main
FROM (VALUES
  (N'PT Tekstil Contoh',          'KN-CTN-30S', 'ID', 120000.00, 'IDR',  7,   50, 1),
  (N'PT Tekstil Contoh',          'KN-OXF-01',  'ID',  35000.00, 'IDR', 10,  100, 1),
  (N'PT Tekstil Contoh',          'BN-PLY-40',  'ID',  18000.00, 'IDR',  5,   10, 1),
  (N'CV Aksesoris Garmen Contoh', 'AK-KCG-14',  'ID',    150.00, 'IDR',  3, 1000, 1),
  (N'CV Aksesoris Garmen Contoh', 'AK-LBL-01',  'ID',    500.00, 'IDR',  7, 1000, 1),
  (N'CV Aksesoris Garmen Contoh', 'KM-PLS-01',  'ID',    300.00, 'IDR',  3, 1000, 1),
  (N'Shanghai Fabric Contoh Co.', 'KN-CTN-30S', 'CN',      6.50, 'USD', 30,  500, 0)
) AS v(supplier, code, origin, price, cur, lead, min_order, main)
JOIN garment.suppliers s     ON s.supplier_name = v.supplier
JOIN garment.raw_materials m ON m.material_code = v.code;
GO

-- ---------------------------------------------------------------------------
-- BOM: kebutuhan bahan per pcs untuk barang seed B
-- ---------------------------------------------------------------------------
INSERT INTO garment.bom (item_id, material_id, qty_per_pcs, unit, waste_tolerance_pct)
SELECT i.id, m.id, v.qty, v.unit, v.waste
FROM (VALUES
  (N'Kaos Basic',     'KN-CTN-30S', 0.2500, N'kg',    5),
  (N'Kaos Basic',     'BN-PLY-40',  0.0100, N'cone',  0),
  (N'Kaos Basic',     'AK-LBL-01',  1.0000, N'pcs',   2),
  (N'Kaos Basic',     'KM-PLS-01',  1.0000, N'pcs',   2),
  (N'Kemeja Kerja',   'KN-OXF-01',  1.6000, N'meter', 5),
  (N'Kemeja Kerja',   'BN-PLY-40',  0.0200, N'cone',  0),
  (N'Kemeja Kerja',   'AK-KCG-14',  8.0000, N'pcs',   2),
  (N'Kemeja Kerja',   'AK-LBL-01',  1.0000, N'pcs',   2),
  (N'Kemeja Kerja',   'KM-PLS-01',  1.0000, N'pcs',   2),
  (N'Seragam Kantor', 'KN-OXF-01',  1.8000, N'meter', 5),
  (N'Seragam Kantor', 'BN-PLY-40',  0.0200, N'cone',  0),
  (N'Seragam Kantor', 'AK-KCG-14',  7.0000, N'pcs',   2),
  (N'Seragam Kantor', 'AK-LBL-01',  1.0000, N'pcs',   2),
  (N'Seragam Kantor', 'KM-PLS-01',  1.0000, N'pcs',   2)
) AS v(item_name, code, qty, unit, waste)
JOIN garment.items i         ON i.item_name = v.item_name
JOIN garment.raw_materials m ON m.material_code = v.code;
GO

-- ---------------------------------------------------------------------------
-- Bahan untuk order seed B (PO-BRT-0001, skema FOB -> bahan dari supplier)
-- Jumlah = kebutuhan BOM (dibulatkan ke atas), dari supplier utama.
-- Hanya style Kaos Basic (Hitam dan Putih). Kemeja Kerja sengaja dibiarkan
-- BELUM_SIAP sebagai contoh SPK yang belum boleh diajukan.
-- ---------------------------------------------------------------------------
INSERT INTO garment.order_materials
    (order_detail_id, material_id, qty, unit, source, supplier_id, material_price, received_date, checked_by)
SELECT d.id, r.material_id, CEILING(r.required_qty), r.unit, 'SUPPLIER',
       sm.supplier_id, sm.offer_price, DATEADD(DAY, -3, CAST(SYSDATETIME() AS DATE)), ppic.id
FROM garment.order_details d
JOIN garment.orders o ON o.id = d.order_id
JOIN garment.items i  ON i.id = d.item_id
CROSS APPLY garment.fn_material_requirement(d.id) r
JOIN garment.supplier_materials sm ON sm.material_id = r.material_id AND sm.is_main_supplier = 1
CROSS JOIN (SELECT id FROM garment.employees WHERE full_name = N'Staf PPIC') ppic
WHERE o.buyer_po_no = 'PO-BRT-0001'
  AND i.item_name = N'Kaos Basic';
GO

-- =============================================================================
-- DATA TAMBAHAN UNTUK DEMO SMBD
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Saldo awal stok bahan di Gudang Bahan, lewat sp_record_stock_movement
-- (aturan SMBD no. 10: stok hanya berubah melalui mutasi)
-- ---------------------------------------------------------------------------
DECLARE @ppic UNIQUEIDENTIFIER = (SELECT id FROM garment.employees WHERE full_name = N'Staf PPIC'),
        @loc UNIQUEIDENTIFIER, @mat UNIQUEIDENTIFIER, @batch VARCHAR(30), @qty DECIMAL(12,2),
        @mv UNIQUEIDENTIFIER, @r VARCHAR(20), @err NVARCHAR(200), @n INT = 1;

DECLARE @saldo TABLE (n INT, rack VARCHAR(20), code VARCHAR(20), batch VARCHAR(30), qty DECIMAL(12,2));
INSERT INTO @saldo VALUES
(1, 'RM-A01', 'KN-CTN-30S', 'B-2611-001',  300),
(2, 'RM-A02', 'KN-OXF-01',  'B-2611-002',  500),
(3, 'RM-A03', 'BN-PLY-40',  'B-2611-003',   80),
(4, 'RM-A04', 'AK-KCG-14',  'B-2611-004', 3000),
(5, 'RM-A04', 'AK-LBL-01',  'B-2611-005', 2500),
(6, 'RM-A04', 'KM-PLS-01',  'B-2611-006', 2500);

WHILE @n <= 6
BEGIN
    SELECT @loc = r.id, @mat = m.id, @batch = s.batch, @qty = s.qty
    FROM @saldo s
    JOIN garment.rack_locations r ON r.rack_code = s.rack
    JOIN garment.warehouses w     ON w.id = r.warehouse_id AND w.warehouse_name = N'Gudang Bahan'
    JOIN garment.raw_materials m  ON m.material_code = s.code
    WHERE s.n = @n;

    EXEC garment.sp_record_stock_movement
         @movement_type = 'MASUK', @to_location_id = @loc, @material_id = @mat,
         @batch_no = @batch, @qty = @qty,
         @reference_type = 'SALDO_AWAL', @reference_no = 'SALDO-2611',
         @employee_id = @ppic, @movement_id = @mv OUTPUT, @result = @r OUTPUT;

    IF @r <> 'SUCCESS'
    BEGIN
        SET @err = CONCAT(N'Seed saldo stok baris ', @n, N' gagal: ', @r);
        THROW 50099, @err, 1;
    END;
    SET @n += 1;
END;
GO

-- ---------------------------------------------------------------------------
-- Mesin di Lini 1 dan fasilitas pabrik
-- ---------------------------------------------------------------------------
INSERT INTO garment.equipment
    (factory_id, line_id, supplier_id, equipment_name, equipment_type, brand, serial_no,
     purchase_date, purchase_price, service_interval_days, status)
SELECT f.id, l.id, NULL, v.name, v.type, N'Merek Contoh', v.serial, CAST(v.bought AS DATE), v.price, v.interval, 'AKTIF'
FROM garment.factories f
JOIN garment.production_lines l ON l.factory_id = f.id AND l.line_name = N'Lini 1'
CROSS JOIN (VALUES
  (N'Mesin Jahit 1',  N'Jahit Single Needle', 'SN-JHT-0001', '2023-01-10',  4500000, 90),
  (N'Mesin Jahit 2',  N'Jahit Single Needle', 'SN-JHT-0002', '2023-01-10',  4500000, 90),
  (N'Mesin Obras 1',  N'Obras',               'SN-OBR-0001', '2023-02-15',  6000000, 90),
  (N'Mesin Potong 1', N'Potong Kain',         'SN-PTG-0001', '2022-06-01', 12000000, 60)
) AS v(name, type, serial, bought, price, interval)
WHERE f.factory_name = N'PT Solaris Garment';
GO

INSERT INTO garment.facilities (factory_id, facility_name, facility_type, status)
SELECT f.id, v.name, v.type, 'BAIK'
FROM garment.factories f
CROSS JOIN (VALUES (N'Ruang Produksi Lantai 1', N'Ruang Produksi'),
                   (N'Genset Utama',            N'Utilitas'),
                   (N'Ruang QC',                N'Ruang Kerja')) AS v(name, type)
WHERE f.factory_name = N'PT Solaris Garment';
GO