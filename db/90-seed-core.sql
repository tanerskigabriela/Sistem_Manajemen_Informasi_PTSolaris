USE solaris_db;
GO

SET NOCOUNT ON;
GO

-- ---------------------------------------------------------------------------
-- Pabrik
-- ---------------------------------------------------------------------------
INSERT INTO garment.factories (factory_name, address, city, province, phone, email, bonded_zone_status, operating_status)
VALUES (N'PT Solaris Garment', N'Jl. Industri No. 1', N'Kota Contoh', N'Provinsi Contoh',
        '0210000001', 'info@solaris.local', 0, 'AKTIF');
GO

-- ---------------------------------------------------------------------------
-- Negara (kode ISO 3166-1 alpha-2)
-- ---------------------------------------------------------------------------
INSERT INTO garment.countries (country_code, country_name) VALUES
('ID', N'Indonesia'),   ('US', N'Amerika Serikat'), ('CN', N'Tiongkok'),
('JP', N'Jepang'),      ('KR', N'Korea Selatan'),   ('SG', N'Singapura'),
('MY', N'Malaysia'),    ('IN', N'India'),           ('VN', N'Vietnam'),
('BD', N'Bangladesh'),  ('DE', N'Jerman'),          ('GB', N'Britania Raya'),
('NL', N'Belanda'),     ('AU', N'Australia'),       ('TR', N'Turki');
GO

-- ---------------------------------------------------------------------------
-- Tahap produksi (urutan tetap 1-6)
-- ---------------------------------------------------------------------------
INSERT INTO garment.production_stages (stage_code, stage_name, [sequence]) VALUES
('CUTTING',   N'Cutting',   1),
('SEWING',    N'Sewing',    2),
('TRIMMING',  N'Trimming',  3),
('FINISHING', N'Finishing', 4),
('IRONING',   N'Ironing',   5),
('PACKING',   N'Packing',   6);
GO

-- ---------------------------------------------------------------------------
-- Divisi (kepala divisi diisi setelah karyawan ada)
-- ---------------------------------------------------------------------------
INSERT INTO garment.divisions (factory_id, division_name)
SELECT f.id, v.n
FROM   garment.factories f
CROSS JOIN (VALUES (N'Sistem Informasi'), (N'IT'), (N'Manajemen'), (N'Marketing'),
                   (N'PPIC'), (N'Produksi'), (N'QC')) AS v(n)
WHERE  f.factory_name = N'PT Solaris Garment';
GO

-- ---------------------------------------------------------------------------
-- Jabatan dan shift
-- ---------------------------------------------------------------------------
INSERT INTO garment.positions (position_name, position_level, base_salary_min, base_salary_max) VALUES
(N'Direktur',              1, 20000000, 40000000),
(N'Supervisor',            3,  6000000,  9000000),
(N'Staf Sistem Informasi', 4,  5000000,  9000000),
(N'Staf IT',               4,  5000000,  9000000),
(N'Staf Marketing',        4,  4500000,  8000000),
(N'Staf PPIC',             4,  4500000,  8000000),
(N'Staf QC',               4,  4500000,  8000000);
GO

INSERT INTO garment.shifts (shift_name, start_time, end_time) VALUES
(N'Kantor', '08:00', '16:00'),
(N'Pagi',   '07:00', '15:00');
GO

-- ---------------------------------------------------------------------------
-- 7 karyawan seed (nama mengikuti kolom "Karyawan seed" KONTRAK Bagian 12)
-- ---------------------------------------------------------------------------
INSERT INTO garment.employees
    (nik, full_name, birth_date, gender, employee_type, address, phone, email,
     factory_id, division_id, position_id, shift_id, join_date)
SELECT  v.nik, v.full_name, CAST(v.birth_date AS DATE), v.gender, 'TETAP',
        N'Alamat contoh', v.phone, v.email,
        f.id, d.id, p.id, s.id, CAST(v.join_date AS DATE)
FROM (VALUES
  ('3300000000000001', N'Staf Sistem Informasi', '1995-03-10', 'L', '081200000001', 'si@solaris.local',        N'Sistem Informasi', N'Staf Sistem Informasi', N'Kantor', '2024-01-02'),
  ('3300000000000002', N'Staf IT',               '1996-06-21', 'P', '081200000002', 'it@solaris.local',        N'IT',               N'Staf IT',               N'Kantor', '2024-01-02'),
  ('3300000000000003', N'Direktur',              '1980-11-05', 'L', '081200000003', 'direktur@solaris.local',  N'Manajemen',        N'Direktur',              N'Kantor', '2020-01-06'),
  ('3300000000000004', N'Staf Marketing',        '1994-02-14', 'P', '081200000004', 'marketing@solaris.local', N'Marketing',        N'Staf Marketing',        N'Kantor', '2023-03-01'),
  ('3300000000000005', N'Staf PPIC',             '1993-09-30', 'L', '081200000005', 'ppic@solaris.local',      N'PPIC',             N'Staf PPIC',             N'Kantor', '2022-07-04'),
  ('3300000000000006', N'Supervisor Lini 1',     '1990-12-12', 'L', '081200000006', 'spv1@solaris.local',      N'Produksi',         N'Supervisor',            N'Pagi',   '2021-05-03'),
  ('3300000000000007', N'Staf QC',               '1997-01-25', 'P', '081200000007', 'qc@solaris.local',        N'QC',               N'Staf QC',               N'Pagi',   '2023-08-07')
) AS v(nik, full_name, birth_date, gender, phone, email, division_name, position_name, shift_name, join_date)
JOIN garment.factories f ON f.factory_name = N'PT Solaris Garment'
JOIN garment.divisions d ON d.factory_id = f.id AND d.division_name = v.division_name
JOIN garment.positions p ON p.position_name = v.position_name
JOIN garment.shifts    s ON s.shift_name = v.shift_name;
GO

-- Kepala divisi (relasi 1:1)
UPDATE d
SET    d.head_employee_id = e.id
FROM   garment.divisions d
JOIN  (VALUES (N'Sistem Informasi', N'Staf Sistem Informasi'),
              (N'IT',               N'Staf IT'),
              (N'Manajemen',        N'Direktur'),
              (N'Marketing',        N'Staf Marketing'),
              (N'PPIC',             N'Staf PPIC'),
              (N'Produksi',         N'Supervisor Lini 1'),
              (N'QC',               N'Staf QC')) AS m(division_name, full_name)
       ON m.division_name = d.division_name
JOIN   garment.employees e ON e.full_name = m.full_name;
GO

-- Kontrak kerja aktif (dasar gaji untuk sp_process_payroll)
INSERT INTO garment.employment_contracts
    (employee_id, contract_seq, contract_type, contract_document_no, base_salary, start_date, finish_date, status)
SELECT  e.id, 1, 'PKWTT', v.doc_no, v.salary, e.join_date, NULL, 'AKTIF'
FROM   (VALUES (N'Staf Sistem Informasi', 'PKWTT/2024/001',  7000000),
               (N'Staf IT',               'PKWTT/2024/002',  7000000),
               (N'Direktur',              'PKWTT/2020/001', 30000000),
               (N'Staf Marketing',        'PKWTT/2023/001',  6000000),
               (N'Staf PPIC',             'PKWTT/2022/001',  6000000),
               (N'Supervisor Lini 1',     'PKWTT/2021/001',  7500000),
               (N'Staf QC',               'PKWTT/2023/002',  5500000)) AS v(full_name, doc_no, salary)
JOIN   garment.employees e ON e.full_name = v.full_name;
GO

-- ---------------------------------------------------------------------------
-- Gudang dan rak (1 gudang barang jadi, 1 gudang bahan; kepala = Staf PPIC)
-- ---------------------------------------------------------------------------
INSERT INTO garment.warehouses (factory_id, head_employee_id, warehouse_name, warehouse_type, address, capacity_m3)
SELECT  f.id, e.id, v.n, v.t, N'Jl. Industri No. 1', v.cap
FROM    garment.factories f
JOIN    garment.employees e ON e.full_name = N'Staf PPIC'
CROSS JOIN (VALUES (N'Gudang Barang Jadi', 'BARANG_JADI', 500.00),
                   (N'Gudang Bahan',       'BAHAN',       800.00)) AS v(n, t, cap)
WHERE   f.factory_name = N'PT Solaris Garment';
GO

INSERT INTO garment.rack_locations (warehouse_id, rack_code, capacity)
SELECT  w.id, v.code, 500
FROM    garment.warehouses w
JOIN   (VALUES (N'Gudang Barang Jadi', 'FG-A01'), (N'Gudang Barang Jadi', 'FG-A02'),
               (N'Gudang Barang Jadi', 'FG-A03'), (N'Gudang Barang Jadi', 'FG-A04'),
               (N'Gudang Bahan',       'RM-A01'), (N'Gudang Bahan',       'RM-A02'),
               (N'Gudang Bahan',       'RM-A03'), (N'Gudang Bahan',       'RM-A04')) AS v(wh, code)
        ON v.wh = w.warehouse_name;
GO

-- ---------------------------------------------------------------------------
-- Role (7) dan akun demo (7)
-- ---------------------------------------------------------------------------
INSERT INTO app.roles (role_code, role_name, access_tier) VALUES
('SUPERADMIN', N'Super Admin',          'SUPERADMIN'),
('ADMIN',      N'Administrator Sistem', 'ADMIN'),
('PIMPINAN',   N'Pimpinan',             'ADMIN'),
('MARKETING',  N'Marketing',            'USER'),
('PPIC',       N'PPIC',                 'USER'),
('SPV',        N'Supervisor',           'USER'),
('QC',         N'Quality Control',      'USER');
GO

INSERT INTO app.users (employee_id, username, password_hash, role_code)
SELECT  e.id, v.username, v.pw, v.role_code
FROM   (VALUES
  ('superadmin',    '$2b$10$Txs0ZggxkAt7qUalLJd12OACDVCM6oTB4lbRwtnlTsXmJTc/t6GD2', 'SUPERADMIN', N'Staf Sistem Informasi'),
  ('admin.solaris', '$2b$10$5P3Ls1/FfvRE/mDgV.XDaeBO6nBZc2zaTptqhh2qhZl55LKdm6DfK', 'ADMIN',      N'Staf IT'),
  ('pimpinan',      '$2b$10$o2DGRE1GzHCAjyve35Z7xOY0oNPy/ctrRi3wafPISjfFuuYB1dbli', 'PIMPINAN',   N'Direktur'),
  ('marketing',     '$2b$10$WxfZSLmvEfj0ag08lun11eC/v7S5aJEjTqbJ.9BPEFHxhFGaihw16', 'MARKETING',  N'Staf Marketing'),
  ('ppic',          '$2b$10$DCpfC/ZK/w66J1Iqbyfq1.LtllfcDRoV0utodIdLAi6Or5JpY0hwK', 'PPIC',       N'Staf PPIC'),
  ('supervisor',    '$2b$10$7kB6.JacLSkzS0/OGBEAreEqjLXel0Vb73.4RY27OWNPEMYlCs966', 'SPV',        N'Supervisor Lini 1'),
  ('qc.solaris',    '$2b$10$47Z/quSkglX1g6BebvZoSOSXC37BOony3aX7cJQ.TTsYQ1NeFhw76', 'QC',         N'Staf QC')
) AS v(username, pw, role_code, full_name)
JOIN   garment.employees e ON e.full_name = v.full_name;
GO

-- ---------------------------------------------------------------------------
-- Bagan akun (COA). Kode dipakai B (tax_types.account_code) dan C:
--   1-1200 Bank | 1-2100 Piutang Usaha | 1-3100 Persediaan Bahan | 1-3200 Persediaan Barang Jadi
--   1-4100 PPN Masukan | 2-1100 Utang Usaha | 2-2100 PPN Keluaran | 2-2200 Utang PPh 21
--   2-3100 Utang Gaji | 2-4100 Uang Muka Pelanggan | 4-1100 Penjualan | 4-1200 Jasa CMT
-- ---------------------------------------------------------------------------
INSERT INTO garment.accounts (account_code, parent_code, account_name, account_type) VALUES
-- Induk (header)
('1-0000', NULL,     N'Aset',                        'ASET'),
('2-0000', NULL,     N'Kewajiban',                   'KEWAJIBAN'),
('3-0000', NULL,     N'Ekuitas',                     'EKUITAS'),
('4-0000', NULL,     N'Pendapatan',                  'PENDAPATAN'),
('5-0000', NULL,     N'Beban',                       'BEBAN'),
-- Kelompok
('1-1000', '1-0000', N'Kas dan Bank',                'ASET'),
('1-2000', '1-0000', N'Piutang',                     'ASET'),
('1-3000', '1-0000', N'Persediaan',                  'ASET'),
('1-4000', '1-0000', N'Pajak Dibayar di Muka',       'ASET'),
('1-5000', '1-0000', N'Aset Tetap',                  'ASET'),
('2-1000', '2-0000', N'Utang Usaha',                 'KEWAJIBAN'),
('2-2000', '2-0000', N'Utang Pajak',                 'KEWAJIBAN'),
('2-3000', '2-0000', N'Utang Gaji',                  'KEWAJIBAN'),
('2-4000', '2-0000', N'Uang Muka Pelanggan',         'KEWAJIBAN'),
('3-1000', '3-0000', N'Modal',                       'EKUITAS'),
('4-1000', '4-0000', N'Pendapatan Usaha',            'PENDAPATAN'),
('4-2000', '4-0000', N'Pendapatan Lain-lain',        'PENDAPATAN'),
('5-1000', '5-0000', N'Harga Pokok Produksi',        'BEBAN'),
('5-2000', '5-0000', N'Beban Karyawan',              'BEBAN'),
('5-3000', '5-0000', N'Beban Pengiriman',            'BEBAN'),
('5-4000', '5-0000', N'Beban Operasional',           'BEBAN');
GO

INSERT INTO garment.accounts (account_code, parent_code, account_name, account_type) VALUES
('1-1100', '1-1000', N'Kas',                           'ASET'),
('1-1200', '1-1000', N'Bank',                          'ASET'),
('1-2100', '1-2000', N'Piutang Usaha',                 'ASET'),
('1-3100', '1-3000', N'Persediaan Bahan Baku',         'ASET'),
('1-3200', '1-3000', N'Persediaan Barang Jadi',        'ASET'),
('1-4100', '1-4000', N'PPN Masukan',                   'ASET'),
('1-4200', '1-4000', N'PPh 22 Dibayar di Muka',        'ASET'),
('1-5100', '1-5000', N'Mesin dan Peralatan',           'ASET'),
('2-1100', '2-1000', N'Utang Usaha',                   'KEWAJIBAN'),
('2-2100', '2-2000', N'PPN Keluaran',                  'KEWAJIBAN'),
('2-2200', '2-2000', N'Utang PPh 21',                  'KEWAJIBAN'),
('2-3100', '2-3000', N'Utang Gaji',                    'KEWAJIBAN'),
('2-4100', '2-4000', N'Uang Muka (DP) Pelanggan',      'KEWAJIBAN'),
('3-1100', '3-1000', N'Modal Disetor',                 'EKUITAS'),
('3-1200', '3-1000', N'Laba Ditahan',                  'EKUITAS'),
('4-1100', '4-1000', N'Penjualan Barang (FOB)',        'PENDAPATAN'),
('4-1200', '4-1000', N'Pendapatan Jasa Produksi (CMT)','PENDAPATAN'),
('4-2100', '4-2000', N'Pendapatan Denda Pembatalan',   'PENDAPATAN'),
('5-1100', '5-1000', N'Beban Bahan Baku',              'BEBAN'),
('5-2100', '5-2000', N'Beban Gaji dan Upah',           'BEBAN'),
('5-2200', '5-2000', N'Beban BPJS',                    'BEBAN'),
('5-3100', '5-3000', N'Beban Ekspedisi',               'BEBAN'),
('5-4100', '5-4000', N'Beban Perawatan Mesin',         'BEBAN');
GO

-- ---------------------------------------------------------------------------
-- Rekening perusahaan (nomor rekening contoh)
-- ---------------------------------------------------------------------------
INSERT INTO garment.company_bank_accounts (factory_id, account_code, bank_name, account_no, currency)
SELECT  f.id, '1-1200', v.bank, v.no, v.cur
FROM    garment.factories f
CROSS JOIN (VALUES (N'Bank Contoh', '0000000001', 'IDR'),
                   (N'Bank Contoh', '0000000002', 'USD')) AS v(bank, no, cur)
WHERE   f.factory_name = N'PT Solaris Garment';
GO
