USE solaris_db;
GO

/* ============================================================
   1. FUNCTIONS
   ============================================================ */

-- fn_next_order_code
CREATE OR ALTER FUNCTION garment.fn_next_order_code (@at DATE)
RETURNS CHAR(12)
AS
BEGIN
    RETURN CAST(app.fn_next_doc_no('ORD', @at) AS CHAR(12));
END;
GO

-- fn_next_item_code
CREATE OR ALTER FUNCTION garment.fn_next_item_code (@buyer_id UNIQUEIDENTIFIER, @type_code CHAR(2))
RETURNS VARCHAR(12)
AS
BEGIN
    DECLARE @prefix CHAR(3), @max INT;

    IF NOT EXISTS (SELECT 1 FROM garment.product_types WHERE type_code = @type_code) RETURN NULL;

    IF @buyer_id IS NULL
        SET @prefix = 'GEN';
    ELSE
        SELECT @prefix = buyer_code FROM garment.buyers WHERE id = @buyer_id;

    IF @prefix IS NULL RETURN NULL;

    SELECT @max = MAX(TRY_CAST(RIGHT(item_code, 4) AS INT))
    FROM garment.items
    WHERE item_code LIKE @prefix + '-%';

    SET @max = ISNULL(@max, 0) + 1;
    IF @max > 9999 RETURN NULL;

    RETURN @prefix + '-' + @type_code + '-' + RIGHT('000' + CAST(@max AS VARCHAR(4)), 4);
END;
GO

-- fn_cancellation_penalty
CREATE OR ALTER FUNCTION garment.fn_cancellation_penalty (@order_id UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
    WITH o AS (
        SELECT id, level_code FROM garment.orders WHERE id = @order_id
    ),
    tv AS (
        SELECT CAST(SUM((z.qty - z.cancelled_qty) * d.unit_price * (1 - d.discount_pct / 100.0)) AS DECIMAL(16,2)) AS total_value
        FROM garment.order_details d
        JOIN garment.order_detail_sizes z ON z.order_detail_id = d.id
        WHERE d.order_id = @order_id
    ),
    dp AS (
        SELECT SUM(p.amount) AS dp_paid
        FROM garment.payments p
        JOIN garment.sales_invoices i ON i.id = p.invoice_id
        WHERE i.order_id = @order_id AND i.invoice_type = 'DP' AND p.status = 'BERHASIL'
    )
    SELECT TOP 1
        o.id AS order_id,
        o.level_code,
        st.stage_code AS stage_code_at_request,
        cp.id AS policy_id,
        cp.penalty_pct,
        cp.down_payment_refund_pct,
        cp.material_owned_by_buyer,
        ISNULL(tv.total_value, 0) AS total_value,
        ISNULL(dp.dp_paid, 0) AS dp_paid,
        CAST(ISNULL(tv.total_value, 0) * ISNULL(cp.penalty_pct, 0) / 100 AS DECIMAL(16,2)) AS penalty_amount,
        CAST(ISNULL(dp.dp_paid, 0) * ISNULL(cp.down_payment_refund_pct, 0) / 100 AS DECIMAL(16,2)) AS refund_amount
    FROM o
    CROSS JOIN tv
    CROSS JOIN dp
    OUTER APPLY (
        SELECT TOP 1 pp.stage_code
        FROM garment.production_progress pp
        JOIN garment.spk s ON s.id = pp.spk_id
        JOIN garment.order_details d ON d.id = s.order_detail_id
        JOIN garment.production_stages g ON g.stage_code = pp.stage_code
        WHERE d.order_id = @order_id AND pp.qty_done > 0
        ORDER BY g.[sequence] DESC
    ) st
    LEFT JOIN garment.cancellation_policies cp
           ON cp.level_code = o.level_code
          AND (cp.stage_code = st.stage_code OR (cp.stage_code IS NULL AND st.stage_code IS NULL))
          AND cp.valid_from <= CAST(SYSDATETIME() AS DATE)
          AND (cp.valid_until IS NULL OR cp.valid_until >= CAST(SYSDATETIME() AS DATE))
    ORDER BY cp.valid_from DESC;
GO

/* ============================================================
   2. VIEWS
   ============================================================ */

-- v_order_summary
CREATE OR ALTER VIEW garment.v_order_summary
AS
SELECT o.id AS order_id,
        o.order_code,
        o.order_date,
        o.deadline,
        o.finish_date,
        o.status,
        o.level_code,
        o.scheme,
        o.currency,
        o.exchange_rate,
        o.reject_limit_pct,
        o.is_at_risk,
        o.is_over_reject,
        o.factory_id,
        b.id AS buyer_id,
        b.buyer_code,
        b.buyer_name,
        o.handled_by,
        e.full_name AS handled_by_name,
        ISNULL(x.style_count, 0) AS style_count,
        ISNULL(x.total_qty, 0) AS total_qty,
        ISNULL(x.cancelled_qty, 0) AS cancelled_qty,
        ISNULL(x.total_value, 0) AS total_value,
        ISNULL(sh.shipped_qty, 0) AS shipped_qty,
        ISNULL(x.total_qty, 0) - ISNULL(x.cancelled_qty, 0) - ISNULL(sh.shipped_qty, 0) AS remaining_shipment,
        o.created_at
FROM garment.orders o
JOIN garment.buyers b ON b.id = o.buyer_id
JOIN garment.employees e ON e.id = o.handled_by
LEFT JOIN (
    SELECT d.order_id,
           COUNT(DISTINCT d.id) AS style_count,
           SUM(z.qty) AS total_qty,
           SUM(z.cancelled_qty) AS cancelled_qty,
           CAST(SUM((z.qty - z.cancelled_qty) * d.unit_price * (1 - d.discount_pct / 100.0)) AS DECIMAL(16,2)) AS total_value
    FROM garment.order_details d
    JOIN garment.order_detail_sizes z ON z.order_detail_id = d.id
    GROUP BY d.order_id
) x ON x.order_id = o.id
LEFT JOIN (
    SELECT d.order_id, SUM(si.qty) AS shipped_qty
    FROM garment.shipment_items si
    JOIN garment.order_details d ON d.id = si.order_detail_id
    GROUP BY d.order_id
) sh ON sh.order_id = o.id;
GO

-- v_price_history
CREATE OR ALTER VIEW garment.v_price_history
AS
SELECT i.id AS item_id,
        i.item_code,
        i.item_name,
        i.buyer_style_name,
        b.id AS buyer_id,
        b.buyer_name,
        o.id AS order_id,
        o.order_code,
        o.order_date,
        o.status AS order_status,
        o.currency,
        d.id AS order_detail_id,
        d.color,
        d.unit_price,
        d.discount_pct,
        rm.material_name,
        om.material_price
FROM garment.order_details d
JOIN garment.orders o ON o.id = d.order_id
JOIN garment.items i ON i.id = d.item_id
JOIN garment.buyers b ON b.id = o.buyer_id
LEFT JOIN garment.order_materials om ON om.order_detail_id = d.id
LEFT JOIN garment.raw_materials rm ON rm.id = om.material_id;
GO

-- v_dashboard_orders
CREATE OR ALTER VIEW garment.v_dashboard_orders
AS
SELECT s.order_id,
        s.order_code,
        s.buyer_name,
        s.deadline,
        s.status,
        CAST(ISNULL(f.completion_pct, 0) AS DECIMAL(5,2)) AS completion_pct,
        CAST(ISNULL(f.time_pct, 0) AS DECIMAL(5,2)) AS time_pct,
        CAST(ISNULL(f.reject_pct, 0) AS DECIMAL(5,2)) AS reject_pct,
        s.is_at_risk,
        s.is_over_reject,
        s.remaining_shipment
FROM garment.v_order_summary s
OUTER APPLY (
    SELECT AVG(garment.fn_detail_completion_pct(d.id)) AS completion_pct,
           MAX(garment.fn_time_elapsed_pct(d.id)) AS time_pct,
           MAX(garment.fn_reject_pct(d.id)) AS reject_pct
    FROM garment.order_details d
    WHERE d.order_id = s.order_id
) f
WHERE s.status NOT IN ('DITOLAK', 'DITARIK');
GO

-- v_shipment_history
CREATE OR ALTER VIEW garment.v_shipment_history
AS
SELECT sh.id AS shipment_id,
        sh.delivery_note_no,
        sh.ship_date,
        sh.status AS shipment_status,
        sh.destination_address,
        sh.estimated_arrival,
        sh.arrival_date,
        ex.expedition_name,
        o.id AS order_id,
        o.order_code,
        b.buyer_name,
        si.line_no,
        i.item_code,
        i.item_name,
        i.buyer_style_name,
        d.color,
        si.size,
        si.qty,
        si.carton_no
FROM garment.shipments sh
JOIN garment.orders o ON o.id = sh.order_id
JOIN garment.buyers b ON b.id = o.buyer_id
JOIN garment.expeditions ex ON ex.id = sh.expedition_id
JOIN garment.shipment_items si ON si.shipment_id = sh.id
JOIN garment.order_details d ON d.id = si.order_detail_id
JOIN garment.items i ON i.id = d.item_id;
GO

/* ============================================================
   3. STORED PROCEDURES
   ============================================================ */

-- sp_create_order
CREATE OR ALTER PROCEDURE garment.sp_create_order
    @employee_id UNIQUEIDENTIFIER,
    @payload NVARCHAR(MAX),
    @order_id UNIQUEIDENTIFIER OUTPUT,
    @order_code CHAR(12) OUTPUT,
    @result VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @order_id = NULL, @order_code = NULL, @result = NULL;

    IF @payload IS NULL OR ISJSON(@payload) <> 1 BEGIN SET @result = 'INVALID_JSON'; RETURN; END;

    -- baca header
    DECLARE @factory_id UNIQUEIDENTIFIER, @buyer_name NVARCHAR(100);
    DECLARE @buyer_id UNIQUEIDENTIFIER = TRY_CONVERT(UNIQUEIDENTIFIER, JSON_VALUE(@payload, '$.buyer_id')),
            @level_code VARCHAR(13) = ISNULL(JSON_VALUE(@payload, '$.level_code'), 'DOMESTIK'),
            @deadline DATE = TRY_CONVERT(DATE, JSON_VALUE(@payload, '$.deadline')),
            @scheme VARCHAR(3) = JSON_VALUE(@payload, '$.scheme'),
            @reject_limit_pct DECIMAL(5,2) = TRY_CONVERT(DECIMAL(5,2), JSON_VALUE(@payload, '$.reject_limit_pct')),
            @late_penalty NVARCHAR(500) = LEFT(JSON_VALUE(@payload, '$.late_penalty'), 500),
            @buyer_po_no VARCHAR(30) = LEFT(JSON_VALUE(@payload, '$.buyer_po_no'), 30),
            @currency CHAR(3) = ISNULL(JSON_VALUE(@payload, '$.currency'), 'IDR'),
            @exchange_rate DECIMAL(12,4) = ISNULL(TRY_CONVERT(DECIMAL(12,4), JSON_VALUE(@payload, '$.exchange_rate')), 1),
            @incoterm VARCHAR(3) = JSON_VALUE(@payload, '$.incoterm'),
            @dest_country CHAR(2) = JSON_VALUE(@payload, '$.destination_country'),
            @dest_port NVARCHAR(60) = LEFT(JSON_VALUE(@payload, '$.destination_port'), 60),
            @notes NVARCHAR(500) = LEFT(JSON_VALUE(@payload, '$.notes'), 500),
            @today DATE = CAST(SYSDATETIME() AS DATE);

    SELECT @factory_id = factory_id FROM garment.employees WHERE id = @employee_id AND is_active = 1;
    IF @factory_id IS NULL BEGIN SET @result = 'INVALID_EMPLOYEE'; RETURN; END;

    SELECT @buyer_name = buyer_name FROM garment.buyers WHERE id = @buyer_id;
    IF @buyer_name IS NULL BEGIN SET @result = 'INVALID_BUYER'; RETURN; END;

    IF NOT EXISTS (SELECT 1 FROM garment.order_levels WHERE level_code = @level_code)
        BEGIN SET @result = 'INVALID_LEVEL'; RETURN; END;

    IF @deadline IS NULL OR @deadline < @today
       OR @scheme IS NULL OR @scheme NOT IN ('CMT', 'FOB')
       OR @reject_limit_pct IS NULL OR @reject_limit_pct NOT BETWEEN 0 AND 100
       OR LEN(LTRIM(RTRIM(ISNULL(@late_penalty, N'')))) = 0
       OR @exchange_rate <= 0
        BEGIN SET @result = 'INVALID_HEADER'; RETURN; END;

    IF @level_code = 'INTERNASIONAL'
       AND (JSON_VALUE(@payload, '$.currency') IS NULL
            OR JSON_VALUE(@payload, '$.exchange_rate') IS NULL
            OR @incoterm IS NULL
            OR @dest_country IS NULL OR NOT EXISTS (SELECT 1 FROM garment.countries WHERE country_code = @dest_country)
            OR LEN(LTRIM(RTRIM(ISNULL(@dest_port, N'')))) = 0)
        BEGIN SET @result = 'INTL_FIELDS_REQUIRED'; RETURN; END;

    -- baca style dan ukuran
    DECLARE @styles TABLE (
        idx INT PRIMARY KEY,
        item_id UNIQUEIDENTIFIER NULL,
        type_code CHAR(2) NULL,
        item_name NVARCHAR(100) NULL,
        buyer_style_name NVARCHAR(100) NULL,
        buyer_style_code VARCHAR(30) NULL,
        color NVARCHAR(50) NULL,
        unit_price DECIMAL(16,2) NULL,
        discount_pct DECIMAL(5,2) NULL,
        sizes NVARCHAR(MAX) NULL,
        resolved_item_id UNIQUEIDENTIFIER NULL,
        detail_id UNIQUEIDENTIFIER NULL
    );
    DECLARE @sizes TABLE (idx INT NOT NULL, size VARCHAR(10) NULL, qty INT NULL);

    INSERT INTO @styles (idx, item_id, type_code, item_name, buyer_style_name, buyer_style_code,
                         color, unit_price, discount_pct, sizes)
    SELECT CAST(s.[key] AS INT),
           TRY_CONVERT(UNIQUEIDENTIFIER, JSON_VALUE(s.value, '$.item_id')),
           JSON_VALUE(s.value, '$.type_code'),
           LEFT(JSON_VALUE(s.value, '$.item_name'), 100),
           LEFT(JSON_VALUE(s.value, '$.buyer_style_name'), 100),
           LEFT(JSON_VALUE(s.value, '$.buyer_style_code'), 30),
           LEFT(JSON_VALUE(s.value, '$.color'), 50),
           TRY_CONVERT(DECIMAL(16,2), JSON_VALUE(s.value, '$.unit_price')),
           ISNULL(TRY_CONVERT(DECIMAL(5,2), JSON_VALUE(s.value, '$.discount_pct')), 0),
           JSON_QUERY(s.value, '$.sizes')
    FROM OPENJSON(@payload, '$.styles') s;

    IF NOT EXISTS (SELECT 1 FROM @styles) BEGIN SET @result = 'NO_STYLE'; RETURN; END;

    UPDATE st SET resolved_item_id = i.id, type_code = i.type_code
    FROM @styles st
    JOIN garment.items i ON i.id = st.item_id
    WHERE i.status = 'AKTIF' AND (i.buyer_id IS NULL OR i.buyer_id = @buyer_id);

    IF EXISTS (SELECT 1 FROM @styles WHERE item_id IS NOT NULL AND resolved_item_id IS NULL)
       OR EXISTS (SELECT 1 FROM @styles s WHERE s.item_id IS NULL
                  AND (s.type_code IS NULL
                       OR NOT EXISTS (SELECT 1 FROM garment.product_types p WHERE p.type_code = s.type_code)
                       OR COALESCE(s.item_name, s.buyer_style_name) IS NULL))
       OR EXISTS (SELECT 1 FROM @styles WHERE LEN(LTRIM(RTRIM(ISNULL(color, N'')))) = 0
                  OR unit_price IS NULL OR unit_price <= 0
                  OR discount_pct NOT BETWEEN 0 AND 100)
       -- style ganda (barang + warna sama) dalam satu order
       OR EXISTS (SELECT 1 FROM @styles
                  GROUP BY COALESCE(CAST(item_id AS NVARCHAR(36)), type_code + N'|' + ISNULL(buyer_style_name, item_name)), color
                  HAVING COUNT(*) > 1)
        BEGIN SET @result = 'INVALID_STYLE'; RETURN; END;

    IF EXISTS (SELECT 1 FROM @styles WHERE sizes IS NULL OR ISJSON(sizes) <> 1)
        BEGIN SET @result = 'INVALID_SIZES'; RETURN; END;

    INSERT INTO @sizes (idx, size, qty)
    SELECT st.idx, LEFT(z.size, 10), TRY_CONVERT(INT, z.qty)
    FROM @styles st
    CROSS APPLY OPENJSON(st.sizes) WITH (size NVARCHAR(50) '$.size', qty NVARCHAR(20) '$.qty') z;

    IF EXISTS (SELECT 1 FROM @styles st WHERE NOT EXISTS (SELECT 1 FROM @sizes z WHERE z.idx = st.idx))
       OR EXISTS (SELECT 1 FROM @sizes WHERE LEN(LTRIM(RTRIM(ISNULL(size, '')))) = 0 OR qty IS NULL OR qty <= 0)
       OR EXISTS (SELECT 1 FROM @sizes GROUP BY idx, size HAVING COUNT(*) > 1)
        BEGIN SET @result = 'INVALID_SIZES'; RETURN; END;

    -- simpan
    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        DECLARE @lock INT,
                @like_ord VARCHAR(20) = 'ORD-' + RIGHT(CAST(YEAR(@today) AS VARCHAR(4)), 2)
                                        + RIGHT('0' + CAST(MONTH(@today) AS VARCHAR(2)), 2) + '-%';
        SELECT @lock = COUNT(*) FROM garment.orders WITH (UPDLOCK, HOLDLOCK) WHERE order_code LIKE @like_ord;
        SELECT @lock = COUNT(*) FROM garment.items WITH (UPDLOCK, HOLDLOCK) WHERE buyer_id = @buyer_id;

        SET @order_code = garment.fn_next_order_code(@today);
        IF @order_code IS NULL THROW 50060, 'ERR-ORD-06: nomor order bulan ini habis (lebih dari 999).', 1;

        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.orders (order_code, buyer_id, factory_id, level_code, handled_by, buyer_po_no,
                                    order_date, deadline, scheme, reject_limit_pct, late_penalty,
                                    currency, exchange_rate, incoterm, destination_country, destination_port,
                                    notes, status)
        OUTPUT inserted.id INTO @new
        VALUES (@order_code, @buyer_id, @factory_id, @level_code, @employee_id, @buyer_po_no,
                @today, @deadline, @scheme, @reject_limit_pct, @late_penalty,
                @currency, @exchange_rate, @incoterm, @dest_country, @dest_port,
                @notes, 'MENUNGGU_PERSETUJUAN');
        SELECT @order_id = id FROM @new;

        DECLARE @idx INT, @type CHAR(2), @iname NVARCHAR(100), @sname NVARCHAR(100), @scode VARCHAR(30),
                @found UNIQUEIDENTIFIER, @icode VARCHAR(12);
        DECLARE c CURSOR LOCAL FAST_FORWARD FOR
            SELECT idx, type_code, COALESCE(item_name, buyer_style_name), buyer_style_name, buyer_style_code
            FROM @styles WHERE resolved_item_id IS NULL ORDER BY idx;
        OPEN c;
        FETCH NEXT FROM c INTO @idx, @type, @iname, @sname, @scode;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @found = NULL;
            IF @sname IS NOT NULL
                SELECT TOP 1 @found = id FROM garment.items
                WHERE buyer_id = @buyer_id AND type_code = @type AND buyer_style_name = @sname AND status = 'AKTIF'
                ORDER BY created_at DESC;

            IF @found IS NULL
            BEGIN
                SET @icode = garment.fn_next_item_code(@buyer_id, @type);
                IF @icode IS NULL THROW 50061, 'ERR-ORD-07: kode barang tidak dapat dibuat.', 1;
                DELETE FROM @new;
                INSERT INTO garment.items (item_code, buyer_id, type_code, item_name, buyer_style_name, buyer_style_code)
                OUTPUT inserted.id INTO @new
                VALUES (@icode, @buyer_id, @type, @iname, @sname, @scode);
                SELECT @found = id FROM @new;
            END;

            UPDATE @styles SET resolved_item_id = @found WHERE idx = @idx;
            FETCH NEXT FROM c INTO @idx, @type, @iname, @sname, @scode;
        END;
        CLOSE c;
        DEALLOCATE c;

        -- detail per style + warna
        UPDATE @styles SET detail_id = NEWID();
        INSERT INTO garment.order_details (id, order_id, item_id, color, unit_price, discount_pct)
        SELECT detail_id, @order_id, resolved_item_id, color, unit_price, discount_pct FROM @styles;

        INSERT INTO garment.order_detail_sizes (order_detail_id, size, variant_id, qty)
        SELECT st.detail_id, z.size,
               (SELECT TOP 1 v.id FROM garment.item_variants v
                WHERE v.item_id = st.resolved_item_id AND v.size = z.size AND v.color = st.color),
               z.qty
        FROM @sizes z
        JOIN @styles st ON st.idx = z.idx;

        -- RB-16: riwayat status + notifikasi N-01
        INSERT INTO garment.order_status_history (order_id, status, changed_by)
        VALUES (@order_id, 'MENUNGGU_PERSETUJUAN', @employee_id);

        DECLARE @msg NVARCHAR(300) = CONCAT(N'Order ', @order_code, N' dari ', @buyer_name, N' menunggu persetujuan.'),
                @link VARCHAR(200) = CONCAT('/orders/', CAST(@order_id AS VARCHAR(36)));
        EXEC garment.sp_notify_roles
             @event_code = 'N-01', @role_codes = 'PIMPINAN', @message = @msg, @link = @link, @dedup_key = NULL;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = 'SUCCESS';
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'c') >= 0 BEGIN CLOSE c; DEALLOCATE c; END;
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- sp_change_order_status
CREATE OR ALTER PROCEDURE garment.sp_change_order_status
    @order_id UNIQUEIDENTIFIER,
    @action VARCHAR(10),
    @employee_id UNIQUEIDENTIFIER,
    @reason NVARCHAR(500) = NULL,
    @result VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @result = NULL;

    IF @action NOT IN ('APPROVE', 'REJECT', 'WITHDRAW') BEGIN SET @result = 'INVALID'; RETURN; END;
    IF @action IN ('REJECT', 'WITHDRAW') AND LEN(LTRIM(RTRIM(ISNULL(@reason, N'')))) = 0
        BEGIN SET @result = 'REASON_REQUIRED'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @status VARCHAR(20), @code CHAR(12), @new_status VARCHAR(20),
            @msg NVARCHAR(300), @link VARCHAR(200);

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        SELECT @status = status, @code = order_code
        FROM garment.orders WITH (UPDLOCK, ROWLOCK)
        WHERE id = @order_id;

        IF @status IS NULL OR @status <> 'MENUNGGU_PERSETUJUAN'
        BEGIN
            SET @result = CASE WHEN @status IS NULL THEN 'NOT_FOUND'
                               WHEN @action = 'WITHDRAW' THEN 'NOT_WITHDRAWABLE'
                               ELSE 'ALREADY_DECIDED' END;
            IF @own_tran = 1 ROLLBACK TRANSACTION;
            RETURN;
        END;

        SET @new_status = CASE @action WHEN 'APPROVE' THEN 'DISETUJUI'
                                       WHEN 'REJECT' THEN 'DITOLAK'
                                       ELSE 'DITARIK' END;

        UPDATE garment.orders SET status = @new_status WHERE id = @order_id;

        INSERT INTO garment.order_status_history (order_id, status, changed_by, reason)
        VALUES (@order_id, @new_status, @employee_id, NULLIF(LTRIM(RTRIM(@reason)), N''));

        SET @link = CONCAT('/orders/', CAST(@order_id AS VARCHAR(36)));
        IF @action IN ('APPROVE', 'REJECT')
        BEGIN
            SET @msg = LEFT(CONCAT(N'Order ', @code, CASE @action WHEN 'APPROVE' THEN N' disetujui.'
                                                              ELSE CONCAT(N' ditolak. Alasan: ', @reason) END), 300);
            EXEC garment.sp_notify_roles
                 @event_code = 'N-03', @role_codes = 'MARKETING,PPIC', @message = @msg, @link = @link, @dedup_key = NULL;
        END
        ELSE
        BEGIN
            SET @msg = LEFT(CONCAT(N'Pengajuan order ', @code, N' ditarik Marketing. Alasan: ', @reason), 300);
            EXEC garment.sp_notify_roles
                 @event_code = 'N-04', @role_codes = 'PIMPINAN', @message = @msg, @link = @link, @dedup_key = NULL;
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

-- sp_cancel_order
CREATE OR ALTER PROCEDURE garment.sp_cancel_order
    @order_id UNIQUEIDENTIFIER,
    @employee_id UNIQUEIDENTIFIER,
    @reason NVARCHAR(500),
    @requested_by_party VARCHAR(10),
    @cancellation_id UNIQUEIDENTIFIER OUTPUT,
    @penalty_amount DECIMAL(16,2) OUTPUT,
    @refund_amount DECIMAL(16,2) OUTPUT,
    @result VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @cancellation_id = NULL, @penalty_amount = NULL, @refund_amount = NULL, @result = NULL;

    IF LEN(LTRIM(RTRIM(ISNULL(@reason, N'')))) = 0 BEGIN SET @result = 'REASON_REQUIRED'; RETURN; END;
    IF ISNULL(@requested_by_party, '') NOT IN ('BUYER', 'PERUSAHAAN') BEGIN SET @result = 'INVALID'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @status VARCHAR(20), @code CHAR(12), @policy_id UNIQUEIDENTIFIER, @stage VARCHAR(10),
            @today DATE = CAST(SYSDATETIME() AS DATE), @msg NVARCHAR(300), @link VARCHAR(200);

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        SELECT @status = status, @code = order_code
        FROM garment.orders WITH (UPDLOCK, ROWLOCK)
        WHERE id = @order_id;

        SELECT @policy_id = policy_id, @stage = stage_code_at_request,
               @penalty_amount = penalty_amount, @refund_amount = refund_amount
        FROM garment.fn_cancellation_penalty(@order_id);

        IF @status IS NULL OR @status NOT IN ('DISETUJUI', 'DALAM_PRODUKSI') OR @policy_id IS NULL
        BEGIN
            SET @result = CASE WHEN @status IS NULL THEN 'NOT_FOUND'
                               WHEN @status NOT IN ('DISETUJUI', 'DALAM_PRODUKSI') THEN 'NOT_CANCELLABLE'
                               ELSE 'NO_POLICY' END;
            SELECT @penalty_amount = NULL, @refund_amount = NULL;
            IF @own_tran = 1 ROLLBACK TRANSACTION;
            RETURN;
        END;

        UPDATE garment.orders SET status = 'DIBATALKAN' WHERE id = @order_id;

        INSERT INTO garment.order_status_history (order_id, status, changed_by, reason)
        VALUES (@order_id, 'DIBATALKAN', @employee_id, @reason);

        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.order_cancellations (order_id, order_detail_id, policy_id, stage_code_at_request,
                                                 requested_by_party, reason, penalty_amount, refund_amount,
                                                 status, requested_by, approved_by, requested_date, approved_date)
        OUTPUT inserted.id INTO @new
        VALUES (@order_id, NULL, @policy_id, @stage,
                @requested_by_party, @reason, @penalty_amount, @refund_amount,
                'DISETUJUI', @employee_id, @employee_id, @today, @today);
        SELECT @cancellation_id = id FROM @new;

        SET @msg = LEFT(CONCAT(N'Order ', @code, N' dibatalkan. Alasan: ', @reason), 300);
        SET @link = CONCAT('/orders/', CAST(@order_id AS VARCHAR(36)));
        EXEC garment.sp_notify_roles
             @event_code = 'N-06', @role_codes = 'MARKETING,PPIC,SPV,QC', @message = @msg, @link = @link, @dedup_key = NULL;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = 'SUCCESS';
    END TRY
    BEGIN CATCH
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- sp_record_shipment
CREATE OR ALTER PROCEDURE garment.sp_record_shipment
    @order_id UNIQUEIDENTIFIER,
    @employee_id UNIQUEIDENTIFIER,
    @ship_date DATE,
    @expedition_id UNIQUEIDENTIFIER,
    @destination_address NVARCHAR(200),
    @items NVARCHAR(MAX),
    @route_id UNIQUEIDENTIFIER = NULL,
    @vehicle_id UNIQUEIDENTIFIER = NULL,
    @estimated_arrival DATE = NULL,
    @package_count INT = NULL,
    @total_weight_kg DECIMAL(10,2) = NULL,
    @volume_m3 DECIMAL(10,2) = NULL,
    @shipping_cost DECIMAL(16,2) = NULL,
    @shipment_id UNIQUEIDENTIFIER OUTPUT,
    @delivery_note_no CHAR(11) OUTPUT,
    @result NVARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @shipment_id = NULL, @delivery_note_no = NULL, @result = NULL;

    IF @items IS NULL OR ISJSON(@items) <> 1 BEGIN SET @result = N'INVALID_JSON'; RETURN; END;
    IF @ship_date IS NULL OR LEN(LTRIM(RTRIM(ISNULL(@destination_address, N'')))) = 0
        BEGIN SET @result = N'INVALID_ITEMS'; RETURN; END;

    DECLARE @it TABLE (line_no SMALLINT, order_detail_id UNIQUEIDENTIFIER NULL, size VARCHAR(10) NULL,
                       qty INT NULL, carton_no VARCHAR(20) NULL);
    INSERT INTO @it (line_no, order_detail_id, size, qty, carton_no)
    SELECT CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS SMALLINT),
           TRY_CONVERT(UNIQUEIDENTIFIER, j.order_detail_id), LEFT(j.size, 10), TRY_CONVERT(INT, j.qty), LEFT(j.carton_no, 20)
    FROM OPENJSON(@items) WITH (order_detail_id NVARCHAR(50) '$.order_detail_id', size NVARCHAR(50) '$.size',
                                qty NVARCHAR(20) '$.qty', carton_no NVARCHAR(50) '$.carton_no') j;

    IF NOT EXISTS (SELECT 1 FROM @it)
       OR EXISTS (SELECT 1 FROM @it WHERE order_detail_id IS NULL OR size IS NULL OR qty IS NULL OR qty <= 0)
       OR EXISTS (SELECT 1 FROM @it GROUP BY order_detail_id, size HAVING COUNT(*) > 1)
       OR EXISTS (SELECT 1 FROM @it x
                  WHERE NOT EXISTS (SELECT 1 FROM garment.order_detail_sizes z
                                    JOIN garment.order_details d ON d.id = z.order_detail_id
                                    WHERE z.order_detail_id = x.order_detail_id AND z.size = x.size
                                      AND d.order_id = @order_id))
        BEGIN SET @result = N'INVALID_ITEMS'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @status VARCHAR(20), @code CHAR(12), @factory_id UNIQUEIDENTIFIER, @level VARCHAR(13),
            @coverage VARCHAR(13), @warehouse_id UNIQUEIDENTIFIER, @remaining INT,
            @bad_detail UNIQUEIDENTIFIER, @bad_size VARCHAR(10), @bad_max INT,
            @msg NVARCHAR(300), @link VARCHAR(200);

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        SELECT @status = status, @code = order_code, @factory_id = factory_id, @level = level_code
        FROM garment.orders WITH (UPDLOCK, ROWLOCK)
        WHERE id = @order_id;

        SELECT @coverage = coverage FROM garment.expeditions WHERE id = @expedition_id AND is_active = 1;

        SELECT TOP 1 @warehouse_id = id
        FROM garment.warehouses
        WHERE factory_id = @factory_id AND warehouse_type IN ('BARANG_JADI', 'CAMPURAN')
        ORDER BY CASE warehouse_type WHEN 'BARANG_JADI' THEN 0 ELSE 1 END;

        -- RB-50: per ukuran, lalu total per style
        SELECT TOP 1 @bad_detail = x.order_detail_id, @bad_size = x.size,
                     @bad_max = garment.fn_ready_to_ship(x.order_detail_id, x.size)
        FROM @it x
        WHERE x.qty > garment.fn_ready_to_ship(x.order_detail_id, x.size);

        IF @bad_detail IS NULL
            SELECT TOP 1 @bad_detail = g.order_detail_id, @bad_size = '*',
                         @bad_max = garment.fn_ready_to_ship(g.order_detail_id, NULL)
            FROM (SELECT order_detail_id, SUM(qty) AS qty FROM @it GROUP BY order_detail_id) g
            WHERE g.qty > garment.fn_ready_to_ship(g.order_detail_id, NULL);

        SET @result = CASE
            WHEN @status IS NULL THEN N'NOT_FOUND'
            WHEN @status <> 'DALAM_PRODUKSI' THEN N'ORDER_NOT_IN_PRODUCTION'
            WHEN @coverage IS NULL
                 OR (@level = 'INTERNASIONAL' AND @coverage = 'DOMESTIK')
                 OR (@level = 'DOMESTIK' AND @coverage = 'INTERNASIONAL')
                                                      THEN N'INVALID_EXPEDITION'
            WHEN @route_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM garment.routes
                                                       WHERE id = @route_id AND expedition_id = @expedition_id)
                                                      THEN N'ROUTE_MISMATCH'
            WHEN @vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM garment.vehicles
                                                         WHERE id = @vehicle_id AND status = 'TERSEDIA')
                                                      THEN N'INVALID_VEHICLE'
            WHEN @warehouse_id IS NULL THEN N'NO_WAREHOUSE'
            WHEN @bad_detail IS NOT NULL THEN CONCAT(N'EXCEEDS:', CAST(@bad_detail AS NVARCHAR(36)),
                                                                  N':', @bad_size, N':', ISNULL(@bad_max, 0))
            ELSE NULL END;

        IF @result IS NOT NULL
        BEGIN
            IF @own_tran = 1 ROLLBACK TRANSACTION;
            RETURN;
        END;

        -- nomor surat jalan (RB-52)
        DECLARE @lock INT,
                @like_sj VARCHAR(20) = 'SJ-' + RIGHT(CAST(YEAR(@ship_date) AS VARCHAR(4)), 2)
                                       + RIGHT('0' + CAST(MONTH(@ship_date) AS VARCHAR(2)), 2) + '-%';
        SELECT @lock = COUNT(*) FROM garment.shipments WITH (UPDLOCK, HOLDLOCK) WHERE delivery_note_no LIKE @like_sj;
        SET @delivery_note_no = CAST(app.fn_next_doc_no('SJ', @ship_date) AS CHAR(11));
        IF @delivery_note_no IS NULL THROW 50062, 'ERR-KRM-06: nomor surat jalan bulan ini habis (lebih dari 999).', 1;

        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.shipments (delivery_note_no, order_id, origin_warehouse_id, expedition_id, route_id,
                                       vehicle_id, recorded_by, destination_address, ship_date, estimated_arrival,
                                       package_count, total_weight_kg, volume_m3, shipping_cost)
        OUTPUT inserted.id INTO @new
        VALUES (@delivery_note_no, @order_id, @warehouse_id, @expedition_id, @route_id,
                @vehicle_id, @employee_id, @destination_address, @ship_date, @estimated_arrival,
                @package_count, @total_weight_kg, @volume_m3, @shipping_cost);
        SELECT @shipment_id = id FROM @new;

        INSERT INTO garment.shipment_items (shipment_id, line_no, order_detail_id, size, qty, carton_no)
        SELECT @shipment_id, line_no, order_detail_id, size, qty, carton_no FROM @it;

        SET @link = CONCAT('/shipments/', CAST(@shipment_id AS VARCHAR(36)));
        SET @msg = CONCAT(N'Pengiriman ', @delivery_note_no, N' untuk order ', @code, N' tercatat.');
        EXEC garment.sp_notify_roles
             @event_code = 'N-09', @role_codes = 'PIMPINAN,MARKETING', @message = @msg, @link = @link, @dedup_key = NULL;

        SELECT @remaining = SUM(z.qty - z.cancelled_qty)
                            - ISNULL((SELECT SUM(si.qty) FROM garment.shipment_items si
                                      JOIN garment.order_details d2 ON d2.id = si.order_detail_id
                                      WHERE d2.order_id = @order_id), 0)
        FROM garment.order_detail_sizes z
        JOIN garment.order_details d ON d.id = z.order_detail_id
        WHERE d.order_id = @order_id;

        IF @remaining <= 0
        BEGIN
            UPDATE garment.orders SET status = 'SELESAI', finish_date = @ship_date WHERE id = @order_id;
            INSERT INTO garment.order_status_history (order_id, status, changed_by)
            VALUES (@order_id, 'SELESAI', @employee_id);

            SET @link = CONCAT('/orders/', CAST(@order_id AS VARCHAR(36)));
            SET @msg = CONCAT(N'Order ', @code, N' selesai: seluruh barang sudah dikirim.');
            EXEC garment.sp_notify_roles
                 @event_code = 'N-09', @role_codes = 'PIMPINAN,MARKETING', @message = @msg, @link = @link,
                 @dedup_key = NULL;
        END;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = N'SUCCESS';
    END TRY
    BEGIN CATCH
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- sp_issue_invoice
CREATE OR ALTER PROCEDURE garment.sp_issue_invoice
    @order_id UNIQUEIDENTIFIER,
    @invoice_type VARCHAR(9),
    @subtotal DECIMAL(16,2) = NULL,
    @discount DECIMAL(16,2) = 0,
    @vat_amount DECIMAL(16,2) = NULL,
    @due_date DATE = NULL,
    @shipment_id UNIQUEIDENTIFIER = NULL,
    @cancellation_id UNIQUEIDENTIFIER = NULL,
    @invoice_id UNIQUEIDENTIFIER OUTPUT,
    @invoice_no CHAR(12) OUTPUT,
    @result VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @invoice_id = NULL, @invoice_no = NULL, @result = NULL;

    DECLARE @status VARCHAR(20), @currency CHAR(3), @rate DECIMAL(12,4), @vat_treatment VARCHAR(5),
            @term SMALLINT, @today DATE = CAST(SYSDATETIME() AS DATE), @vat_pct DECIMAL(5,2);

    SELECT @status = o.status, @currency = o.currency, @rate = o.exchange_rate,
           @vat_treatment = l.vat_treatment, @term = b.payment_term_days
    FROM garment.orders o
    JOIN garment.order_levels l ON l.level_code = o.level_code
    JOIN garment.buyers b ON b.id = o.buyer_id
    WHERE o.id = @order_id;

    IF @status IS NULL BEGIN SET @result = 'NOT_FOUND'; RETURN; END;
    IF ISNULL(@invoice_type, '') NOT IN ('DP', 'PELUNASAN', 'DENDA') BEGIN SET @result = 'INVALID_TYPE'; RETURN; END;

    IF @invoice_type = 'DENDA'
    BEGIN
        IF @status <> 'DIBATALKAN'
           OR NOT EXISTS (SELECT 1 FROM garment.order_cancellations
                          WHERE id = @cancellation_id AND order_id = @order_id AND status = 'DISETUJUI')
            BEGIN SET @result = 'INVALID_CANCELLATION'; RETURN; END;
        IF @subtotal IS NULL
            SELECT @subtotal = penalty_amount FROM garment.order_cancellations WHERE id = @cancellation_id;
        SET @vat_amount = ISNULL(@vat_amount, 0);
    END
    ELSE
    BEGIN
        IF @status NOT IN ('DISETUJUI', 'DALAM_PRODUKSI', 'SELESAI') BEGIN SET @result = 'ORDER_NOT_BILLABLE'; RETURN; END;
        IF @cancellation_id IS NOT NULL BEGIN SET @result = 'INVALID_CANCELLATION'; RETURN; END;
    END;

    IF @shipment_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM garment.shipments WHERE id = @shipment_id AND order_id = @order_id)
        BEGIN SET @result = 'INVALID_SHIPMENT'; RETURN; END;

    SET @discount = ISNULL(@discount, 0);
    IF @subtotal IS NULL OR @subtotal <= 0 OR @discount < 0 OR @discount > @subtotal OR @vat_amount < 0
        BEGIN SET @result = 'INVALID_AMOUNT'; RETURN; END;

    IF @vat_amount IS NULL
    BEGIN
        IF @vat_treatment = 'PPN'
            SELECT TOP 1 @vat_pct = rate_pct FROM garment.tax_types
            WHERE tax_name = N'PPN' AND valid_from <= @today
            ORDER BY valid_from DESC;
        SET @vat_amount = CAST((@subtotal - @discount) * ISNULL(@vat_pct, 0) / 100 AS DECIMAL(16,2));
    END;

    SET @due_date = ISNULL(@due_date, DATEADD(DAY, ISNULL(@term, 0), @today));

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        DECLARE @lock INT,
                @like_inv VARCHAR(20) = 'INV-' + RIGHT(CAST(YEAR(@today) AS VARCHAR(4)), 2)
                                        + RIGHT('0' + CAST(MONTH(@today) AS VARCHAR(2)), 2) + '-%';
        SELECT @lock = COUNT(*) FROM garment.sales_invoices WITH (UPDLOCK, HOLDLOCK) WHERE invoice_no LIKE @like_inv;
        SET @invoice_no = CAST(app.fn_next_doc_no('INV', @today) AS CHAR(12));
        IF @invoice_no IS NULL THROW 50063, 'ERR-INV-01: nomor invoice bulan ini habis (lebih dari 999).', 1;

        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.sales_invoices (invoice_no, order_id, shipment_id, cancellation_id, invoice_type,
                                            currency, exchange_rate, subtotal, discount, vat_amount, due_date)
        OUTPUT inserted.id INTO @new
        VALUES (@invoice_no, @order_id, @shipment_id, @cancellation_id, @invoice_type,
                @currency, @rate, @subtotal, @discount, @vat_amount, @due_date);
        SELECT @invoice_id = id FROM @new;

        IF @own_tran = 1 COMMIT TRANSACTION;
        SET @result = 'SUCCESS';
    END TRY
    BEGIN CATCH
        IF @own_tran = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- sp_record_payment
CREATE OR ALTER PROCEDURE garment.sp_record_payment
    @bank_account_id UNIQUEIDENTIFIER,
    @amount DECIMAL(16,2),
    @payment_method VARCHAR(8),
    @reference_no VARCHAR(30),
    @paid_date DATE,
    @invoice_id UNIQUEIDENTIFIER = NULL,
    @bill_id UNIQUEIDENTIFIER = NULL,
    @cancellation_id UNIQUEIDENTIFIER = NULL,
    @currency CHAR(3) = NULL,
    @exchange_rate DECIMAL(12,4) = 1,
    @status VARCHAR(8) = 'BERHASIL',
    @payment_id UNIQUEIDENTIFIER OUTPUT,
    @result VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SELECT @payment_id = NULL, @result = NULL;

    IF (CASE WHEN @invoice_id IS NULL THEN 0 ELSE 1 END
        + CASE WHEN @bill_id IS NULL THEN 0 ELSE 1 END
        + CASE WHEN @cancellation_id IS NULL THEN 0 ELSE 1 END) <> 1
        BEGIN SET @result = 'INVALID_TARGET'; RETURN; END;

    IF @amount IS NULL OR @amount <= 0 OR ISNULL(@exchange_rate, 0) <= 0 OR @paid_date IS NULL
       OR ISNULL(@status, '') NOT IN ('BERHASIL', 'GAGAL', 'PENDING')
       OR LEN(LTRIM(RTRIM(ISNULL(@reference_no, '')))) = 0
       OR ISNULL(@payment_method, '') NOT IN ('TRANSFER', 'TT', 'LC', 'GIRO', 'TUNAI')
        BEGIN SET @result = 'INVALID_AMOUNT'; RETURN; END;

    IF NOT EXISTS (SELECT 1 FROM garment.company_bank_accounts WHERE id = @bank_account_id)
        BEGIN SET @result = 'INVALID_BANK'; RETURN; END;

    DECLARE @own_tran BIT = CASE WHEN @@TRANCOUNT = 0 THEN 1 ELSE 0 END;
    DECLARE @direction VARCHAR(6), @target_total DECIMAL(16,2), @paid DECIMAL(16,2),
            @target_status VARCHAR(11), @target_currency CHAR(3), @level VARCHAR(13);

    BEGIN TRY
        IF @own_tran = 1 BEGIN TRANSACTION;

        IF @invoice_id IS NOT NULL
        BEGIN
            SET @direction = 'MASUK';
            SELECT @target_total = i.subtotal - i.discount + i.vat_amount, @target_status = i.status,
                   @target_currency = i.currency, @level = o.level_code
            FROM garment.sales_invoices i WITH (UPDLOCK, ROWLOCK)
            JOIN garment.orders o ON o.id = i.order_id
            WHERE i.id = @invoice_id;
            SELECT @paid = ISNULL(SUM(amount), 0) FROM garment.payments
            WHERE invoice_id = @invoice_id AND status IN ('BERHASIL', 'PENDING');
        END
        ELSE IF @bill_id IS NOT NULL
        BEGIN
            SET @direction = 'KELUAR';
            SELECT @target_total = total, @target_status = status, @target_currency = currency
            FROM garment.supplier_bills WITH (UPDLOCK, ROWLOCK)
            WHERE id = @bill_id;
            SELECT @paid = ISNULL(SUM(amount), 0) FROM garment.payments
            WHERE bill_id = @bill_id AND status IN ('BERHASIL', 'PENDING');
        END
        ELSE
        BEGIN
            SET @direction = 'KELUAR';
            SELECT @target_total = c.refund_amount,
                   @target_status = CASE c.status WHEN 'DISETUJUI' THEN 'BELUM_LUNAS' ELSE 'BATAL' END,
                   @target_currency = o.currency
            FROM garment.order_cancellations c WITH (UPDLOCK, ROWLOCK)
            JOIN garment.orders o ON o.id = c.order_id
            WHERE c.id = @cancellation_id;
            SELECT @paid = ISNULL(SUM(amount), 0) FROM garment.payments
            WHERE cancellation_id = @cancellation_id AND status IN ('BERHASIL', 'PENDING');
        END;

        SET @result = CASE
            WHEN @target_total IS NULL THEN 'NOT_FOUND'
            WHEN @target_status IN ('LUNAS', 'BATAL') THEN 'ALREADY_PAID'
            WHEN @invoice_id IS NOT NULL
                 AND EXISTS (SELECT 1 FROM garment.order_level_payment_methods WHERE level_code = @level)
                 AND NOT EXISTS (SELECT 1 FROM garment.order_level_payment_methods
                                 WHERE level_code = @level AND payment_method = @payment_method)
                                                             THEN 'METHOD_NOT_ALLOWED'
            WHEN @amount > @target_total - @paid THEN 'EXCEEDS_BALANCE'
            ELSE NULL END;

        IF @result IS NOT NULL
        BEGIN
            IF @own_tran = 1 ROLLBACK TRANSACTION;
            RETURN;
        END;

        DECLARE @new TABLE (id UNIQUEIDENTIFIER);
        INSERT INTO garment.payments (direction, invoice_id, bill_id, cancellation_id, bank_account_id, amount,
                                      currency, exchange_rate, payment_method, reference_no, status, paid_date)
        OUTPUT inserted.id INTO @new
        VALUES (@direction, @invoice_id, @bill_id, @cancellation_id, @bank_account_id, @amount,
                ISNULL(@currency, @target_currency), @exchange_rate, @payment_method, @reference_no, @status, @paid_date);
        SELECT @payment_id = id FROM @new;

        -- LUNAS bila total pembayaran BERHASIL sudah menutup nilai
        IF @status = 'BERHASIL'
        BEGIN
            IF @invoice_id IS NOT NULL
               AND (SELECT SUM(amount) FROM garment.payments WHERE invoice_id = @invoice_id AND status = 'BERHASIL') >= @target_total
                UPDATE garment.sales_invoices SET status = 'LUNAS' WHERE id = @invoice_id;

            IF @bill_id IS NOT NULL
               AND (SELECT SUM(amount) FROM garment.payments WHERE bill_id = @bill_id AND status = 'BERHASIL') >= @target_total
                UPDATE garment.supplier_bills SET status = 'LUNAS' WHERE id = @bill_id;
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

/* ============================================================
   4. TRIGGERS
   ============================================================ */

-- trg_orders_immutable
CREATE OR ALTER TRIGGER garment.trg_orders_immutable_orders
ON garment.orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(order_code) OR UPDATE(buyer_id) OR UPDATE(factory_id) OR UPDATE(level_code)
       OR UPDATE(handled_by) OR UPDATE(buyer_po_no) OR UPDATE(order_date) OR UPDATE(deadline)
       OR UPDATE(scheme) OR UPDATE(reject_limit_pct) OR UPDATE(late_penalty) OR UPDATE(currency)
       OR UPDATE(exchange_rate) OR UPDATE(incoterm) OR UPDATE(destination_country)
       OR UPDATE(destination_port) OR UPDATE(notes) OR UPDATE(created_at)
        THROW 50010, 'ERR-ORD-05: Order tidak dapat diubah setelah disimpan.', 1;
END;
GO
CREATE OR ALTER TRIGGER garment.trg_orders_immutable_order_details
ON garment.order_details
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(order_id) OR UPDATE(item_id) OR UPDATE(color) OR UPDATE(unit_price) OR UPDATE(discount_pct)
        THROW 50010, 'ERR-ORD-05: Order tidak dapat diubah setelah disimpan.', 1;
END;
GO
CREATE OR ALTER TRIGGER garment.trg_orders_immutable_order_detail_sizes
ON garment.order_detail_sizes
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(order_detail_id) OR UPDATE(size) OR UPDATE(qty)
        THROW 50010, 'ERR-ORD-05: Order tidak dapat diubah setelah disimpan.', 1;
END;
GO

-- trg_shipment_items_same_order
CREATE OR ALTER TRIGGER garment.trg_shipment_items_same_order
ON garment.shipment_items
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1
               FROM inserted i
               JOIN garment.shipments s ON s.id = i.shipment_id
               JOIN garment.order_details d ON d.id = i.order_detail_id
               WHERE d.order_id <> s.order_id)
        THROW 50050, 'ERR-KRM-05: Semua barang dalam satu surat jalan harus dari order yang sama (K-12).', 1;
END;
GO

-- trg_no_delete_transactions
CREATE OR ALTER TRIGGER garment.trg_no_delete_orders ON garment.orders INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_order_status_history ON garment.order_status_history INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_order_details ON garment.order_details INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_order_detail_sizes ON garment.order_detail_sizes INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_order_cancellations ON garment.order_cancellations INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_shipments ON garment.shipments INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_shipment_items ON garment.shipment_items INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_export_documents ON garment.export_documents INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_shipment_trackings ON garment.shipment_trackings INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_sales_invoices ON garment.sales_invoices INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_supplier_bills ON garment.supplier_bills INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_payments ON garment.payments INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO
CREATE OR ALTER TRIGGER garment.trg_no_delete_taxes ON garment.taxes INSTEAD OF DELETE
AS BEGIN SET NOCOUNT ON; THROW 50040, 'Data transaksi tidak boleh dihapus (RB-57).', 1; END;
GO

