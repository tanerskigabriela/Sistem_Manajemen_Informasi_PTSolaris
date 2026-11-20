-- =====================================================================
-- 08-objects-produksi.sql  |  Pemilik: C  |  KONTRAK v2 revisi 4, Bagian 5
-- Function, view, stored procedure, dan trigger milik C (schema garment).
-- Dijalankan setelah 00-06 dan 07-objects-core.sql (milik A).
--
-- Bergantung pada objek milik A (07-objects-core.sql):
--   garment.fn_next_doc_no(@prefix, @at)          -> nomor SPK
--   app.sp_create_notification(@event_code, @role_codes, @message,
--                              @link, @dedup_key, @created OUTPUT)
--   [CEK DENGAN A] schema dan parameter kedua objek ini harus sama.
--   Parameter sp_create_notification mengikuti TSD 5.1.
--
-- Pola transaksi: SP hanya membuka transaksi sendiri bila belum ada
-- transaksi dari luar (@@TRANCOUNT = 0). Bila dipanggil dari service
-- di dalam withTransaction(), SP ikut transaksi service (KONTRAK 10.1).
--
-- Hasil bisnis dikembalikan lewat @result (mengikuti TSD 5.1), bukan
-- error. Service memetakan @result ke kode error FSD (ERR-SPK-xx, dst.).
-- =====================================================================
USE solaris_db;
GO

/* =====================================================================
   1. FUNCTIONS
   ===================================================================== */

/* ---------- fn_material_readiness (RB-27) ----------
   SIAP bila sudah ada minimal satu bahan tercatat untuk style tersebut. */
CREATE OR ALTER FUNCTION garment.fn_material_readiness (@order_detail_id UNIQUEIDENTIFIER)
RETURNS VARCHAR(10)
AS
BEGIN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM garment.order_materials WHERE order_detail_id = @order_detail_id)
                THEN 'SIAP' ELSE 'BELUM_SIAP' END;
END;
GO

/* ---------- fn_material_locked (RB-67) ----------
   1 bila style sudah punya SPK MENUNGGU_PERSETUJUAN atau DISETUJUI. */
CREATE OR ALTER FUNCTION garment.fn_material_locked (@order_detail_id UNIQUEIDENTIFIER)
RETURNS BIT
AS
BEGIN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM garment.spk
                             WHERE order_detail_id = @order_detail_id
                               AND status IN ('MENUNGGU_PERSETUJUAN','DISETUJUI'))
                THEN 1 ELSE 0 END;
END;
GO

/* ---------- fn_material_requirement (fitur tambahan: master bahan + BOM) ----------
   Kebutuhan bahan = qty_per_pcs x jumlah pesan (dikurangi batal) x (1 + toleransi waste).
   recorded_qty = bahan yang sudah dicatat PPIC untuk style ini. */
CREATE OR ALTER FUNCTION garment.fn_material_requirement (@order_detail_id UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
WITH order_qty AS (
    SELECT SUM(qty - cancelled_qty) AS total_qty
    FROM garment.order_detail_sizes
    WHERE order_detail_id = @order_detail_id
),
recorded AS (
    SELECT material_id, SUM(qty) AS recorded_qty
    FROM garment.order_materials
    WHERE order_detail_id = @order_detail_id
    GROUP BY material_id
)
SELECT
    b.material_id,
    rm.material_code,
    rm.material_name,
    b.unit,
    b.qty_per_pcs,
    b.waste_tolerance_pct,
    ISNULL(oq.total_qty, 0) AS order_qty,
    CAST(b.qty_per_pcs * ISNULL(oq.total_qty, 0) * (1 + b.waste_tolerance_pct / 100) AS DECIMAL(14,2)) AS required_qty,
    ISNULL(r.recorded_qty, 0) AS recorded_qty,
    CAST(CASE WHEN b.qty_per_pcs * ISNULL(oq.total_qty, 0) * (1 + b.waste_tolerance_pct / 100) > ISNULL(r.recorded_qty, 0)
              THEN b.qty_per_pcs * ISNULL(oq.total_qty, 0) * (1 + b.waste_tolerance_pct / 100) - ISNULL(r.recorded_qty, 0)
              ELSE 0 END AS DECIMAL(14,2)) AS shortage_qty
FROM garment.order_details d
JOIN garment.bom b            ON b.item_id = d.item_id
JOIN garment.raw_materials rm ON rm.id = b.material_id
CROSS JOIN order_qty oq
LEFT JOIN recorded r          ON r.material_id = b.material_id
WHERE d.id = @order_detail_id;
GO

/* ---------- fn_stage_max_allowed (RB-37) ----------
   CUTTING: total jumlah SPK (tanpa batas atas; selisih wajib dijelaskan, RB-38).
   Tahap lain: jumlah lolos QC kumulatif tahap sebelumnya. */
CREATE OR ALTER FUNCTION garment.fn_stage_max_allowed (@spk_id UNIQUEIDENTIFIER, @stage_code VARCHAR(10))
RETURNS INT
AS
BEGIN
    DECLARE @seq TINYINT, @prev VARCHAR(10), @result INT;

    SELECT @seq = sequence FROM garment.production_stages WHERE stage_code = @stage_code;

    IF @seq = 1
        SELECT @result = ISNULL(SUM(qty), 0) FROM garment.spk_sizes WHERE spk_id = @spk_id;
    ELSE
    BEGIN
        SELECT @prev = stage_code FROM garment.production_stages WHERE sequence = @seq - 1;
        SELECT @result = ISNULL(SUM(qty_passed), 0)
        FROM garment.qc_results
        WHERE spk_id = @spk_id AND stage_code = @prev AND inspection_type IN ('INLINE','FINAL');
    END;

    RETURN @result;
END;
GO

/* ---------- fn_detail_completion_pct (RB-45; dulu fn_style_completion_pct) ----------
   Rata-rata dari 6 tahap: MIN(100, kumulatif selesai / jumlah SPK x 100).
   Memakai SPK yang DISETUJUI; 0 bila belum ada. */
CREATE OR ALTER FUNCTION garment.fn_detail_completion_pct (@order_detail_id UNIQUEIDENTIFIER)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @spk_id UNIQUEIDENTIFIER, @spk_qty INT, @result DECIMAL(5,2);

    SELECT TOP 1 @spk_id = id FROM garment.spk
    WHERE order_detail_id = @order_detail_id AND status = 'DISETUJUI';

    IF @spk_id IS NULL RETURN 0;

    SELECT @spk_qty = SUM(qty) FROM garment.spk_sizes WHERE spk_id = @spk_id;
    IF ISNULL(@spk_qty, 0) = 0 RETURN 0;

    SELECT @result = CAST(AVG(CASE WHEN 100.0 * ISNULL(p.done, 0) / @spk_qty > 100 THEN 100.0
                                   ELSE 100.0 * ISNULL(p.done, 0) / @spk_qty END) AS DECIMAL(5,2))
    FROM garment.production_stages st
    LEFT JOIN (SELECT stage_code, SUM(qty_done) AS done
               FROM garment.production_progress
               WHERE spk_id = @spk_id
               GROUP BY stage_code) p ON p.stage_code = st.stage_code;

    RETURN ISNULL(@result, 0);
END;
GO

/* ---------- fn_time_elapsed_pct (RB-45) ----------
   (hari ini - tanggal SPK disetujui) / (deadline order - tanggal SPK disetujui) x 100,
   dibatasi 0-100. 0 bila belum ada SPK disetujui. */
CREATE OR ALTER FUNCTION garment.fn_time_elapsed_pct (@order_detail_id UNIQUEIDENTIFIER)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @approved DATE, @deadline DATE, @total INT, @elapsed INT, @pct DECIMAL(9,2);

    SELECT TOP 1 @approved = CAST(s.approved_at AS DATE), @deadline = o.deadline
    FROM garment.spk s
    JOIN garment.order_details d ON d.id = s.order_detail_id
    JOIN garment.orders o        ON o.id = d.order_id
    WHERE s.order_detail_id = @order_detail_id AND s.status = 'DISETUJUI';

    IF @approved IS NULL RETURN 0;

    SET @total   = DATEDIFF(DAY, @approved, @deadline);
    SET @elapsed = DATEDIFF(DAY, @approved, CAST(SYSDATETIME() AS DATE));

    IF @total <= 0 RETURN 100;

    SET @pct = 100.0 * @elapsed / @total;
    RETURN CASE WHEN @pct < 0 THEN 0 WHEN @pct > 100 THEN 100 ELSE @pct END;
END;
GO

/* ---------- fn_reject_pct (RB-43) ----------
   (Σ selesai kumulatif - Σ lolos kumulatif) / Σ selesai kumulatif x 100,
   tahap Cutting-Ironing; 0 bila belum ada data.
   Catatan: hanya tahap yang SUDAH punya hasil QC yang dihitung. Tahap yang
   baru dikerjakan tapi belum diperiksa QC tidak dianggap reject, supaya
   tanda "Melebihi Batas Reject" (N-08) tidak muncul sebelum QC memeriksa. */
CREATE OR ALTER FUNCTION garment.fn_reject_pct (@order_detail_id UNIQUEIDENTIFIER)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @spk_id UNIQUEIDENTIFIER, @done INT, @passed INT;

    SELECT TOP 1 @spk_id = id FROM garment.spk
    WHERE order_detail_id = @order_detail_id AND status = 'DISETUJUI';

    IF @spk_id IS NULL RETURN 0;

    SELECT @done = SUM(ISNULL(p.done, 0)), @passed = SUM(q.passed)
    FROM (SELECT stage_code, SUM(qty_passed) AS passed
          FROM garment.qc_results
          WHERE spk_id = @spk_id AND inspection_type IN ('INLINE','FINAL')
          GROUP BY stage_code) q
    LEFT JOIN (SELECT stage_code, SUM(qty_done) AS done
               FROM garment.production_progress
               WHERE spk_id = @spk_id
               GROUP BY stage_code) p ON p.stage_code = q.stage_code;

    IF ISNULL(@done, 0) = 0 RETURN 0;

    RETURN CAST(100.0 * (@done - ISNULL(@passed, 0)) / @done AS DECIMAL(5,2));
END;
GO

/* ---------- fn_ready_to_ship (RB-50) ----------
   Batas kiriman = Packing selesai (style) - total sudah dikirim (style).
   Bila @size diisi, dibatasi juga oleh sisa pesanan ukuran itu
   (qty - cancelled_qty - sudah dikirim untuk ukuran itu).
   Progres tidak dicatat per ukuran, jadi Packing dihitung per style. */
CREATE OR ALTER FUNCTION garment.fn_ready_to_ship (@order_detail_id UNIQUEIDENTIFIER, @size VARCHAR(10))
RETURNS INT
AS
BEGIN
    DECLARE @packed INT, @shipped INT, @style_left INT, @size_left INT;

    SELECT @packed = ISNULL(SUM(pp.qty_done), 0)
    FROM garment.production_progress pp
    JOIN garment.spk s ON s.id = pp.spk_id
    WHERE s.order_detail_id = @order_detail_id
      AND s.status = 'DISETUJUI'
      AND pp.stage_code = 'PACKING';

    SELECT @shipped = ISNULL(SUM(qty), 0)
    FROM garment.shipment_items
    WHERE order_detail_id = @order_detail_id;

    SET @style_left = @packed - @shipped;

    IF @size IS NOT NULL
    BEGIN
        SELECT @size_left = z.qty - z.cancelled_qty
               - ISNULL((SELECT SUM(si.qty) FROM garment.shipment_items si
                         WHERE si.order_detail_id = z.order_detail_id AND si.size = z.size), 0)
        FROM garment.order_detail_sizes z
        WHERE z.order_detail_id = @order_detail_id AND z.size = @size;

        IF @size_left IS NULL RETURN 0;   -- ukuran tidak ada di order
        IF @size_left < @style_left SET @style_left = @size_left;
    END;

    RETURN CASE WHEN @style_left < 0 THEN 0 ELSE @style_left END;
END;
GO

/* =====================================================================
   2. VIEWS
   ===================================================================== */

/* ---------- v_style_progress (RB-39, RB-43) ----------
   Kumulatif selesai, lolos, tidak lolos, dan sisa pekerjaan per SPK per tahap. */
CREATE OR ALTER VIEW garment.v_style_progress
AS
WITH spk_qty AS (
    SELECT spk_id, SUM(qty) AS spk_qty FROM garment.spk_sizes GROUP BY spk_id
),
done AS (
    SELECT spk_id, stage_code, SUM(qty_done) AS cumulative_done
    FROM garment.production_progress
    GROUP BY spk_id, stage_code
),
passed AS (
    SELECT spk_id, stage_code, SUM(qty_passed) AS cumulative_passed
    FROM garment.qc_results
    WHERE inspection_type IN ('INLINE','FINAL')
    GROUP BY spk_id, stage_code
)
SELECT
    s.id                AS spk_id,
    s.spk_no,
    s.status            AS spk_status,
    s.order_detail_id,
    d.order_id,
    st.stage_code,
    st.sequence,
    q.spk_qty,
    ISNULL(dn.cumulative_done, 0) AS cumulative_done,
    CASE WHEN st.stage_code = 'PACKING' THEN NULL ELSE ISNULL(p.cumulative_passed, 0) END AS cumulative_passed,
    CASE WHEN st.stage_code = 'PACKING' OR p.cumulative_passed IS NULL THEN NULL
         ELSE ISNULL(dn.cumulative_done, 0) - p.cumulative_passed END AS failed,
    CASE WHEN st.stage_code = 'PACKING' OR p.cumulative_passed IS NULL OR ISNULL(dn.cumulative_done, 0) = 0 THEN NULL
         ELSE CAST(100.0 * (dn.cumulative_done - p.cumulative_passed) / dn.cumulative_done AS DECIMAL(5,2)) END AS reject_pct,
    CASE WHEN q.spk_qty - ISNULL(dn.cumulative_done, 0) < 0 THEN 0
         ELSE q.spk_qty - ISNULL(dn.cumulative_done, 0) END AS remaining
FROM garment.spk s
JOIN garment.order_details d ON d.id = s.order_detail_id
JOIN spk_qty q               ON q.spk_id = s.id
CROSS JOIN garment.production_stages st
LEFT JOIN done dn            ON dn.spk_id = s.id AND dn.stage_code = st.stage_code
LEFT JOIN passed p           ON p.spk_id = s.id AND p.stage_code = st.stage_code;
GO

/* ---------- v_supplier_materials (FR-018) ---------- */
CREATE OR ALTER VIEW garment.v_supplier_materials
AS
SELECT
    sp.id            AS supplier_id,
    sp.supplier_name,
    sp.payment_term,
    o.order_code,
    i.item_code,
    d.color,
    rm.material_code,
    rm.material_name,
    om.qty,
    om.unit,
    om.material_price,
    om.received_date
FROM garment.suppliers sp
JOIN garment.order_materials om ON om.supplier_id = sp.id
JOIN garment.raw_materials rm   ON rm.id = om.material_id
JOIN garment.order_details d    ON d.id = om.order_detail_id
JOIN garment.orders o           ON o.id = d.order_id
JOIN garment.items i            ON i.id = d.item_id;
GO

/* ---------- v_spk_list (RB-35: tanpa kolom harga) ---------- */
CREATE OR ALTER VIEW garment.v_spk_list
AS
SELECT
    s.id              AS spk_id,
    s.spk_no,
    o.id              AS order_id,
    o.order_code,
    o.status          AS order_status,
    s.order_detail_id,
    i.item_code,
    i.item_name,
    d.color,
    l.line_name,
    (SELECT SUM(z.qty) FROM garment.spk_sizes z WHERE z.spk_id = s.id) AS total_qty,
    s.target_date,
    s.status,
    s.approved_at,
    s.created_at
FROM garment.spk s
JOIN garment.order_details d    ON d.id = s.order_detail_id
JOIN garment.orders o           ON o.id = d.order_id
JOIN garment.items i            ON i.id = d.item_id
JOIN garment.production_lines l ON l.id = s.line_id;
GO

/* ---------- v_stock_summary (SMBD: stok per gudang) ---------- */
CREATE OR ALTER VIEW garment.v_stock_summary
AS
SELECT
    'BAHAN'                          AS stock_type,
    w.id                             AS warehouse_id,
    w.warehouse_name,
    rm.id                            AS item_ref_id,
    rm.material_code                 AS item_ref_code,
    rm.material_name                 AS item_ref_name,
    rm.unit,
    SUM(ms.available_qty)            AS available_qty,
    SUM(ms.allocated_qty)            AS allocated_qty,
    SUM(ms.available_qty - ms.allocated_qty) AS free_qty,
    rm.minimum_stock,
    CASE WHEN SUM(ms.available_qty - ms.allocated_qty) < rm.minimum_stock THEN 1 ELSE 0 END AS below_minimum
FROM garment.material_stocks ms
JOIN garment.rack_locations r ON r.id = ms.location_id
JOIN garment.warehouses w     ON w.id = r.warehouse_id
JOIN garment.raw_materials rm ON rm.id = ms.material_id
GROUP BY w.id, w.warehouse_name, rm.id, rm.material_code, rm.material_name, rm.unit, rm.minimum_stock
UNION ALL
SELECT
    'PRODUK',
    w.id,
    w.warehouse_name,
    v.id,
    v.sku,
    CONCAT(i.item_name, N' ', v.color, N' ', v.size),
    N'pcs',
    SUM(CAST(ps.available_qty AS DECIMAL(12,2))),
    CAST(0 AS DECIMAL(12,2)),
    SUM(CAST(ps.available_qty AS DECIMAL(12,2))),
    CAST(0 AS DECIMAL(12,2)),
    0
FROM garment.product_stocks ps
JOIN garment.rack_locations r ON r.id = ps.location_id
JOIN garment.warehouses w     ON w.id = r.warehouse_id
JOIN garment.item_variants v  ON v.id = ps.variant_id
JOIN garment.items i          ON i.id = v.item_id
WHERE ps.goods_condition = 'BAIK'
GROUP BY w.id, w.warehouse_name, v.id, v.sku, i.item_name, v.color, v.size;
GO

/* =====================================================================
   3. STORED PROCEDURES
   ===================================================================== */

/* ---------- sp_submit_spk (RB-29 s.d. RB-32, RB-68; TSD 5.1) ----------
   @sizes: JSON, mis. '[{"size":"S","qty":100},{"size":"M","qty":120}]'
   @result: SUCCESS | NOT_FOUND | ORDER_NOT_APPROVED (ERR-SPK-01) |
            MATERIAL_NOT_READY (ERR-SPK-02) | SPK_EXISTS (ERR-SPK-03) |
            INVALID_LINE | INVALID_SIZES */
CREATE OR ALTER PROCEDURE garment.sp_submit_spk
    @order_detail_id UNIQUEIDENTIFIER,
    @line_id         UNIQUEIDENTIFIER,
    @employee_id     UNIQUEIDENTIFIER,   -- PPIC yang mengajukan dan mencentang bahan lengkap
    @target_date     DATE,
    @sizes           NVARCHAR(MAX),
    @spk_id          UNIQUEIDENTIFIER OUTPUT,
    @spk_no          CHAR(12)         OUTPUT,
    @result          VARCHAR(20)      OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @spk_id = NULL, @spk_no = NULL, @result = NULL;

    DECLARE @order_status VARCHAR(20), @order_code CHAR(12), @factory_id UNIQUEIDENTIFIER;

    SELECT @order_status = o.status, @order_code = o.order_code, @factory_id = o.factory_id
    FROM garment.order_details d
    JOIN garment.orders o ON o.id = d.order_id
    WHERE d.id = @order_detail_id;

    IF @order_status IS NULL                                  BEGIN SET @result = 'NOT_FOUND';          RETURN; END;
    IF @order_status NOT IN ('DISETUJUI','DALAM_PRODUKSI')    BEGIN SET @result = 'ORDER_NOT_APPROVED'; RETURN; END;
    IF garment.fn_material_readiness(@order_detail_id) = 'BELUM_SIAP'
                                                              BEGIN SET @result = 'MATERIAL_NOT_READY'; RETURN; END;
    IF garment.fn_material_locked(@order_detail_id) = 1       BEGIN SET @result = 'SPK_EXISTS';         RETURN; END;
    IF NOT EXISTS (SELECT 1 FROM garment.production_lines WHERE id = @line_id AND factory_id = @factory_id)
                                                              BEGIN SET @result = 'INVALID_LINE';       RETURN; END;

    -- Validasi JSON tanpa memicu error, supaya transaksi service tidak ikut rusak
    IF ISJSON(@sizes) <> 1 BEGIN SET @result = 'INVALID_SIZES'; RETURN; END;

    DECLARE @s TABLE (size VARCHAR(10) NULL, qty INT NULL);
    INSERT INTO @s (size, qty)
    SELECT LEFT(size, 10), TRY_CONVERT(INT, qty)
    FROM OPENJSON(@sizes) WITH (size NVARCHAR(50) '$.size', qty NVARCHAR(20) '$.qty');

    IF NOT EXISTS (SELECT 1 FROM @s)
       OR EXISTS (SELECT 1 FROM @s WHERE size IS NULL OR qty IS NULL OR qty <= 0)
       OR EXISTS (SELECT size FROM @s GROUP BY size HAVING COUNT(*) > 1)      -- ukuran ganda
       OR EXISTS (SELECT 1 FROM @s s
                  WHERE NOT EXISTS (SELECT 1 FROM garment.order_detail_sizes z
                                    WHERE z.order_detail_id = @order_detail_id AND z.size = s.size))
    BEGIN SET @result = 'INVALID_SIZES'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        SET @spk_no = garment.fn_next_doc_no('SPK', CAST(SYSDATETIME() AS DATE));

        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.spk (spk_no, order_detail_id, line_id, created_by, materials_complete_by, target_date)
        OUTPUT inserted.id INTO @new
        VALUES (@spk_no, @order_detail_id, @line_id, @employee_id, @employee_id, @target_date);
        SELECT @spk_id = id FROM @new;

        INSERT INTO garment.spk_sizes (spk_id, size, qty)
        SELECT @spk_id, size, qty FROM @s;

        DECLARE @msg NVARCHAR(300) = CONCAT(N'SPK ', @spk_no, N' untuk order ', @order_code, N' menunggu persetujuan.');
        DECLARE @created INT;
        EXEC app.sp_create_notification
             @event_code = 'N-02', @role_codes = 'PIMPINAN', @message = @msg,
             @link = '/persetujuan', @dedup_key = NULL, @created = @created OUTPUT;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = 'SUCCESS';
    END TRY
    BEGIN CATCH
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* ---------- sp_decide_spk (RB-23, RB-33, RB-34; TSD 5.1) ----------
   @decision: APPROVE | REJECT
   @result: SUCCESS | NOT_FOUND | INVALID | REASON_REQUIRED |
            ALREADY_DECIDED (ERR-SPK-04) | ORDER_CLOSED */
CREATE OR ALTER PROCEDURE garment.sp_decide_spk
    @spk_id      UNIQUEIDENTIFIER,
    @decision    VARCHAR(10),
    @employee_id UNIQUEIDENTIFIER,   -- Pimpinan
    @reason      NVARCHAR(500) = NULL,
    @result      VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @result = NULL;

    IF @decision NOT IN ('APPROVE','REJECT') BEGIN SET @result = 'INVALID'; RETURN; END;
    IF @decision = 'REJECT' AND LEN(LTRIM(RTRIM(ISNULL(@reason, N'')))) = 0
        BEGIN SET @result = 'REASON_REQUIRED'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @spk_status VARCHAR(20), @spk_no CHAR(12), @order_id UNIQUEIDENTIFIER,
            @order_status VARCHAR(20), @order_code CHAR(12), @created INT, @msg NVARCHAR(300);

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        SELECT @spk_status = s.status, @spk_no = s.spk_no,
               @order_id = o.id, @order_status = o.status, @order_code = o.order_code
        FROM garment.spk s WITH (UPDLOCK, ROWLOCK)
        JOIN garment.order_details d ON d.id = s.order_detail_id
        JOIN garment.orders o        ON o.id = d.order_id
        WHERE s.id = @spk_id;

        IF @spk_status IS NULL OR @spk_status <> 'MENUNGGU_PERSETUJUAN'
           OR @order_status NOT IN ('DISETUJUI','DALAM_PRODUKSI')
        BEGIN
            SET @result = CASE WHEN @spk_status IS NULL THEN 'NOT_FOUND'
                               WHEN @spk_status <> 'MENUNGGU_PERSETUJUAN' THEN 'ALREADY_DECIDED'
                               ELSE 'ORDER_CLOSED' END;   -- RB-23: order dibatalkan/ditolak/ditarik
            IF @own_tran = 1 ROLLBACK TRANSACTION;
            RETURN;
        END;

        IF @decision = 'APPROVE'
        BEGIN
            UPDATE garment.spk
            SET status = 'DISETUJUI', decided_by = @employee_id, approved_at = SYSDATETIME()
            WHERE id = @spk_id;

            -- RB-34: SPK pertama yang disetujui -> order DALAM_PRODUKSI
            IF @order_status = 'DISETUJUI'
            BEGIN
                UPDATE garment.orders SET status = 'DALAM_PRODUKSI' WHERE id = @order_id;
                INSERT INTO garment.order_status_history (order_id, status, changed_by)
                VALUES (@order_id, 'DALAM_PRODUKSI', @employee_id);
            END;

            SET @msg = CONCAT(N'SPK ', @spk_no, N' untuk order ', @order_code, N' disetujui.');
            EXEC app.sp_create_notification
                 @event_code = 'N-05', @role_codes = 'PPIC,SPV', @message = @msg,
                 @link = '/spk', @dedup_key = NULL, @created = @created OUTPUT;
        END
        ELSE
        BEGIN
            UPDATE garment.spk
            SET status = 'DITOLAK', decided_by = @employee_id, reject_reason = @reason
            WHERE id = @spk_id;
            -- data bahan style otomatis terbuka lagi (fn_material_locked = 0)

            SET @msg = CONCAT(N'SPK ', @spk_no, N' untuk order ', @order_code, N' ditolak. Alasan: ', @reason);
            SET @msg = LEFT(@msg, 300);
            EXEC app.sp_create_notification
                 @event_code = 'N-05', @role_codes = 'PPIC', @message = @msg,
                 @link = '/spk', @dedup_key = NULL, @created = @created OUTPUT;
        END;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = 'SUCCESS';
    END TRY
    BEGIN CATCH
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* ---------- sp_evaluate_flags (RB-44, RB-45, N-07, N-08; TSD 5.1) ----------
   @order_detail_id NULL = semua style pada order DALAM_PRODUKSI.
   Dipanggil service setelah progres/QC disimpan, dan oleh node-cron tiap 15 menit. */
CREATE OR ALTER PROCEDURE garment.sp_evaluate_flags
    @order_detail_id UNIQUEIDENTIFIER = NULL,
    @changed         INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @changed = 0;

    DECLARE @t TABLE (
        order_detail_id UNIQUEIDENTIFIER PRIMARY KEY,
        order_id        UNIQUEIDENTIFIER,
        old_risk BIT, old_over BIT,
        new_risk BIT, new_over BIT,
        label NVARCHAR(150)
    );

    INSERT INTO @t
    SELECT d.id, d.order_id, d.is_at_risk, d.is_over_reject,
           CASE WHEN garment.fn_detail_completion_pct(d.id) < garment.fn_time_elapsed_pct(d.id) THEN 1 ELSE 0 END,
           CASE WHEN garment.fn_reject_pct(d.id) > o.reject_limit_pct THEN 1 ELSE 0 END,
           CONCAT(i.item_code, N' ', d.color, N' (order ', o.order_code, N')')
    FROM garment.order_details d
    JOIN garment.orders o ON o.id = d.order_id
    JOIN garment.items i  ON i.id = d.item_id
    WHERE o.status = 'DALAM_PRODUKSI'
      AND (@order_detail_id IS NULL OR d.id = @order_detail_id)
      AND EXISTS (SELECT 1 FROM garment.spk s WHERE s.order_detail_id = d.id AND s.status = 'DISETUJUI');

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        UPDATE d
        SET is_at_risk = t.new_risk, is_over_reject = t.new_over
        FROM garment.order_details d
        JOIN @t t ON t.order_detail_id = d.id
        WHERE d.is_at_risk <> t.new_risk OR d.is_over_reject <> t.new_over;
        SET @changed = @@ROWCOUNT;

        -- tanda order = MAX tanda semua style-nya
        UPDATE o
        SET is_at_risk     = x.any_risk,
            is_over_reject = x.any_over
        FROM garment.orders o
        JOIN (SELECT d.order_id,
                     CAST(MAX(CAST(d.is_at_risk AS INT)) AS BIT)     AS any_risk,
                     CAST(MAX(CAST(d.is_over_reject AS INT)) AS BIT) AS any_over
              FROM garment.order_details d
              WHERE d.order_id IN (SELECT order_id FROM @t)
              GROUP BY d.order_id) x ON x.order_id = o.id
        WHERE o.is_at_risk <> x.any_risk OR o.is_over_reject <> x.any_over;

        -- notifikasi saat tanda berubah 0 -> 1; dedup_key menjamin sekali per style
        DECLARE @id UNIQUEIDENTIFIER, @label NVARCHAR(150), @kind CHAR(4),
                @msg NVARCHAR(300), @key VARCHAR(80), @created INT;

        DECLARE c CURSOR LOCAL FAST_FORWARD FOR
            SELECT order_detail_id, label, 'N-07' FROM @t WHERE old_risk = 0 AND new_risk = 1
            UNION ALL
            SELECT order_detail_id, label, 'N-08' FROM @t WHERE old_over = 0 AND new_over = 1;
        OPEN c;
        FETCH NEXT FROM c INTO @id, @label, @kind;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @msg = CASE @kind
                         WHEN 'N-07' THEN CONCAT(N'Style ', @label, N' berisiko terlambat.')
                         ELSE CONCAT(N'Persentase tidak lolos style ', @label, N' melebihi batas reject.')
                       END;
            SET @key = CONCAT(@kind, ':', CAST(@id AS VARCHAR(36)));
            EXEC app.sp_create_notification
                 @event_code = @kind, @role_codes = 'PIMPINAN,PPIC', @message = @msg,
                 @link = '/dashboard', @dedup_key = @key, @created = @created OUTPUT;
            FETCH NEXT FROM c INTO @id, @label, @kind;
        END;
        CLOSE c;
        DEALLOCATE c;

        IF @own_tran = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'c') >= 0 BEGIN CLOSE c; DEALLOCATE c; END;
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* ---------- sp_record_stock_movement (SMBD aturan 10: stok hanya berubah lewat mutasi) ----------
   Mengubah material_stocks / product_stocks dan mencatat stock_movements dalam satu transaksi.
   MASUK: tambah ke tujuan. KELUAR: kurangi dari asal. PINDAH: asal -> tujuan.
   PENYESUAIAN (hasil stok opname): kurangi dari asal ATAU tambah ke tujuan.
   @result: SUCCESS | INVALID | BATCH_REQUIRED | STOK_KURANG */
CREATE OR ALTER PROCEDURE garment.sp_record_stock_movement
    @movement_type    VARCHAR(11),
    @from_location_id UNIQUEIDENTIFIER = NULL,
    @to_location_id   UNIQUEIDENTIFIER = NULL,
    @material_id      UNIQUEIDENTIFIER = NULL,
    @variant_id       UNIQUEIDENTIFIER = NULL,
    @batch_no         VARCHAR(30)      = NULL,
    @qty              DECIMAL(12,2),
    @reference_type   VARCHAR(20),
    @reference_no     VARCHAR(30),
    @employee_id      UNIQUEIDENTIFIER,
    @movement_id      UNIQUEIDENTIFIER OUTPUT,
    @result           VARCHAR(20)      OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @movement_id = NULL, @result = NULL;

    -- validasi dasar (sama dengan CHECK di tabel, supaya hasilnya rapi, bukan error)
    IF @qty IS NULL OR @qty <= 0
       OR @movement_type NOT IN ('MASUK','KELUAR','PINDAH','PENYESUAIAN')
       OR (@material_id IS NULL AND @variant_id IS NULL)
       OR (@material_id IS NOT NULL AND @variant_id IS NOT NULL)
       OR (@movement_type = 'MASUK'  AND (@to_location_id IS NULL OR @from_location_id IS NOT NULL))
       OR (@movement_type = 'KELUAR' AND (@from_location_id IS NULL OR @to_location_id IS NOT NULL))
       OR (@movement_type = 'PINDAH' AND (@from_location_id IS NULL OR @to_location_id IS NULL OR @from_location_id = @to_location_id))
       OR (@movement_type = 'PENYESUAIAN' AND @from_location_id IS NULL AND @to_location_id IS NULL)
       OR (@variant_id IS NOT NULL AND @qty <> FLOOR(@qty))   -- barang jadi dihitung per pcs
    BEGIN SET @result = 'INVALID'; RETURN; END;

    IF @material_id IS NOT NULL AND @batch_no IS NULL
    BEGIN SET @result = 'BATCH_REQUIRED'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @row UNIQUEIDENTIFIER;

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        /* ---- kurangi dari lokasi asal ---- */
        IF @from_location_id IS NOT NULL
        BEGIN
            DECLARE @affected INT = 0;

            IF @material_id IS NOT NULL
            BEGIN
                UPDATE garment.material_stocks WITH (UPDLOCK, ROWLOCK)
                SET available_qty = available_qty - @qty, updated_at = SYSDATETIME()
                WHERE location_id = @from_location_id AND material_id = @material_id
                  AND batch_no = @batch_no AND available_qty - allocated_qty >= @qty;
                SET @affected = @@ROWCOUNT;
            END
            ELSE
            BEGIN
                SELECT TOP 1 @row = id
                FROM garment.product_stocks WITH (UPDLOCK, ROWLOCK)
                WHERE location_id = @from_location_id AND variant_id = @variant_id
                  AND goods_condition = 'BAIK' AND available_qty >= @qty
                ORDER BY updated_at;

                UPDATE garment.product_stocks
                SET available_qty = available_qty - CAST(@qty AS INT), updated_at = SYSDATETIME()
                WHERE id = @row;
                SET @affected = @@ROWCOUNT;
            END;

            IF @affected = 0
            BEGIN
                SET @result = 'STOK_KURANG';
                IF @own_tran = 1 ROLLBACK TRANSACTION;
                RETURN;
            END;
        END;

        /* ---- tambah ke lokasi tujuan ---- */
        IF @to_location_id IS NOT NULL
        BEGIN
            IF @material_id IS NOT NULL
            BEGIN
                UPDATE garment.material_stocks WITH (UPDLOCK, ROWLOCK)
                SET available_qty = available_qty + @qty, updated_at = SYSDATETIME()
                WHERE location_id = @to_location_id AND material_id = @material_id AND batch_no = @batch_no;
                DECLARE @added INT = @@ROWCOUNT;

                IF @added = 0
                    INSERT INTO garment.material_stocks (location_id, material_id, batch_no, available_qty, allocated_qty)
                    VALUES (@to_location_id, @material_id, @batch_no, @qty, 0);
            END
            ELSE
            BEGIN
                SET @row = NULL;
                SELECT TOP 1 @row = id
                FROM garment.product_stocks WITH (UPDLOCK, ROWLOCK)
                WHERE location_id = @to_location_id AND variant_id = @variant_id AND goods_condition = 'BAIK'
                ORDER BY updated_at;

                IF @row IS NOT NULL
                    UPDATE garment.product_stocks
                    SET available_qty = available_qty + CAST(@qty AS INT), updated_at = SYSDATETIME()
                    WHERE id = @row;
                ELSE
                    INSERT INTO garment.product_stocks (location_id, variant_id, available_qty, goods_condition)
                    VALUES (@to_location_id, @variant_id, CAST(@qty AS INT), 'BAIK');
            END;
        END;

        /* ---- catat mutasi ---- */
        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.stock_movements
            (movement_type, from_location_id, to_location_id, material_id, variant_id,
             batch_no, qty, reference_type, reference_no, moved_by)
        OUTPUT inserted.id INTO @new
        VALUES (@movement_type, @from_location_id, @to_location_id, @material_id, @variant_id,
                @batch_no, @qty, @reference_type, @reference_no, @employee_id);
        SELECT @movement_id = id FROM @new;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = 'SUCCESS';
    END TRY
    BEGIN CATCH
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* ---------- sp_receive_material (SMBD: penerimaan bahan dari PO) ----------
   @items: JSON, mis.
   '[{"po_item_id":"...","origin_country":"ID","batch_no":"B-001",
      "received_qty":100,"rejected_qty":5,"location_id":"..."}]'
   Jumlah diterima dikurangi jumlah ditolak (hasil pemeriksaan saat bahan datang)
   masuk ke stok lewat sp_record_stock_movement. Status PO menjadi SELESAI bila
   semua item sudah terpenuhi, selain itu DITERIMA_SEBAGIAN.
   @result: SUCCESS | PO_NOT_APPROVED | INVALID_ITEMS */
CREATE OR ALTER PROCEDURE garment.sp_receive_material
    @po_id                     UNIQUEIDENTIFIER,
    @warehouse_id              UNIQUEIDENTIFIER,
    @employee_id               UNIQUEIDENTIFIER,
    @supplier_delivery_note_no VARCHAR(30),
    @arrival_date              DATE,
    @items                     NVARCHAR(MAX),
    @receipt_id                UNIQUEIDENTIFIER OUTPUT,
    @result                    VARCHAR(20)      OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @receipt_id = NULL, @result = NULL;

    IF NOT EXISTS (SELECT 1 FROM garment.purchase_orders
                   WHERE id = @po_id AND status IN ('DISETUJUI','DITERIMA_SEBAGIAN'))
    BEGIN SET @result = 'PO_NOT_APPROVED'; RETURN; END;

    DECLARE @it TABLE (
        row_no         INT IDENTITY(1,1) PRIMARY KEY,
        po_item_id     UNIQUEIDENTIFIER,
        origin_country CHAR(2),
        batch_no       VARCHAR(30),
        received_qty   DECIMAL(12,2),
        rejected_qty   DECIMAL(12,2),
        location_id    UNIQUEIDENTIFIER,
        material_id    UNIQUEIDENTIFIER
    );

    -- Validasi JSON tanpa memicu error, supaya transaksi service tidak ikut rusak
    IF ISJSON(@items) <> 1 BEGIN SET @result = 'INVALID_ITEMS'; RETURN; END;

    INSERT INTO @it (po_item_id, origin_country, batch_no, received_qty, rejected_qty, location_id)
    SELECT TRY_CONVERT(UNIQUEIDENTIFIER, po_item_id),
           CASE WHEN LEN(origin_country) = 2 THEN origin_country END,
           CASE WHEN LEN(batch_no) BETWEEN 1 AND 30 THEN batch_no END,
           TRY_CONVERT(DECIMAL(12,2), received_qty),
           ISNULL(TRY_CONVERT(DECIMAL(12,2), rejected_qty), 0),
           TRY_CONVERT(UNIQUEIDENTIFIER, location_id)
    FROM OPENJSON(@items) WITH (
        po_item_id     NVARCHAR(50) '$.po_item_id',
        origin_country NVARCHAR(10) '$.origin_country',
        batch_no       NVARCHAR(50) '$.batch_no',
        received_qty   NVARCHAR(30) '$.received_qty',
        rejected_qty   NVARCHAR(30) '$.rejected_qty',
        location_id    NVARCHAR(50) '$.location_id');

    UPDATE t SET material_id = poi.material_id
    FROM @it t JOIN garment.purchase_order_items poi ON poi.id = t.po_item_id AND poi.po_id = @po_id;

    IF NOT EXISTS (SELECT 1 FROM @it)
       OR EXISTS (SELECT 1 FROM @it
                  WHERE material_id IS NULL                       -- item bukan milik PO ini
                     OR batch_no IS NULL OR origin_country IS NULL
                     OR NOT EXISTS (SELECT 1 FROM garment.countries c WHERE c.country_code = origin_country)
                     OR received_qty IS NULL OR received_qty <= 0
                     OR rejected_qty < 0 OR rejected_qty > received_qty
                     OR NOT EXISTS (SELECT 1 FROM garment.rack_locations r
                                    WHERE r.id = location_id AND r.warehouse_id = @warehouse_id))
    BEGIN SET @result = 'INVALID_ITEMS'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.material_receipts (po_id, warehouse_id, received_by, supplier_delivery_note_no, arrival_date)
        OUTPUT inserted.id INTO @new
        VALUES (@po_id, @warehouse_id, @employee_id, @supplier_delivery_note_no, @arrival_date);
        SELECT @receipt_id = id FROM @new;

        INSERT INTO garment.material_receipt_items (receipt_id, po_item_id, origin_country, batch_no, received_qty, rejected_qty)
        SELECT @receipt_id, po_item_id, origin_country, batch_no, received_qty, rejected_qty
        FROM @it;

        -- masukkan jumlah yang diterima baik ke stok
        DECLARE @n INT = 1, @max INT = (SELECT MAX(row_no) FROM @it),
                @loc UNIQUEIDENTIFIER, @mat UNIQUEIDENTIFIER, @batch VARCHAR(30),
                @good DECIMAL(12,2), @mv UNIQUEIDENTIFIER, @mv_result VARCHAR(20);

        WHILE @n <= @max
        BEGIN
            SELECT @loc = location_id, @mat = material_id, @batch = batch_no,
                   @good = received_qty - rejected_qty
            FROM @it WHERE row_no = @n;

            IF @good > 0
            BEGIN
                EXEC garment.sp_record_stock_movement
                     @movement_type = 'MASUK', @to_location_id = @loc, @material_id = @mat,
                     @batch_no = @batch, @qty = @good,
                     @reference_type = 'PENERIMAAN', @reference_no = @supplier_delivery_note_no,
                     @employee_id = @employee_id,
                     @movement_id = @mv OUTPUT, @result = @mv_result OUTPUT;

                IF @mv_result <> 'SUCCESS'
                BEGIN
                    SET @result = 'INVALID_ITEMS';
                    IF @own_tran = 1 ROLLBACK TRANSACTION;
                    RETURN;
                END;
            END;
            SET @n += 1;
        END;

        -- status PO: SELESAI bila semua item sudah terpenuhi
        UPDATE garment.purchase_orders
        SET status = CASE WHEN NOT EXISTS (
                         SELECT 1
                         FROM garment.purchase_order_items poi
                         WHERE poi.po_id = @po_id
                           AND poi.ordered_qty > ISNULL((SELECT SUM(ri.received_qty - ri.rejected_qty)
                                                         FROM garment.material_receipt_items ri
                                                         WHERE ri.po_item_id = poi.id), 0))
                          THEN 'SELESAI' ELSE 'DITERIMA_SEBAGIAN' END
        WHERE id = @po_id;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = 'SUCCESS';
    END TRY
    BEGIN CATCH
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =====================================================================
   4. TRIGGERS
   ===================================================================== */

/* ---------- trg_materials_lock (RB-67, ERR-BHN-01) ----------
   Bahan style tidak boleh ditambah/diubah selama style punya SPK
   MENUNGGU_PERSETUJUAN atau DISETUJUI. */
CREATE OR ALTER TRIGGER garment.trg_materials_lock
ON garment.order_materials
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted i WHERE garment.fn_material_locked(i.order_detail_id) = 1)
       OR EXISTS (SELECT 1 FROM deleted d WHERE garment.fn_material_locked(d.order_detail_id) = 1)
        THROW 51001, 'ERR-BHN-01', 1;
END;
GO

/* ---------- trg_no_delete_transactions (RB-57) untuk tabel C ----------
   SQL Server memerlukan satu trigger per tabel, jadi namanya
   trg_no_delete_<nama tabel>. Semua menolak DELETE dengan pesan yang sama. */
CREATE OR ALTER TRIGGER garment.trg_no_delete_spk ON garment.spk INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_spk_sizes ON garment.spk_sizes INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_production_progress ON garment.production_progress INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_qc_results ON garment.qc_results INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_qc_defects ON garment.qc_defects INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_order_materials ON garment.order_materials INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_material_usages ON garment.material_usages INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_purchase_orders ON garment.purchase_orders INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_purchase_order_items ON garment.purchase_order_items INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_material_receipts ON garment.material_receipts INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_material_receipt_items ON garment.material_receipt_items INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_import_documents ON garment.import_documents INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_stock_movements ON garment.stock_movements INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_stock_counts ON garment.stock_counts INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_maintenances ON garment.maintenances INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 51002, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO