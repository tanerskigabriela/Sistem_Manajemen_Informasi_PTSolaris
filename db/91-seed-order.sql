USE solaris_db;
GO

SET NOCOUNT ON;
GO

-- jenis produk
INSERT INTO garment.product_types (type_code, type_name) VALUES
('CL', N'Celana'),
('KM', N'Kemeja'),
('KS', N'Kaos'),
('PL', N'Kaos Polo'),
('DR', N'Dress'),
('JK', N'Jaket Ringan'),
('SR', N'Seragam');
GO

-- level order
INSERT INTO garment.order_levels (level_code, level_name, standard_lead_time_days, minimum_order_qty, vat_treatment, min_down_payment_pct, requires_export_document) VALUES
('DOMESTIK', N'Domestik', 30, 300, 'PPN', 30, 0),
('INTERNASIONAL', N'Internasional', 60, 1000, 'PPN_0', 30, 1);
GO

INSERT INTO garment.order_level_payment_methods (level_code, payment_method) VALUES
('DOMESTIK', 'TRANSFER'),
('DOMESTIK', 'GIRO'),
('DOMESTIK', 'TUNAI'),
('INTERNASIONAL', 'TT'),
('INTERNASIONAL', 'LC');
GO

-- kebijakan pembatalan
INSERT INTO garment.cancellation_policies (level_code, stage_code, request_deadline_days, penalty_pct, down_payment_refund_pct, material_owned_by_buyer, valid_from)
SELECT v.level_code, v.stage_code, v.deadline_days, v.penalty, v.refund, v.material, '2026-01-01'
FROM (VALUES
('DOMESTIK', NULL, 7, 5, 90, 0),
('DOMESTIK', 'CUTTING', 7, 15, 70, 1),
('DOMESTIK', 'SEWING', 7, 30, 50, 1),
('DOMESTIK', 'TRIMMING', 7, 45, 30, 1),
('DOMESTIK', 'FINISHING', 7, 60, 10, 1),
('DOMESTIK', 'IRONING', 7, 75, 0, 1),
('DOMESTIK', 'PACKING', 7, 90, 0, 1),
('INTERNASIONAL', NULL, 14, 10, 80, 0),
('INTERNASIONAL', 'CUTTING', 14, 20, 60, 1),
('INTERNASIONAL', 'SEWING', 14, 35, 40, 1),
('INTERNASIONAL', 'TRIMMING', 14, 50, 20, 1),
('INTERNASIONAL', 'FINISHING', 14, 65, 0, 1),
('INTERNASIONAL', 'IRONING', 14, 80, 0, 1),
('INTERNASIONAL', 'PACKING', 14, 95, 0, 1)
) AS v(level_code, stage_code, deadline_days, penalty, refund, material);
GO

-- ekspedisi
INSERT INTO garment.expeditions (expedition_name, partner_type, coverage, contact_name, phone, email) VALUES
(N'Ekspedisi Darat Contoh', 'EKSPEDISI', 'DOMESTIK', N'Kontak Ekspedisi', '081300000001', 'darat@ekspedisi.local'),
(N'Forwarder Samudra Contoh', 'FORWARDER', 'INTERNASIONAL', N'Kontak Forwarder', '081300000002', 'cargo@forwarder.local'),
(N'Kurir Kilat Contoh', 'KURIR', 'KEDUANYA', N'Kontak Kurir', '081300000003', 'cs@kurir.local');
GO

INSERT INTO garment.expedition_transport_modes (expedition_id, transport_mode)
SELECT e.id, v.mode
FROM garment.expeditions e
JOIN (VALUES
(N'Ekspedisi Darat Contoh', 'DARAT'),
(N'Forwarder Samudra Contoh', 'LAUT'),
(N'Forwarder Samudra Contoh', 'UDARA'),
(N'Kurir Kilat Contoh', 'DARAT'),
(N'Kurir Kilat Contoh', 'UDARA')
) AS v(name, mode) ON v.name = e.expedition_name;
GO

-- buyer
INSERT INTO garment.buyers (buyer_code, buyer_name, buyer_type, country_code, contact_name, phone, email, address, city, tax_id_no, default_currency, payment_term_days) VALUES
('BRT', N'PT Busana Retail Contoh', 'LOKAL', 'ID', N'Kontak BRT', '081400000001', 'order@brt.local', N'Jl. Contoh No. 10', N'Kota Contoh', '00.000.000.0-000.000', 'IDR', 30),
('NKO', N'Nippon Kasual Contoh Co.', 'ASING', 'JP', N'Kontak NKO', '+81000000001', 'order@nko.local', N'1-1 Contoh-cho', N'Tokyo', NULL, 'USD', 45),
('AMR', N'American Wear Contoh Inc.', 'ASING', 'US', N'Kontak AMR', '+10000000001', 'order@amr.local', N'1 Contoh Street', N'New York', NULL, 'USD', 60);
GO

-- barang (kode dibuat fn_next_item_code)
INSERT INTO garment.items (item_code, buyer_id, type_code, item_name, buyer_style_name, buyer_style_code, base_price)
SELECT garment.fn_next_item_code(id, 'KS'), id, 'KS', N'Kaos Basic', N'Basic Tee', 'BT-01', 45000
FROM garment.buyers WHERE buyer_code = 'BRT';

INSERT INTO garment.items (item_code, buyer_id, type_code, item_name, buyer_style_name, buyer_style_code, base_price)
SELECT garment.fn_next_item_code(id, 'KM'), id, 'KM', N'Kemeja Kerja', N'Office Shirt', 'OS-01', 95000
FROM garment.buyers WHERE buyer_code = 'BRT';

INSERT INTO garment.items (item_code, buyer_id, type_code, item_name, buyer_style_name, buyer_style_code, base_price)
VALUES (garment.fn_next_item_code(NULL, 'SR'), NULL, 'SR', N'Seragam Kantor', NULL, NULL, 120000);
GO

-- varian: SKU = {item_code}-{ukuran}-{NN}, NN = nomor warna
INSERT INTO garment.item_variants (item_id, sku, size, color, weight_per_pcs_gram)
SELECT i.id, CONCAT(i.item_code, '-', s.size, '-', c.nn), s.size, c.color, c.weight
FROM garment.items i
JOIN (VALUES
(N'Basic Tee', N'Hitam', '01', 180),
(N'Basic Tee', N'Putih', '02', 180),
(N'Office Shirt', N'Biru', '01', 220)
) AS c(style, color, nn, weight) ON c.style = i.buyer_style_name
CROSS JOIN (VALUES ('S'), ('M'), ('L'), ('XL')) AS s(size);
GO

-- order contoh lewat sp_create_order dan sp_change_order_status
-- 1) DOMESTIK, BRT, disetujui Direktur -> DISETUJUI
-- 2) INTERNASIONAL, NKO, barang baru -> MENUNGGU_PERSETUJUAN
DECLARE @mkt UNIQUEIDENTIFIER = (SELECT id FROM garment.employees WHERE full_name = N'Staf Marketing'),
        @dir UNIQUEIDENTIFIER = (SELECT id FROM garment.employees WHERE full_name = N'Direktur'),
        @brt UNIQUEIDENTIFIER = (SELECT id FROM garment.buyers WHERE buyer_code = 'BRT'),
        @nko UNIQUEIDENTIFIER = (SELECT id FROM garment.buyers WHERE buyer_code = 'NKO'),
        @tee UNIQUEIDENTIFIER = (SELECT id FROM garment.items WHERE buyer_style_name = N'Basic Tee'),
        @shirt UNIQUEIDENTIFIER = (SELECT id FROM garment.items WHERE buyer_style_name = N'Office Shirt'),
        @payload NVARCHAR(MAX), @order_id UNIQUEIDENTIFIER, @order_code CHAR(12),
        @r VARCHAR(20), @err NVARCHAR(200);

SET @payload = CONCAT(N'{"buyer_id":"', @brt, N'","level_code":"DOMESTIK",',
    N'"deadline":"', CONVERT(CHAR(10), DATEADD(DAY, 45, CAST(SYSDATETIME() AS DATE)), 23), N'",',
    N'"scheme":"FOB","reject_limit_pct":3,',
    N'"late_penalty":"Denda 1% per hari keterlambatan, maksimal 10% dari nilai order",',
    N'"buyer_po_no":"PO-BRT-0001","styles":[',
    N'{"item_id":"', @tee, N'","color":"Hitam","unit_price":45000,"discount_pct":0,',
    N'"sizes":[{"size":"S","qty":100},{"size":"M","qty":150},{"size":"L","qty":150},{"size":"XL","qty":100}]},',
    N'{"item_id":"', @tee, N'","color":"Putih","unit_price":45000,"discount_pct":5,',
    N'"sizes":[{"size":"M","qty":100},{"size":"L","qty":100}]},',
    N'{"item_id":"', @shirt, N'","color":"Biru","unit_price":95000,"discount_pct":0,',
    N'"sizes":[{"size":"M","qty":80},{"size":"L","qty":80},{"size":"XL","qty":40}]}]}');

EXEC garment.sp_create_order @employee_id = @mkt, @payload = @payload,
     @order_id = @order_id OUTPUT, @order_code = @order_code OUTPUT, @result = @r OUTPUT;
IF @r <> 'SUCCESS' BEGIN SET @err = CONCAT(N'Seed order 1 gagal: ', @r); THROW 50099, @err, 1; END;

EXEC garment.sp_change_order_status @order_id = @order_id, @action = 'APPROVE', @employee_id = @dir, @result = @r OUTPUT;
IF @r <> 'SUCCESS' BEGIN SET @err = CONCAT(N'Persetujuan order 1 gagal: ', @r); THROW 50099, @err, 1; END;

SET @payload = CONCAT(N'{"buyer_id":"', @nko, N'","level_code":"INTERNASIONAL",',
    N'"deadline":"', CONVERT(CHAR(10), DATEADD(DAY, 75, CAST(SYSDATETIME() AS DATE)), 23), N'",',
    N'"scheme":"FOB","reject_limit_pct":2,',
    N'"late_penalty":"Penalty 0.5% per day of delay, maximum 5% of order value",',
    N'"buyer_po_no":"NKO-2026-017","currency":"USD","exchange_rate":16000,"incoterm":"FOB",',
    N'"destination_country":"JP","destination_port":"Tokyo","styles":[',
    N'{"item_id":null,"type_code":"PL","item_name":"Kaos Polo Ekspor","buyer_style_name":"Classic Polo",',
    N'"buyer_style_code":"CP-26","color":"Navy","unit_price":6.50,"discount_pct":0,',
    N'"sizes":[{"size":"S","qty":300},{"size":"M","qty":400},{"size":"L","qty":300}]}]}');

EXEC garment.sp_create_order @employee_id = @mkt, @payload = @payload,
     @order_id = @order_id OUTPUT, @order_code = @order_code OUTPUT, @result = @r OUTPUT;
IF @r <> 'SUCCESS' BEGIN SET @err = CONCAT(N'Seed order 2 gagal: ', @r); THROW 50099, @err, 1; END;
GO

-- jenis pajak (akun dari 90-seed-core.sql); nama 'PPN' dipakai sp_issue_invoice
INSERT INTO garment.tax_types (tax_name, rate_pct, valid_from, account_code) VALUES
(N'PPN', 11, '2025-01-01', '2-2100'),
(N'PPh 21', 5, '2025-01-01', '2-2200'),
(N'PPh 22 Impor', 2.5, '2025-01-01', '1-4200');
GO
