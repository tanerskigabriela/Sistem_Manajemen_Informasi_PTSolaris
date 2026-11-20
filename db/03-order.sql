USE solaris_db;
GO

/* ---------------------------------------------------------------------
   1. buyers
   --------------------------------------------------------------------- */
CREATE TABLE garment.buyers (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_buyers_id       DEFAULT NEWSEQUENTIALID(),
    buyer_code CHAR(3) NOT NULL,
    buyer_name NVARCHAR(100) NOT NULL,
    buyer_type VARCHAR(5) NOT NULL,   
    country_code CHAR(2) NOT NULL,   
    contact_name NVARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL,
    address NVARCHAR(200) NOT NULL,   
    city NVARCHAR(50) NOT NULL,  
    tax_id_no VARCHAR(30) NULL,   -- NPWP atau Tax ID
    default_currency CHAR(3) NOT NULL CONSTRAINT df_buyers_currency DEFAULT 'IDR',
    payment_term_days SMALLINT NOT NULL CONSTRAINT df_buyers_term     DEFAULT 30,
    credit_limit DECIMAL(16,2) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_buyers_created  DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_buyers_updated  DEFAULT SYSDATETIME(),
    CONSTRAINT pk_buyers PRIMARY KEY (id),
    CONSTRAINT uq_buyers_code UNIQUE (buyer_code),
    CONSTRAINT ck_buyers_code CHECK (buyer_code COLLATE Latin1_General_BIN LIKE '[A-Z][A-Z][A-Z]'),
    CONSTRAINT ck_buyers_type CHECK (buyer_type IN ('LOKAL', 'ASING')),
    CONSTRAINT ck_buyers_term CHECK (payment_term_days >= 0),
    CONSTRAINT ck_buyers_credit CHECK (credit_limit IS NULL OR credit_limit >= 0),
    CONSTRAINT fk_buyers_country FOREIGN KEY (country_code) REFERENCES garment.countries (country_code)
);
GO

/* ---------------------------------------------------------------------
   2. order_levels  (PK = kode)
   --------------------------------------------------------------------- */
CREATE TABLE garment.order_levels (
    level_code VARCHAR(13) NOT NULL,
    level_name NVARCHAR(30) NOT NULL,
    standard_lead_time_days SMALLINT  NOT NULL,
    minimum_order_qty INT  NOT NULL,
    vat_treatment VARCHAR(5) NOT NULL,
    min_down_payment_pct DECIMAL(5,2) NOT NULL,
    requires_export_document  BIT  NOT NULL,
    CONSTRAINT pk_order_levels PRIMARY KEY (level_code),
    CONSTRAINT ck_order_levels_code CHECK (level_code IN ('DOMESTIK', 'INTERNASIONAL')),
    CONSTRAINT ck_order_levels_vat CHECK (vat_treatment IN ('PPN', 'PPN_0')),
    CONSTRAINT ck_order_levels_dp CHECK (min_down_payment_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_order_levels_lead CHECK (standard_lead_time_days >= 0),
    CONSTRAINT ck_order_levels_moq CHECK (minimum_order_qty >= 0)
);
GO

/* ---------------------------------------------------------------------
   3. order_level_payment_methods  (atribut multivalued)
   --------------------------------------------------------------------- */
CREATE TABLE garment.order_level_payment_methods (
    level_code VARCHAR(13) NOT NULL,
    payment_method VARCHAR(8)  NOT NULL,
    CONSTRAINT pk_order_level_payment_methods PRIMARY KEY (level_code, payment_method),
    CONSTRAINT ck_olpm_method CHECK (payment_method IN ('TRANSFER', 'TT', 'LC', 'GIRO', 'TUNAI')),
    CONSTRAINT fk_olpm_level FOREIGN KEY (level_code) REFERENCES garment.order_levels (level_code)
);
GO

/* ---------------------------------------------------------------------
   4. product_types  (PK = kode)
   --------------------------------------------------------------------- */
CREATE TABLE garment.product_types (
    type_code CHAR(2) NOT NULL,
    type_name NVARCHAR(30) NOT NULL,
    CONSTRAINT pk_product_types PRIMARY KEY (type_code),
    CONSTRAINT ck_product_types_code CHECK (type_code IN ('CL', 'KM', 'KS', 'PL', 'DR', 'JK', 'SR'))
);
GO

/* ---------------------------------------------------------------------
   5. items
   --------------------------------------------------------------------- */
CREATE TABLE garment.items (
    id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_items_id DEFAULT NEWSEQUENTIALID(),
    item_code VARCHAR(12) NOT NULL,   -- BBB-JJ-NNNN, dibuat fn_next_item_code; tanpa buyer: GEN-JJ-NNNN
    buyer_id UNIQUEIDENTIFIER NULL,       -- owns_design (parsial)
    type_code CHAR(2) NOT NULL,
    item_name NVARCHAR(100) NOT NULL,
    buyer_style_name NVARCHAR(100) NULL,
    buyer_style_code VARCHAR(30) NULL,       -- Bukan key: dua buyer boleh memakai kode yang sama
    design_notes NVARCHAR(500) NULL,
    tech_pack_file VARCHAR(200) NULL,
    base_price DECIMAL(16,2) NULL,
    status VARCHAR(8) NOT NULL CONSTRAINT df_items_status  DEFAULT 'AKTIF',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_items_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_items PRIMARY KEY (id),
    CONSTRAINT uq_items_code UNIQUE (item_code),
    CONSTRAINT ck_items_code CHECK (item_code COLLATE Latin1_General_BIN LIKE '[A-Z][A-Z][A-Z]-[A-Z][A-Z]-[0-9][0-9][0-9][0-9]'),
    CONSTRAINT ck_items_status CHECK (status IN ('AKTIF', 'NONAKTIF')),
    CONSTRAINT ck_items_price CHECK (base_price IS NULL OR base_price >= 0),
    CONSTRAINT fk_items_buyer FOREIGN KEY (buyer_id)  REFERENCES garment.buyers (id),
    CONSTRAINT fk_items_type FOREIGN KEY (type_code) REFERENCES garment.product_types (type_code)
);
GO

/* ---------------------------------------------------------------------
   6. item_variants
   --------------------------------------------------------------------- */
CREATE TABLE garment.item_variants (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_item_variants_id DEFAULT NEWSEQUENTIALID(),
    item_id UNIQUEIDENTIFIER NOT NULL,
    sku VARCHAR(30) NOT NULL,   -- {item_code}-{size}-{NN}
    size VARCHAR(10) NOT NULL,
    color NVARCHAR(50) NOT NULL,
    weight_per_pcs_gram DECIMAL(8,2) NULL,
    CONSTRAINT pk_item_variants PRIMARY KEY (id),
    CONSTRAINT uq_item_variants_sku UNIQUE (sku),
    CONSTRAINT uq_item_variants_item_size_color UNIQUE (item_id, size, color),
    CONSTRAINT ck_item_variants_weight CHECK (weight_per_pcs_gram IS NULL OR weight_per_pcs_gram > 0),
    CONSTRAINT fk_item_variants_item FOREIGN KEY (item_id) REFERENCES garment.items (id)
);
GO

/* ---------------------------------------------------------------------
   7. orders
   --------------------------------------------------------------------- */
CREATE TABLE garment.orders (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_orders_id        DEFAULT NEWSEQUENTIALID(),
    order_code CHAR(12) NOT NULL,   -- ORD-TTBB-NNN, dibuat fn_next_order_code
    buyer_id UNIQUEIDENTIFIER NOT NULL,
    factory_id UNIQUEIDENTIFIER NOT NULL,   -- diisi otomatis dari pabrik karyawan yang login
    level_code VARCHAR(13) NOT NULL CONSTRAINT df_orders_level     DEFAULT 'DOMESTIK',
    handled_by UNIQUEIDENTIFIER NOT NULL,   -- employee_id Marketing 
    buyer_po_no VARCHAR(30) NULL,
    order_date DATE NOT NULL CONSTRAINT df_orders_date      DEFAULT CAST(SYSDATETIME() AS DATE),
    deadline DATE NOT NULL,
    finish_date DATE NULL,
    scheme VARCHAR(3) NOT NULL,   -- skema PRODUKSI (CMT/FOB), beda dengan incoterm
    reject_limit_pct DECIMAL(5,2) NOT NULL,
    late_penalty NVARCHAR(500) NOT NULL,
    currency CHAR(3) NOT NULL CONSTRAINT df_orders_currency  DEFAULT 'IDR',
    exchange_rate DECIMAL(12,4) NOT NULL CONSTRAINT df_orders_rate      DEFAULT 1,
    incoterm VARCHAR(3) NULL,
    destination_country CHAR(2) NULL,
    destination_port NVARCHAR(60) NULL,
    notes NVARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_orders_status    DEFAULT 'MENUNGGU_PERSETUJUAN',
    is_at_risk BIT NOT NULL CONSTRAINT df_orders_risk      DEFAULT 0,
    is_over_reject BIT NOT NULL CONSTRAINT df_orders_reject    DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_orders_created   DEFAULT SYSDATETIME(),
    CONSTRAINT pk_orders PRIMARY KEY (id),
    CONSTRAINT uq_orders_code UNIQUE (order_code),
    CONSTRAINT ck_orders_code CHECK (order_code LIKE 'ORD-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]'),
    CONSTRAINT ck_orders_deadline CHECK (deadline >= order_date),
    CONSTRAINT ck_orders_finish CHECK (finish_date IS NULL OR finish_date >= order_date),
    CONSTRAINT ck_orders_scheme CHECK (scheme IN ('CMT', 'FOB')),
    CONSTRAINT ck_orders_reject CHECK (reject_limit_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_orders_rate CHECK (exchange_rate > 0),
    CONSTRAINT ck_orders_incoterm CHECK (incoterm IS NULL OR incoterm IN ('EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP')),
    CONSTRAINT ck_orders_status CHECK (status IN ('MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DITOLAK', 'DITARIK','DALAM_PRODUKSI', 'SELESAI', 'DIBATALKAN')),
    CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES garment.buyers (id),
    CONSTRAINT fk_orders_factory FOREIGN KEY (factory_id) REFERENCES garment.factories (id),
    CONSTRAINT fk_orders_level FOREIGN KEY (level_code) REFERENCES garment.order_levels (level_code),
    CONSTRAINT fk_orders_handled_by FOREIGN KEY (handled_by) REFERENCES garment.employees (id),
    CONSTRAINT fk_orders_dest_country FOREIGN KEY (destination_country) REFERENCES garment.countries (country_code)
);
GO

/* ---------------------------------------------------------------------
   8. order_status_history 
   --------------------------------------------------------------------- */
CREATE TABLE garment.order_status_history (
    id BIGINT IDENTITY(1,1) NOT NULL,
    order_id UNIQUEIDENTIFIER NOT NULL,
    status VARCHAR(20) NOT NULL,   
    changed_by UNIQUEIDENTIFIER NOT NULL,
    reason NVARCHAR(500) NULL,
    changed_at DATETIME2(0) NOT NULL CONSTRAINT df_osh_changed DEFAULT SYSDATETIME(),
    CONSTRAINT pk_order_status_history PRIMARY KEY (id),
    CONSTRAINT ck_osh_status CHECK (status IN ('MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DITOLAK', 'DITARIK','DALAM_PRODUKSI', 'SELESAI', 'DIBATALKAN')),
    CONSTRAINT ck_osh_reason CHECK (status NOT IN ('DITOLAK', 'DITARIK', 'DIBATALKAN') OR reason IS NOT NULL),
    CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES garment.orders (id),
    CONSTRAINT fk_osh_changed FOREIGN KEY (changed_by) REFERENCES garment.employees (id)
);
GO

/* ---------------------------------------------------------------------
   9. order_details  
   --------------------------------------------------------------------- */
CREATE TABLE garment.order_details (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_order_details_id DEFAULT NEWSEQUENTIALID(),
    order_id UNIQUEIDENTIFIER NOT NULL,
    item_id UNIQUEIDENTIFIER NOT NULL,
    color NVARCHAR(50) NOT NULL,
    unit_price DECIMAL(16,2) NOT NULL,   
    discount_pct DECIMAL(5,2) NOT NULL CONSTRAINT df_order_details_discount DEFAULT 0,
    is_at_risk BIT NOT NULL CONSTRAINT df_order_details_risk     DEFAULT 0,
    is_over_reject BIT NOT NULL CONSTRAINT df_order_details_reject   DEFAULT 0,
    CONSTRAINT pk_order_details PRIMARY KEY (id),
    CONSTRAINT uq_order_details_order_item_color UNIQUE (order_id, item_id, color),
    CONSTRAINT ck_order_details_price CHECK (unit_price > 0),
    CONSTRAINT ck_order_details_discount CHECK (discount_pct BETWEEN 0 AND 100),
    CONSTRAINT fk_order_details_order FOREIGN KEY (order_id) REFERENCES garment.orders (id),
    CONSTRAINT fk_order_details_item FOREIGN KEY (item_id)  REFERENCES garment.items (id)
);
GO

/* ---------------------------------------------------------------------
   10. order_detail_sizes  (entitas lemah: PK = pemilik + ukuran)
   --------------------------------------------------------------------- */
CREATE TABLE garment.order_detail_sizes (
    order_detail_id  UNIQUEIDENTIFIER NOT NULL,
    size VARCHAR(10) NOT NULL,
    variant_id UNIQUEIDENTIFIER NULL,   
    qty INT NOT NULL,
    cancelled_qty INT NOT NULL CONSTRAINT df_ods_cancelled DEFAULT 0,
    CONSTRAINT pk_order_detail_sizes PRIMARY KEY (order_detail_id, size),
    CONSTRAINT ck_ods_qty CHECK (qty > 0),
    CONSTRAINT ck_ods_cancelled CHECK (cancelled_qty BETWEEN 0 AND qty),
    CONSTRAINT fk_ods_detail FOREIGN KEY (order_detail_id) REFERENCES garment.order_details (id),
    CONSTRAINT fk_ods_variant FOREIGN KEY (variant_id) REFERENCES garment.item_variants (id)
);
GO

/* ---------------------------------------------------------------------
   11. cancellation_policies
       stage_code NULL = pembatalan sebelum produksi
   --------------------------------------------------------------------- */
CREATE TABLE garment.cancellation_policies (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_cancellation_policies_id DEFAULT NEWSEQUENTIALID(),
    level_code VARCHAR(13) NOT NULL,
    stage_code VARCHAR(10) NULL,
    request_deadline_days SMALLINT NOT NULL,
    penalty_pct DECIMAL(5,2) NOT NULL,
    down_payment_refund_pct DECIMAL(5,2) NOT NULL,
    material_owned_by_buyer BIT NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NULL,
    CONSTRAINT pk_cancellation_policies PRIMARY KEY (id),
    CONSTRAINT ck_cp_deadline CHECK (request_deadline_days >= 0),
    CONSTRAINT ck_cp_penalty CHECK (penalty_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_cp_refund CHECK (down_payment_refund_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_cp_valid CHECK (valid_until IS NULL OR valid_until >= valid_from),
    CONSTRAINT fk_cp_level FOREIGN KEY (level_code) REFERENCES garment.order_levels (level_code),
    CONSTRAINT fk_cp_stage FOREIGN KEY (stage_code) REFERENCES garment.production_stages (stage_code)
);
GO

/* ---------------------------------------------------------------------
   12. order_cancellations
   --------------------------------------------------------------------- */
CREATE TABLE garment.order_cancellations (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_order_cancellations_id DEFAULT NEWSEQUENTIALID(),
    order_id UNIQUEIDENTIFIER NOT NULL,
    order_detail_id UNIQUEIDENTIFIER NULL,
    policy_id UNIQUEIDENTIFIER NOT NULL,
    stage_code_at_request VARCHAR(10) NULL,
    requested_by_party VARCHAR(10) NOT NULL,   -- diisi dari dialog Batalkan Order (isian baru)
    reason NVARCHAR(500) NOT NULL,
    cancelled_qty INT NULL,
    penalty_amount DECIMAL(16,2) NOT NULL CONSTRAINT df_oc_penalty DEFAULT 0,  -- dihitung fn_cancellation_penalty
    refund_amount DECIMAL(16,2) NOT NULL CONSTRAINT df_oc_refund  DEFAULT 0,  -- dihitung fn_cancellation_penalty
    status VARCHAR(10) NOT NULL,
    requested_by UNIQUEIDENTIFIER NOT NULL,
    approved_by UNIQUEIDENTIFIER NULL,
    requested_date DATE NOT NULL CONSTRAINT df_oc_req_date DEFAULT CAST(SYSDATETIME() AS DATE),
    approved_date DATE NULL,
    CONSTRAINT pk_order_cancellations PRIMARY KEY (id),
    CONSTRAINT ck_oc_party CHECK (requested_by_party IN ('BUYER', 'PERUSAHAAN')),
    CONSTRAINT ck_oc_status CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
    CONSTRAINT ck_oc_qty CHECK (cancelled_qty IS NULL OR cancelled_qty > 0),
    CONSTRAINT ck_oc_amounts CHECK (penalty_amount >= 0 AND refund_amount >= 0),
    CONSTRAINT ck_oc_approval CHECK (status = 'MENUNGGU' OR (approved_by IS NOT NULL AND approved_date IS NOT NULL)),
    CONSTRAINT ck_oc_dates CHECK (approved_date IS NULL OR approved_date >= requested_date),
    CONSTRAINT fk_oc_order FOREIGN KEY (order_id) REFERENCES garment.orders (id),
    CONSTRAINT fk_oc_detail FOREIGN KEY (order_detail_id) REFERENCES garment.order_details (id),
    CONSTRAINT fk_oc_policy FOREIGN KEY (policy_id) REFERENCES garment.cancellation_policies (id),
    CONSTRAINT fk_oc_stage FOREIGN KEY (stage_code_at_request) REFERENCES garment.production_stages (stage_code),
    CONSTRAINT fk_oc_requested FOREIGN KEY (requested_by) REFERENCES garment.employees (id),
    CONSTRAINT fk_oc_approved FOREIGN KEY (approved_by) REFERENCES garment.employees (id)
);
GO

/* ---------------------------------------------------------------------
   13. expeditions
   --------------------------------------------------------------------- */
CREATE TABLE garment.expeditions (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_expeditions_id     DEFAULT NEWSEQUENTIALID(),
    expedition_name NVARCHAR(100) NOT NULL,
    partner_type VARCHAR(10) NOT NULL,
    coverage VARCHAR(13) NOT NULL,
    contact_name NVARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email  VARCHAR(100) NULL,
    is_active BIT NOT NULL CONSTRAINT df_expeditions_active DEFAULT 1,
    CONSTRAINT pk_expeditions PRIMARY KEY (id),
    CONSTRAINT ck_expeditions_partner CHECK (partner_type IN ('EKSPEDISI', 'FORWARDER', 'KURIR')),
    CONSTRAINT ck_expeditions_coverage CHECK (coverage IN ('DOMESTIK', 'INTERNASIONAL', 'KEDUANYA'))
);
GO

/* ---------------------------------------------------------------------
   14. expedition_transport_modes  (atribut multivalued)
   --------------------------------------------------------------------- */
CREATE TABLE garment.expedition_transport_modes (
    expedition_id UNIQUEIDENTIFIER NOT NULL,
    transport_mode VARCHAR(6) NOT NULL,
    CONSTRAINT pk_expedition_transport_modes PRIMARY KEY (expedition_id, transport_mode),
    CONSTRAINT ck_etm_mode CHECK (transport_mode IN ('DARAT', 'LAUT', 'UDARA')),
    CONSTRAINT fk_etm_expedition FOREIGN KEY (expedition_id) REFERENCES garment.expeditions (id)
);
GO

/* ---------------------------------------------------------------------
   15. vehicles
   --------------------------------------------------------------------- */
CREATE TABLE garment.vehicles (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_vehicles_id     DEFAULT NEWSEQUENTIALID(),
    factory_id UNIQUEIDENTIFIER NOT NULL,
    plate_no VARCHAR(12) NOT NULL,
    vehicle_type NVARCHAR(30) NOT NULL,
    capacity_kg DECIMAL(10,2) NOT NULL,
    capacity_m3 DECIMAL(10,2) NOT NULL,
    status VARCHAR(9) NOT NULL CONSTRAINT df_vehicles_status DEFAULT 'TERSEDIA',
    CONSTRAINT pk_vehicles PRIMARY KEY (id),
    CONSTRAINT uq_vehicles_plate UNIQUE (plate_no),
    CONSTRAINT ck_vehicles_capacity CHECK (capacity_kg > 0 AND capacity_m3 > 0),
    CONSTRAINT ck_vehicles_status CHECK (status IN ('TERSEDIA', 'DIPAKAI', 'PERBAIKAN')),
    CONSTRAINT fk_vehicles_factory FOREIGN KEY (factory_id) REFERENCES garment.factories (id)
);
GO

/* ---------------------------------------------------------------------
   16. routes
   --------------------------------------------------------------------- */
CREATE TABLE garment.routes (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_routes_id DEFAULT NEWSEQUENTIALID(),
    origin_warehouse_id UNIQUEIDENTIFIER NOT NULL,
    expedition_id UNIQUEIDENTIFIER NOT NULL,
    destination_city NVARCHAR(60) NOT NULL,
    destination_country CHAR(2) NOT NULL,
    distance_km DECIMAL(8,1) NOT NULL,
    estimated_days SMALLINT NOT NULL,
    rate_per_kg DECIMAL(16,2) NOT NULL,
    rate_per_m3 DECIMAL(16,2) NOT NULL,
    minimum_rate DECIMAL(16,2) NOT NULL,
    valid_until DATE NULL,
    CONSTRAINT pk_routes PRIMARY KEY (id),
    CONSTRAINT ck_routes_distance CHECK (distance_km > 0 AND estimated_days >= 0),
    CONSTRAINT ck_routes_rates CHECK (rate_per_kg >= 0 AND rate_per_m3 >= 0 AND minimum_rate >= 0),
    CONSTRAINT fk_routes_warehouse FOREIGN KEY (origin_warehouse_id) REFERENCES garment.warehouses (id),
    CONSTRAINT fk_routes_expedition FOREIGN KEY (expedition_id) REFERENCES garment.expeditions (id),
    CONSTRAINT fk_routes_country FOREIGN KEY (destination_country) REFERENCES garment.countries (country_code)
);
GO

/* ---------------------------------------------------------------------
   17. shipments
   --------------------------------------------------------------------- */
CREATE TABLE garment.shipments (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_shipments_id DEFAULT NEWSEQUENTIALID(),
    delivery_note_no CHAR(11) NOT NULL,   -- SJ-TTBB-NNN, dibuat fn_next_doc_no('SJ')
    order_id UNIQUEIDENTIFIER NOT NULL,
    origin_warehouse_id UNIQUEIDENTIFIER NOT NULL,   -- diisi otomatis: gudang barang jadi pabrik order
    expedition_id UNIQUEIDENTIFIER NOT NULL,   -- wajib, dipilih PPIC
    route_id UNIQUEIDENTIFIER NULL,
    vehicle_id UNIQUEIDENTIFIER NULL,
    recorded_by UNIQUEIDENTIFIER NOT NULL,   -- employee_id PPIC
    destination_address NVARCHAR(200) NOT NULL,
    ship_date DATE NOT NULL,
    estimated_arrival DATE NULL,
    arrival_date DATE NULL,
    package_count INT NULL,
    total_weight_kg DECIMAL(10,2) NULL,
    volume_m3 DECIMAL(10,2) NULL,
    shipping_cost DECIMAL(16,2) NULL,
    status VARCHAR(16) NOT NULL CONSTRAINT df_shipments_status  DEFAULT 'DIKIRIM',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_shipments_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_shipments PRIMARY KEY (id),
    CONSTRAINT uq_shipments_note UNIQUE (delivery_note_no),
    CONSTRAINT ck_shipments_note CHECK (delivery_note_no LIKE 'SJ-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]'),
    CONSTRAINT ck_shipments_status CHECK (status IN ('DIKIRIM', 'DALAM_PERJALANAN', 'TIBA')),
    CONSTRAINT ck_shipments_dates CHECK ((estimated_arrival IS NULL OR estimated_arrival >= ship_date) 
                                            AND (arrival_date IS NULL OR arrival_date >= ship_date)),
    CONSTRAINT ck_shipments_numbers CHECK ((package_count IS NULL OR package_count > 0)
                                              AND (total_weight_kg IS NULL OR total_weight_kg > 0)
                                              AND (volume_m3 IS NULL OR volume_m3 > 0)
                                              AND (shipping_cost IS NULL OR shipping_cost >= 0)),
    CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES garment.orders (id),
    CONSTRAINT fk_shipments_warehouse FOREIGN KEY (origin_warehouse_id) REFERENCES garment.warehouses (id),
    CONSTRAINT fk_shipments_expedition FOREIGN KEY (expedition_id) REFERENCES garment.expeditions (id),
    CONSTRAINT fk_shipments_route FOREIGN KEY (route_id) REFERENCES garment.routes (id),
    CONSTRAINT fk_shipments_vehicle FOREIGN KEY (vehicle_id) REFERENCES garment.vehicles (id),
    CONSTRAINT fk_shipments_recorded FOREIGN KEY (recorded_by) REFERENCES garment.employees (id)
);
GO

/* ---------------------------------------------------------------------
   18. shipment_items  (entitas lemah)
   --------------------------------------------------------------------- */
CREATE TABLE garment.shipment_items (
    shipment_id UNIQUEIDENTIFIER NOT NULL,
    line_no SMALLINT NOT NULL,
    order_detail_id UNIQUEIDENTIFIER NOT NULL,
    size VARCHAR(10) NOT NULL,
    qty INT NOT NULL,
    carton_no VARCHAR(20) NULL,
    CONSTRAINT pk_shipment_items PRIMARY KEY (shipment_id, line_no),
    CONSTRAINT uq_shipment_items_detail_size  UNIQUE (shipment_id, order_detail_id, size),
    CONSTRAINT ck_shipment_items_line CHECK (line_no > 0),
    CONSTRAINT ck_shipment_items_qty CHECK (qty > 0),
    CONSTRAINT fk_shipment_items_shipment FOREIGN KEY (shipment_id) REFERENCES garment.shipments (id),
    CONSTRAINT fk_shipment_items_size FOREIGN KEY (order_detail_id, size) REFERENCES garment.order_detail_sizes (order_detail_id, size)
);
GO

/* ---------------------------------------------------------------------
   19. export_documents  (1:1 dengan shipments)
   --------------------------------------------------------------------- */
CREATE TABLE garment.export_documents (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_export_documents_id DEFAULT NEWSEQUENTIALID(),
    shipment_id UNIQUEIDENTIFIER NOT NULL,
    peb_no VARCHAR(30) NOT NULL,
    peb_date DATE NOT NULL,
    commercial_invoice_no VARCHAR(30) NOT NULL,
    packing_list_no VARCHAR(30) NOT NULL,
    bl_awb_no VARCHAR(30) NOT NULL,
    coo_no VARCHAR(30) NULL,
    vessel_flight_no VARCHAR(30) NOT NULL,
    container_no VARCHAR(30) NULL,
    container_type VARCHAR(10) NULL,
    etd DATE NOT NULL,
    eta DATE NOT NULL,
    loading_port NVARCHAR(60) NOT NULL,
    destination_port NVARCHAR(60) NOT NULL,
    fob_value DECIMAL(16,2) NOT NULL,
    CONSTRAINT pk_export_documents PRIMARY KEY (id),
    CONSTRAINT uq_export_documents_shipment UNIQUE (shipment_id),
    CONSTRAINT ck_export_documents_dates CHECK (eta >= etd),
    CONSTRAINT ck_export_documents_fob CHECK (fob_value >= 0),
    CONSTRAINT fk_export_documents_shipment FOREIGN KEY (shipment_id) REFERENCES garment.shipments (id)
);
GO

/* ---------------------------------------------------------------------
   20. shipment_trackings  (entitas lemah: PK = pengiriman + waktu update)
   --------------------------------------------------------------------- */
CREATE TABLE garment.shipment_trackings (
    shipment_id UNIQUEIDENTIFIER NOT NULL,
    updated_at DATETIME2(0)NOT NULL,
    location NVARCHAR(100) NOT NULL,
    position_status VARCHAR(20) NOT NULL,
    description NVARCHAR(300) NULL,
    CONSTRAINT pk_shipment_trackings PRIMARY KEY (shipment_id, updated_at),
    CONSTRAINT fk_shipment_trackings_shipment FOREIGN KEY (shipment_id) REFERENCES garment.shipments (id)
);
GO

/* =====================================================================
   INDEX  (TSD 4.4 Indexing Strategy, disesuaikan dengan nama tabel v2)
   ===================================================================== */

-- Riwayat status pada detail order 
CREATE INDEX ix_order_status_history_order_changed
    ON garment.order_status_history (order_id, changed_at);
GO

-- Nomor urut barang per buyer, fn_next_item_code 
CREATE INDEX ix_items_buyer
    ON garment.items (buyer_id);
GO

-- Daftar persetujuan dan dashboard
CREATE INDEX ix_orders_status_deadline
    ON garment.orders (status, deadline);
GO

-- Filter buyer dan riwayat harga 
CREATE INDEX ix_orders_buyer_date
    ON garment.orders (buyer_id, order_date);
GO

-- Riwayat harga per kode barang 
CREATE INDEX ix_order_details_item
    ON garment.order_details (item_id);
GO

-- Riwayat pengiriman per order 
CREATE INDEX ix_shipments_order_date
    ON garment.shipments (order_id, ship_date);
GO

-- Total terkirim per style dan ukuran, fn_ready_to_ship 
CREATE INDEX ix_shipment_items_detail_size
    ON garment.shipment_items (order_detail_id, size);
GO

-- Pembatalan per order, dipakai fn_cancellation_penalty 
CREATE INDEX ix_order_cancellations_order
    ON garment.order_cancellations (order_id);
GO


