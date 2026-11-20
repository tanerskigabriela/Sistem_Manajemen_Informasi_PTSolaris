USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'app_rsi')
    CREATE LOGIN app_rsi WITH PASSWORD = N'Rsi#Solaris2026!', CHECK_POLICY = ON, DEFAULT_DATABASE = solaris_db;
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'app_smbd')
    CREATE LOGIN app_smbd WITH PASSWORD = N'Smbd#Solaris2026!', CHECK_POLICY = ON, DEFAULT_DATABASE = solaris_db;
GO

USE solaris_db;
GO

CREATE USER app_rsi  FOR LOGIN app_rsi  WITH DEFAULT_SCHEMA = garment;
CREATE USER app_smbd FOR LOGIN app_smbd WITH DEFAULT_SCHEMA = garment;
GO

-- =============================================================================
-- app_rsi: dipakai backend saat role RSI login DAN untuk semua proses login
-- =============================================================================

-- Schema app (hak tabel satu per satu)
GRANT SELECT                  ON app.roles                    TO app_rsi;
GRANT SELECT, INSERT, UPDATE  ON app.users                    TO app_rsi;   -- buat akun, reset/ganti password, kunci, last_login_at
GRANT SELECT, INSERT, UPDATE  ON app.sessions                 TO app_rsi;   -- login, last_activity_at, logout, akhiri sesi
GRANT SELECT, INSERT          ON app.activity_logs            TO app_rsi;   -- tulis log, halaman Log Aktivitas
GRANT SELECT, INSERT, UPDATE  ON app.password_reset_requests  TO app_rsi;
GRANT SELECT, INSERT, UPDATE  ON app.notifications            TO app_rsi;
GRANT SELECT ON app.v_login_history   TO app_rsi;                            -- FSD-2.19
GRANT SELECT ON app.v_active_sessions TO app_rsi;                            -- FSD-2.22
GRANT EXECUTE ON SCHEMA::app TO app_rsi;                                     -- SP/function milik A

-- Schema garment: baca/tambah/ubah + jalankan SP RSI. Tidak ada hak hapus.
GRANT SELECT, INSERT, UPDATE ON SCHEMA::garment TO app_rsi;
GRANT EXECUTE                ON SCHEMA::garment TO app_rsi;

-- Data SDM dan akuntansi milik A tidak dipakai halaman RSI. SP milik schema yang
-- sama tetap bisa membacanya lewat ownership chaining.
DENY SELECT, INSERT, UPDATE ON garment.payrolls              TO app_rsi;
DENY SELECT, INSERT, UPDATE ON garment.journals              TO app_rsi;
DENY SELECT, INSERT, UPDATE ON garment.journal_lines         TO app_rsi;
DENY SELECT, INSERT, UPDATE ON garment.company_bank_accounts TO app_rsi;
DENY SELECT, INSERT, UPDATE ON garment.employment_contracts  TO app_rsi;
DENY SELECT, INSERT, UPDATE ON garment.attendances           TO app_rsi;
DENY SELECT, INSERT, UPDATE ON garment.interns               TO app_rsi;
DENY EXECUTE ON OBJECT::garment.sp_post_journal    TO app_rsi;
DENY EXECUTE ON OBJECT::garment.sp_process_payroll TO app_rsi;

-- RB-67: tidak ada penghapusan data dari RSI
DENY DELETE ON SCHEMA::app     TO app_rsi;
DENY DELETE ON SCHEMA::garment TO app_rsi;
GO

-- =============================================================================
-- app_smbd: dipakai backend saat SUPERADMIN login
-- =============================================================================

-- Schema app: hak sama dengan app_rsi (SUPERADMIN tetap lewat authenticate, logout,
-- ganti password, dan logActivity dalam withTransaction yang harus satu login).
GRANT SELECT                  ON app.roles                    TO app_smbd;
GRANT SELECT, INSERT, UPDATE  ON app.users                    TO app_smbd;
GRANT SELECT, INSERT, UPDATE  ON app.sessions                 TO app_smbd;
GRANT SELECT, INSERT          ON app.activity_logs            TO app_smbd;
GRANT SELECT, INSERT, UPDATE  ON app.password_reset_requests  TO app_smbd;
GRANT SELECT, INSERT, UPDATE  ON app.notifications            TO app_smbd;
GRANT SELECT ON app.v_login_history   TO app_smbd;
GRANT SELECT ON app.v_active_sessions TO app_smbd;
GRANT EXECUTE ON SCHEMA::app TO app_smbd;
DENY DELETE ON SCHEMA::app TO app_smbd;

-- Schema garment: baca/tambah/ubah semua tabel, jalankan semua SP.
GRANT SELECT, INSERT, UPDATE ON SCHEMA::garment TO app_smbd;
GRANT EXECUTE                ON SCHEMA::garment TO app_smbd;
GO

-- Hapus data hanya boleh di tabel master/konfigurasi (CRUD halaman SMBD).
-- Tabel transaksi dikunci dengan DENY DELETE.
DECLARE @sql NVARCHAR(MAX);

SET @sql = (SELECT STRING_AGG(CAST('GRANT DELETE ON garment.' + QUOTENAME(t.n) + ' TO app_smbd;' AS NVARCHAR(MAX)), CHAR(10))
            FROM (VALUES (N'production_lines'), (N'qc_standards'), (N'defect_types'), (N'raw_materials'),
                         (N'bom'), (N'order_levels'), (N'order_level_payment_methods'),
                         (N'cancellation_policies'), (N'expeditions'), (N'expedition_transport_modes'),
                         (N'equipment'), (N'maintenances'), (N'interns'), (N'employee_skills')) AS t(n));
EXEC sys.sp_executesql @sql;

SET @sql = (SELECT STRING_AGG(CAST('DENY DELETE ON garment.' + QUOTENAME(t.n) + ' TO app_smbd;' AS NVARCHAR(MAX)), CHAR(10))
            FROM (VALUES (N'orders'), (N'order_status_history'), (N'order_details'), (N'order_detail_sizes'),
                         (N'order_cancellations'), (N'shipments'), (N'shipment_items'), (N'shipment_trackings'),
                         (N'export_documents'), (N'spk'), (N'spk_sizes'), (N'production_progress'),
                         (N'order_materials'), (N'material_usages'), (N'purchase_orders'), (N'purchase_order_items'),
                         (N'material_receipts'), (N'material_receipt_items'), (N'import_documents'),
                         (N'qc_results'), (N'qc_defects'), (N'stock_movements'), (N'stock_counts'),
                         (N'sales_invoices'), (N'supplier_bills'), (N'payments'), (N'taxes'),
                         (N'journals'), (N'journal_lines'), (N'payrolls'), (N'attendances'),
                         (N'employment_contracts')) AS t(n));
EXEC sys.sp_executesql @sql;
GO

-- =============================================================================
-- Role database demo SMBD (hak per tabel dan per kolom, diuji lewat EXECUTE AS USER)
-- =============================================================================
CREATE ROLE rl_keuangan;
CREATE ROLE rl_gudang;
CREATE ROLE rl_hrd;
GO

-- rl_keuangan: lihat akuntansi dan penjualan, posting jurnal lewat SP.
-- Data karyawan hanya kolom yang perlu untuk pembayaran gaji.
GRANT SELECT ON garment.accounts              TO rl_keuangan;
GRANT SELECT ON garment.company_bank_accounts TO rl_keuangan;
GRANT SELECT ON garment.journals              TO rl_keuangan;
GRANT SELECT ON garment.journal_lines         TO rl_keuangan;
GRANT SELECT ON garment.sales_invoices        TO rl_keuangan;
GRANT SELECT ON garment.supplier_bills        TO rl_keuangan;
GRANT SELECT ON garment.payments              TO rl_keuangan;
GRANT SELECT ON garment.tax_types             TO rl_keuangan;
GRANT SELECT ON garment.taxes                 TO rl_keuangan;
GRANT SELECT (id, full_name, npwp, bank_name, account_no) ON garment.employees TO rl_keuangan;
GRANT EXECUTE ON OBJECT::garment.sp_post_journal TO rl_keuangan;
DENY  SELECT ON garment.payrolls TO rl_keuangan;

-- rl_gudang: kelola stok dan lokasi. Karyawan hanya kolom non-sensitif.
GRANT SELECT, INSERT, UPDATE ON garment.material_stocks  TO rl_gudang;
GRANT SELECT, INSERT, UPDATE ON garment.product_stocks   TO rl_gudang;
GRANT SELECT, INSERT, UPDATE ON garment.stock_movements  TO rl_gudang;
GRANT SELECT, INSERT, UPDATE ON garment.stock_counts     TO rl_gudang;
GRANT SELECT ON garment.warehouses     TO rl_gudang;
GRANT SELECT ON garment.rack_locations TO rl_gudang;
GRANT SELECT (id, full_name, factory_id, division_id, position_id) ON garment.employees TO rl_gudang;
DENY  SELECT ON garment.payrolls TO rl_gudang;

-- rl_hrd: boleh melihat dan mengelola data SDM termasuk gaji.
GRANT SELECT, INSERT, UPDATE ON garment.employees            TO rl_hrd;
GRANT SELECT, INSERT, UPDATE ON garment.employment_contracts TO rl_hrd;
GRANT SELECT, INSERT, UPDATE ON garment.interns              TO rl_hrd;
GRANT SELECT, INSERT, UPDATE ON garment.attendances          TO rl_hrd;
GRANT SELECT, INSERT, UPDATE ON garment.payrolls             TO rl_hrd;
GRANT SELECT, INSERT, UPDATE ON garment.employee_skills      TO rl_hrd;
GRANT SELECT, INSERT, UPDATE ON garment.skills               TO rl_hrd;
GRANT SELECT ON garment.divisions TO rl_hrd;
GRANT SELECT ON garment.positions TO rl_hrd;
GRANT SELECT ON garment.shifts    TO rl_hrd;
GRANT EXECUTE ON OBJECT::garment.sp_process_payroll TO rl_hrd;

-- Semua role boleh melihat direktori karyawan (tanpa gaji dan rekening).
GRANT SELECT ON garment.v_employee_directory TO rl_keuangan, rl_gudang, rl_hrd;
GO

-- User tanpa login untuk demo di SSMS:
--   EXECUTE AS USER = 'demo_keuangan'; SELECT * FROM garment.payrolls; REVERT;  -- ditolak
CREATE USER demo_keuangan WITHOUT LOGIN;
CREATE USER demo_gudang   WITHOUT LOGIN;
CREATE USER demo_hrd      WITHOUT LOGIN;
ALTER ROLE rl_keuangan ADD MEMBER demo_keuangan;
ALTER ROLE rl_gudang   ADD MEMBER demo_gudang;
ALTER ROLE rl_hrd      ADD MEMBER demo_hrd;
GO
