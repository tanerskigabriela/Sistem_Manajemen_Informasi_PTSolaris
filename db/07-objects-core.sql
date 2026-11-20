USE solaris_db;
GO

-- =============================================================================
-- FUNCTION
-- =============================================================================

-- Mengambil employee_id dari akun login (dipakai B dan C untuk kolom *_by, K-11).
CREATE FUNCTION app.fn_employee_of_user (@user_id UNIQUEIDENTIFIER)
RETURNS UNIQUEIDENTIFIER
AS
BEGIN
    RETURN (SELECT employee_id FROM app.users WHERE id = @user_id);
END
GO

-- Nomor dokumen berikutnya: <PREFIX>-<TTBB>-<NNN>
--   TT = 2 digit tahun, BB = 2 digit bulan dari @at, NNN = urutan per bulan (001-999).
--   Contoh: app.fn_next_doc_no('SPK', '2026-11-20') -> 'SPK-2611-001'
-- Prefix: ORD, SPK, SJ, PO, INV, JU. Prefix lain atau urutan > 999 -> NULL.
-- Function tidak bisa mengunci tabel. Dua transaksi serentak bisa mendapat nomor
-- yang sama; kolom UNIQUE akan menolak yang kedua, jadi service wajib mencoba ulang.
CREATE FUNCTION app.fn_next_doc_no (@prefix VARCHAR(5), @at DATE)
RETURNS VARCHAR(12)
AS
BEGIN
    DECLARE @yymm CHAR(4) =
        RIGHT(CAST(YEAR(@at) AS VARCHAR(4)), 2) + RIGHT('0' + CAST(MONTH(@at) AS VARCHAR(2)), 2);
    DECLARE @like VARCHAR(20) = @prefix + '-' + @yymm + '-%';
    DECLARE @max  INT;

    SET @max = CASE @prefix
        WHEN 'ORD' THEN (SELECT MAX(CAST(RIGHT(order_code, 3)       AS INT)) FROM garment.orders          WHERE order_code       LIKE @like)
        WHEN 'SPK' THEN (SELECT MAX(CAST(RIGHT(spk_no, 3)           AS INT)) FROM garment.spk             WHERE spk_no           LIKE @like)
        WHEN 'SJ'  THEN (SELECT MAX(CAST(RIGHT(delivery_note_no, 3) AS INT)) FROM garment.shipments       WHERE delivery_note_no LIKE @like)
        WHEN 'PO'  THEN (SELECT MAX(CAST(RIGHT(po_no, 3)            AS INT)) FROM garment.purchase_orders WHERE po_no            LIKE @like)
        WHEN 'INV' THEN (SELECT MAX(CAST(RIGHT(invoice_no, 3)       AS INT)) FROM garment.sales_invoices  WHERE invoice_no       LIKE @like)
        WHEN 'JU'  THEN (SELECT MAX(CAST(RIGHT(journal_no, 3)       AS INT)) FROM garment.journals        WHERE journal_no       LIKE @like)
        ELSE -1
    END;

    IF @max = -1 RETURN NULL;                 -- prefix tidak dikenal
    SET @max = ISNULL(@max, 0) + 1;
    IF @max > 999 RETURN NULL;                -- melebihi lebar NNN

    RETURN @prefix + '-' + @yymm + '-' + RIGHT('00' + CAST(@max AS VARCHAR(3)), 3);
END
GO

-- =============================================================================
-- VIEW
-- =============================================================================

CREATE VIEW app.v_active_sessions
AS
SELECT  s.id            AS session_id,
        u.id            AS user_id,
        u.username,
        e.full_name,
        u.role_code,
        s.device,
        s.ip_address,
        s.login_at,
        s.last_activity_at
FROM    app.sessions s
JOIN    app.users u     ON u.id = s.user_id
JOIN    garment.employees e ON e.id = u.employee_id
WHERE   s.status = 'AKTIF';
GO

CREATE VIEW app.v_login_history
AS
SELECT  l.id,
        l.created_at,
        l.username,
        l.user_id,
        e.full_name,
        l.action_type,
        l.device,
        l.ip_address
FROM    app.activity_logs l
LEFT JOIN app.users u        ON u.id = l.user_id
LEFT JOIN garment.employees e ON e.id = u.employee_id
WHERE   l.action_type IN ('LOGIN_BERHASIL', 'LOGIN_GAGAL', 'LOGOUT', 'SESI_BERAKHIR',
                          'SESI_DIAKHIRI', 'AKUN_TERKUNCI', 'BUKA_KUNCI');
GO

-- Direktori karyawan tanpa gaji dan rekening (juga tanpa NIK, NPWP, BPJS, alamat).
CREATE VIEW garment.v_employee_directory
AS
SELECT  e.id,
        e.full_name,
        e.gender,
        e.employee_type,
        e.phone,
        e.email,
        e.factory_id,
        f.factory_name,
        d.division_name,
        p.position_name,
        sh.shift_name,
        e.is_active,
        e.join_date
FROM    garment.employees e
JOIN    garment.factories f  ON f.id = e.factory_id
JOIN    garment.divisions d  ON d.id = e.division_id
JOIN    garment.positions p  ON p.id = e.position_id
LEFT JOIN garment.shifts sh  ON sh.id = e.shift_id;
GO

-- =============================================================================
-- STORED PROCEDURE
-- =============================================================================

-- Notifikasi (N-01 .. N-11). Bila dedup_key sudah ada untuk penerima, tidak membuat baris baru.
CREATE PROCEDURE app.sp_create_notification
    @recipient_id UNIQUEIDENTIFIER,
    @event_code   CHAR(4),
    @message      NVARCHAR(300),
    @link         VARCHAR(200) = NULL,
    @dedup_key    VARCHAR(80)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @dedup_key IS NOT NULL
       AND EXISTS (SELECT 1 FROM app.notifications
                   WHERE recipient_id = @recipient_id AND dedup_key = @dedup_key)
        RETURN;

    INSERT INTO app.notifications (recipient_id, event_code, message, link, dedup_key)
    VALUES (@recipient_id, @event_code, @message, @link, @dedup_key);
END
GO

-- Mencatat hasil percobaan login. Password sudah diperiksa backend (bcrypt) sebelum
-- SP ini dipanggil; backend mengirim hasilnya lewat @success.
--   @success = 1 : reset hitungan gagal, isi last_login_at, buat sesi, catat LOGIN_BERHASIL.
--   @success = 0 : tambah failed_login_count, kunci akun pada kegagalan ke-5
--                  (catat LOGIN_GAGAL dan AKUN_TERKUNCI). Username tak dikenal tetap dicatat.
-- Output: @session_id (sesi baru bila berhasil), @is_locked (akun terkunci setelah panggilan ini).
CREATE PROCEDURE app.sp_record_login
    @username    VARCHAR(50),
    @success     BIT,
    @device      NVARCHAR(150) = NULL,
    @ip_address  VARCHAR(45)   = NULL,
    @session_id  UNIQUEIDENTIFIER = NULL OUTPUT,
    @is_locked   BIT = 0 OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @own_tran  BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @user_id   UNIQUEIDENTIFIER, @failed TINYINT, @was_locked BIT, @active BIT;
    DECLARE @new_sess  TABLE (id UNIQUEIDENTIFIER);

    IF @own_tran = 1 BEGIN TRANSACTION;

    SELECT @user_id = id, @failed = failed_login_count, @was_locked = is_locked, @active = is_active
    FROM   app.users WITH (UPDLOCK)
    WHERE  username = @username;

    IF @user_id IS NULL
    BEGIN
        INSERT INTO app.activity_logs (user_id, username, action_type, device, ip_address)
        VALUES (NULL, @username, 'LOGIN_GAGAL', @device, @ip_address);
        SET @is_locked = 0;
    END
    ELSE IF @success = 1
    BEGIN
        IF @was_locked = 1 OR @active = 0
            THROW 51001, 'ERR-AUTH-01: akun terkunci atau nonaktif, login tidak boleh dicatat berhasil.', 1;

        UPDATE app.users
        SET    failed_login_count = 0, last_login_at = SYSDATETIME(), updated_at = SYSDATETIME()
        WHERE  id = @user_id;

        INSERT INTO app.sessions (user_id, device, ip_address)
        OUTPUT inserted.id INTO @new_sess
        VALUES (@user_id, @device, @ip_address);
        SELECT @session_id = id FROM @new_sess;

        INSERT INTO app.activity_logs (user_id, username, action_type, resource_type, resource_id, device, ip_address)
        VALUES (@user_id, @username, 'LOGIN_BERHASIL', 'app.sessions', CAST(@session_id AS VARCHAR(36)), @device, @ip_address);
        SET @is_locked = 0;
    END
    ELSE
    BEGIN
        SET @failed = CASE WHEN @failed < 255 THEN @failed + 1 ELSE @failed END;

        UPDATE app.users
        SET    failed_login_count = @failed,
               is_locked  = CASE WHEN @failed >= 5 THEN 1 ELSE is_locked END,
               updated_at = SYSDATETIME()
        WHERE  id = @user_id;

        INSERT INTO app.activity_logs (user_id, username, action_type, device, ip_address)
        VALUES (@user_id, @username, 'LOGIN_GAGAL', @device, @ip_address);

        IF @failed >= 5 AND @was_locked = 0
            INSERT INTO app.activity_logs (user_id, username, action_type, resource_type, resource_id, device, ip_address)
            VALUES (@user_id, @username, 'AKUN_TERKUNCI', 'app.users', CAST(@user_id AS VARCHAR(36)), @device, @ip_address);

        SET @is_locked = CASE WHEN @failed >= 5 OR @was_locked = 1 THEN 1 ELSE 0 END;
    END

    IF @own_tran = 1 COMMIT TRANSACTION;
END
GO

-- Reset password oleh admin: hash baru (dibuat backend), must_change_password = 1,
-- akun dibuka kuncinya, semua sesi aktif akun itu diakhiri (RESET_PASSWORD),
-- permintaan MENUNGGU (bila ada) ditandai SELESAI, dan RESET_PASSWORD dicatat di log.
CREATE PROCEDURE app.sp_reset_password
    @target_user_id    UNIQUEIDENTIFIER,
    @new_password_hash VARCHAR(100),
    @handled_by        UNIQUEIDENTIFIER,          -- app.users.id admin yang melakukan reset
    @device            NVARCHAR(150) = NULL,
    @ip_address        VARCHAR(45)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @admin_name VARCHAR(50);

    IF NOT EXISTS (SELECT 1 FROM app.users WHERE id = @target_user_id)
        THROW 51010, 'ERR-AUTH-10: akun yang akan direset tidak ditemukan.', 1;

    SELECT @admin_name = username FROM app.users WHERE id = @handled_by;
    IF @admin_name IS NULL
        THROW 51011, 'ERR-AUTH-11: akun pelaksana reset tidak ditemukan.', 1;

    IF @own_tran = 1 BEGIN TRANSACTION;

    UPDATE app.users
    SET    password_hash = @new_password_hash,
           must_change_password = 1,
           is_locked = 0,
           failed_login_count = 0,
           updated_at = SYSDATETIME()
    WHERE  id = @target_user_id;

    UPDATE app.sessions
    SET    status = 'BERAKHIR', end_reason = 'RESET_PASSWORD', ended_at = SYSDATETIME()
    WHERE  user_id = @target_user_id AND status = 'AKTIF';

    UPDATE app.password_reset_requests
    SET    status = 'SELESAI', handled_by = @handled_by, handled_at = SYSDATETIME()
    WHERE  user_id = @target_user_id AND status = 'MENUNGGU';

    INSERT INTO app.activity_logs (user_id, username, action_type, resource_type, resource_id, device, ip_address)
    VALUES (@handled_by, @admin_name, 'RESET_PASSWORD', 'app.users', CAST(@target_user_id AS VARCHAR(36)), @device, @ip_address);

    IF @own_tran = 1 COMMIT TRANSACTION;
END
GO

-- Memposting jurnal umum. @lines berupa JSON:
--   [{"account_code":"1-1200","debit":1000000,"credit":0},
--    {"account_code":"4-1000","debit":0,"credit":1000000}]
-- Syarat: minimal 2 baris, tiap baris tepat satu sisi > 0, akun terdaftar,
-- total debit = total kredit. Nomor jurnal dari app.fn_next_doc_no('JU', tanggal).
CREATE PROCEDURE garment.sp_post_journal
    @factory_id      UNIQUEIDENTIFIER,
    @created_by      UNIQUEIDENTIFIER,            -- employees.id
    @journal_date    DATE,
    @description     NVARCHAR(200),
    @lines           NVARCHAR(MAX),
    @reference_type  VARCHAR(20) = NULL,
    @reference_no    VARCHAR(30) = NULL,
    @journal_id      UNIQUEIDENTIFIER = NULL OUTPUT,
    @journal_no      CHAR(11)         = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @l TABLE (line_no SMALLINT NOT NULL, account_code VARCHAR(10) NOT NULL,
                      debit DECIMAL(16,2) NOT NULL, credit DECIMAL(16,2) NOT NULL);
    DECLARE @new TABLE (id UNIQUEIDENTIFIER);
    DECLARE @total_debit DECIMAL(16,2), @total_credit DECIMAL(16,2);

    IF @lines IS NULL OR ISJSON(@lines) <> 1
        THROW 51020, 'ERR-JRN-01: @lines harus berupa JSON array yang valid.', 1;

    INSERT INTO @l (line_no, account_code, debit, credit)
    SELECT CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS SMALLINT),
           j.account_code, ISNULL(j.debit, 0), ISNULL(j.credit, 0)
    FROM   OPENJSON(@lines)
           WITH (account_code VARCHAR(10) '$.account_code',
                 debit        DECIMAL(16,2) '$.debit',
                 credit       DECIMAL(16,2) '$.credit') AS j
    WHERE  j.account_code IS NOT NULL;

    IF (SELECT COUNT(*) FROM @l) < 2
        THROW 51021, 'ERR-JRN-02: jurnal minimal berisi 2 baris.', 1;

    IF EXISTS (SELECT 1 FROM @l WHERE NOT ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)))
        THROW 51022, 'ERR-JRN-03: tiap baris harus mengisi tepat satu sisi (debit atau kredit) lebih dari 0.', 1;

    IF EXISTS (SELECT 1 FROM @l x WHERE NOT EXISTS (SELECT 1 FROM garment.accounts a WHERE a.account_code = x.account_code))
        THROW 51023, 'ERR-JRN-04: ada kode akun yang tidak terdaftar.', 1;

    SELECT @total_debit = SUM(debit), @total_credit = SUM(credit) FROM @l;
    IF @total_debit <> @total_credit
        THROW 51024, 'ERR-JRN-05: total debit dan total kredit tidak seimbang.', 1;

    IF @own_tran = 1 BEGIN TRANSACTION;

    SET @journal_no = CAST(app.fn_next_doc_no('JU', @journal_date) AS CHAR(11));
    IF @journal_no IS NULL
        THROW 51025, 'ERR-JRN-06: nomor jurnal tidak dapat dibuat (urutan bulan ini habis).', 1;

    INSERT INTO garment.journals (journal_no, factory_id, created_by, journal_date, description, reference_type, reference_no)
    OUTPUT inserted.id INTO @new
    VALUES (@journal_no, @factory_id, @created_by, @journal_date, @description, @reference_type, @reference_no);
    SELECT @journal_id = id FROM @new;

    INSERT INTO garment.journal_lines (journal_id, line_no, account_code, debit, credit)
    SELECT @journal_id, line_no, account_code, debit, credit FROM @l;

    IF @own_tran = 1 COMMIT TRANSACTION;
END
GO

-- Memproses penggajian satu periode untuk satu pabrik.
-- Membuat baris payrolls berstatus DRAF untuk karyawan aktif yang punya kontrak AKTIF
-- dan belum punya gaji pada periode itu. Aturan hitung (SEDERHANA, sesuaikan dengan HRD):
--   base_salary    = gaji pokok kontrak AKTIF terbaru
--   overtime_pay   = total jam lembur bulan itu x (gaji pokok / 173) x 1,5
--   bpjs_deduction = 3% gaji pokok
--   tunjangan, PPh 21, potongan lain = 0 (diisi manual)
-- @mark_paid = 1 mengubah semua DRAF periode itu (pabrik yang sama) menjadi DIBAYAR.
CREATE PROCEDURE garment.sp_process_payroll
    @period_year      SMALLINT,
    @period_month     TINYINT,
    @factory_id       UNIQUEIDENTIFIER,
    @bank_account_id  UNIQUEIDENTIFIER,
    @mark_paid        BIT  = 0,
    @paid_date        DATE = NULL,
    @rows_created     INT  = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;

    IF @period_month NOT BETWEEN 1 AND 12
        THROW 51030, 'ERR-PAY-01: bulan periode harus 1 sampai 12.', 1;

    IF NOT EXISTS (SELECT 1 FROM garment.company_bank_accounts WHERE id = @bank_account_id AND factory_id = @factory_id)
        THROW 51031, 'ERR-PAY-02: rekening tidak ditemukan atau bukan milik pabrik ini.', 1;

    IF @own_tran = 1 BEGIN TRANSACTION;

    INSERT INTO garment.payrolls
        (employee_id, period_year, period_month, bank_account_id, base_salary,
         position_allowance, meal_allowance, transport_allowance,
         overtime_pay, bpjs_deduction, pph21_deduction, other_deduction, status)
    SELECT  e.id, @period_year, @period_month, @bank_account_id, c.base_salary,
            0, 0, 0,
            ROUND(ISNULL(ot.hours, 0) * (c.base_salary / 173.0) * 1.5, 2),
            ROUND(c.base_salary * 0.03, 2),
            0, 0, 'DRAF'
    FROM    garment.employees e
    CROSS APPLY (SELECT TOP (1) ec.base_salary
                 FROM   garment.employment_contracts ec
                 WHERE  ec.employee_id = e.id AND ec.status = 'AKTIF'
                 ORDER BY ec.contract_seq DESC) c
    OUTER APPLY (SELECT SUM(a.overtime_hours) AS hours
                 FROM   garment.attendances a
                 WHERE  a.employee_id = e.id
                   AND  YEAR(a.work_date) = @period_year AND MONTH(a.work_date) = @period_month) ot
    WHERE   e.factory_id = @factory_id
      AND   e.is_active = 1
      AND   NOT EXISTS (SELECT 1 FROM garment.payrolls p
                        WHERE p.employee_id = e.id
                          AND p.period_year = @period_year AND p.period_month = @period_month);
    SET @rows_created = @@ROWCOUNT;

    IF @mark_paid = 1
        UPDATE p
        SET    status = 'DIBAYAR',
               paid_date = ISNULL(@paid_date, CAST(SYSDATETIME() AS DATE))
        FROM   garment.payrolls p
        JOIN   garment.employees e ON e.id = p.employee_id
        WHERE  e.factory_id = @factory_id
          AND  p.period_year = @period_year AND p.period_month = @period_month
          AND  p.status = 'DRAF';

    IF @own_tran = 1 COMMIT TRANSACTION;
END
GO

-- =============================================================================
-- TRIGGER
-- =============================================================================

-- activity_logs hanya boleh ditambah.
CREATE TRIGGER app.trg_activity_logs_append_only
ON app.activity_logs
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51100, 'ERR-LOG-01: app.activity_logs hanya boleh ditambah, tidak boleh diubah atau dihapus.', 1;
END
GO

-- interns: employee_type harus MAGANG dan pembimbing harus karyawan aktif.
CREATE TRIGGER garment.trg_interns_check
ON garment.interns
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM inserted i
               JOIN garment.employees e ON e.id = i.employee_id
               WHERE e.employee_type <> 'MAGANG')
    BEGIN
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW 51110, 'ERR-INT-01: karyawan peserta magang harus ber-employee_type MAGANG.', 1;
    END

    IF EXISTS (SELECT 1 FROM inserted i
               JOIN garment.employees m ON m.id = i.mentor_id
               WHERE m.is_active = 0)
    BEGIN
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW 51111, 'ERR-INT-02: pembimbing magang harus karyawan aktif.', 1;
    END
END
GO

-- Data transaksi tidak dihapus (tabel A). SQL Server tidak mengizinkan dua tabel
-- berbagi satu nama trigger, jadi namanya diberi akhiran nama tabel.
CREATE TRIGGER garment.trg_no_delete_attendances ON garment.attendances
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51120, 'ERR-DEL-01: data garment.attendances tidak boleh dihapus.', 1;
END
GO
CREATE TRIGGER garment.trg_no_delete_journals ON garment.journals
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51121, 'ERR-DEL-02: data garment.journals tidak boleh dihapus.', 1;
END
GO
CREATE TRIGGER garment.trg_no_delete_journal_lines ON garment.journal_lines
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51122, 'ERR-DEL-03: data garment.journal_lines tidak boleh dihapus.', 1;
END
GO
CREATE TRIGGER garment.trg_no_delete_payrolls ON garment.payrolls
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51123, 'ERR-DEL-04: data garment.payrolls tidak boleh dihapus.', 1;
END
GO
CREATE TRIGGER garment.trg_no_delete_employment_contracts ON garment.employment_contracts
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 51124, 'ERR-DEL-05: data garment.employment_contracts tidak boleh dihapus.', 1;
END
GO
