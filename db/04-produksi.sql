-- =====================================================================
-- 04-produksi.sql  |  Pemilik: C  |  KONTRAK v2 revisi 4, Bagian 4.4
-- Schema garment. Dijalankan setelah 00, 01, 02, 03.
--
-- BAGIAN 1: tabel yang hanya bergantung pada tabel A (01-org.sql).
-- BAGIAN 2: tabel yang bergantung pada tabel B (03-order.sql).
--           Jalankan 00 -> 01 -> 02 -> 03 -> file ini.
-- =====================================================================
USE solaris_db;
GO

/* =====================================================================
   BAGIAN 1
   ===================================================================== */

/* ---------- production_lines ---------- */
CREATE TABLE garment.production_lines (
    id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_production_lines_id DEFAULT NEWSEQUENTIALID(),
    factory_id           UNIQUEIDENTIFIER NOT NULL,
    supervisor_id        UNIQUEIDENTIFIER NOT NULL,
    line_name            NVARCHAR(50)     NOT NULL,
    capacity_pcs_per_day INT              NOT NULL,
    CONSTRAINT pk_production_lines PRIMARY KEY (id),
    CONSTRAINT fk_production_lines_factory    FOREIGN KEY (factory_id)    REFERENCES garment.factories(id),
    CONSTRAINT fk_production_lines_supervisor FOREIGN KEY (supervisor_id) REFERENCES garment.employees(id),
    CONSTRAINT ck_production_lines_capacity   CHECK (capacity_pcs_per_day > 0)
);
GO

/* ---------- suppliers ---------- */
CREATE TABLE garment.suppliers (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_suppliers_id DEFAULT NEWSEQUENTIALID(),
    supplier_name     NVARCHAR(100)    NOT NULL,
    supplier_type     VARCHAR(6)       NOT NULL,
    country_code      CHAR(2)          NOT NULL,
    contact_name      NVARCHAR(100)    NOT NULL,
    phone             VARCHAR(20)      NOT NULL,
    email             VARCHAR(100)     NULL,
    address           NVARCHAR(200)    NOT NULL,
    city              NVARCHAR(50)     NOT NULL,
    currency          CHAR(3)          NOT NULL CONSTRAINT df_suppliers_currency DEFAULT 'IDR',
    tax_id_no         VARCHAR(30)      NULL,
    rating            DECIMAL(2,1)     NULL,
    payment_term      VARCHAR(10)      NOT NULL,
    payment_term_days SMALLINT         NOT NULL CONSTRAINT df_suppliers_term_days DEFAULT 0,
    is_active         BIT              NOT NULL CONSTRAINT df_suppliers_active DEFAULT 1,
    created_at        DATETIME2(0)     NOT NULL CONSTRAINT df_suppliers_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_suppliers PRIMARY KEY (id),
    CONSTRAINT fk_suppliers_country FOREIGN KEY (country_code) REFERENCES garment.countries(country_code),
    CONSTRAINT ck_suppliers_type    CHECK (supplier_type IN ('LOKAL','IMPOR')),
    CONSTRAINT ck_suppliers_rating  CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    CONSTRAINT ck_suppliers_term    CHECK (payment_term IN ('LUNAS_AWAL','DP','KREDIT')),
    CONSTRAINT ck_suppliers_term_days CHECK (payment_term_days >= 0)
);
GO

/* ---------- material_categories ---------- */
CREATE TABLE garment.material_categories (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_material_categories_id DEFAULT NEWSEQUENTIALID(),
    category_name NVARCHAR(50)     NOT NULL,
    CONSTRAINT pk_material_categories PRIMARY KEY (id)
);
GO

/* ---------- raw_materials ---------- */
CREATE TABLE garment.raw_materials (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_raw_materials_id DEFAULT NEWSEQUENTIALID(),
    material_code VARCHAR(20)      NOT NULL,
    category_id   UNIQUEIDENTIFIER NOT NULL,
    material_name NVARCHAR(100)    NOT NULL,
    specification NVARCHAR(200)    NULL,
    color         NVARCHAR(50)     NULL,
    unit          NVARCHAR(20)     NOT NULL,
    hs_code       VARCHAR(12)      NULL,
    minimum_stock DECIMAL(12,2)    NOT NULL CONSTRAINT df_raw_materials_min_stock DEFAULT 0,
    CONSTRAINT pk_raw_materials PRIMARY KEY (id),
    CONSTRAINT uq_raw_materials_code UNIQUE (material_code),
    CONSTRAINT fk_raw_materials_category FOREIGN KEY (category_id) REFERENCES garment.material_categories(id),
    CONSTRAINT ck_raw_materials_min_stock CHECK (minimum_stock >= 0)
);
GO

/* ---------- supplier_materials (relasi ternary supplies, M:N:1) ---------- */
CREATE TABLE garment.supplier_materials (
    supplier_id      UNIQUEIDENTIFIER NOT NULL,
    material_id      UNIQUEIDENTIFIER NOT NULL,
    origin_country   CHAR(2)          NOT NULL,
    offer_price      DECIMAL(16,2)    NOT NULL,
    currency         CHAR(3)          NOT NULL,
    lead_time_days   SMALLINT         NOT NULL,
    minimum_order    DECIMAL(12,2)    NOT NULL,
    is_main_supplier BIT              NOT NULL CONSTRAINT df_supplier_materials_main DEFAULT 0,
    CONSTRAINT pk_supplier_materials PRIMARY KEY (supplier_id, material_id),
    CONSTRAINT fk_supplier_materials_supplier FOREIGN KEY (supplier_id)    REFERENCES garment.suppliers(id),
    CONSTRAINT fk_supplier_materials_material FOREIGN KEY (material_id)    REFERENCES garment.raw_materials(id),
    CONSTRAINT fk_supplier_materials_country  FOREIGN KEY (origin_country) REFERENCES garment.countries(country_code),
    CONSTRAINT ck_supplier_materials_price    CHECK (offer_price > 0),
    CONSTRAINT ck_supplier_materials_lead     CHECK (lead_time_days >= 0),
    CONSTRAINT ck_supplier_materials_min      CHECK (minimum_order >= 0)
);
GO

/* ---------- defect_types ---------- */
CREATE TABLE garment.defect_types (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_defect_types_id DEFAULT NEWSEQUENTIALID(),
    defect_name NVARCHAR(60)     NOT NULL,
    level       VARCHAR(6)       NOT NULL,
    CONSTRAINT pk_defect_types PRIMARY KEY (id),
    CONSTRAINT ck_defect_types_level CHECK (level IN ('MINOR','MAYOR','KRITIS'))
);
GO

/* ---------- material_stocks ---------- */
CREATE TABLE garment.material_stocks (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_material_stocks_id DEFAULT NEWSEQUENTIALID(),
    location_id   UNIQUEIDENTIFIER NOT NULL,
    material_id   UNIQUEIDENTIFIER NOT NULL,
    batch_no      VARCHAR(30)      NOT NULL,
    available_qty DECIMAL(12,2)    NOT NULL CONSTRAINT df_material_stocks_available DEFAULT 0,
    allocated_qty DECIMAL(12,2)    NOT NULL CONSTRAINT df_material_stocks_allocated DEFAULT 0,
    updated_at    DATETIME2(0)     NOT NULL CONSTRAINT df_material_stocks_updated DEFAULT SYSDATETIME(),
    CONSTRAINT pk_material_stocks PRIMARY KEY (id),
    CONSTRAINT uq_material_stocks UNIQUE (location_id, material_id, batch_no),
    CONSTRAINT fk_material_stocks_location FOREIGN KEY (location_id) REFERENCES garment.rack_locations(id),
    CONSTRAINT fk_material_stocks_material FOREIGN KEY (material_id) REFERENCES garment.raw_materials(id),
    CONSTRAINT ck_material_stocks_qty CHECK (available_qty >= 0 AND allocated_qty >= 0 AND allocated_qty <= available_qty)
);
GO

/* ---------- facilities ---------- */
CREATE TABLE garment.facilities (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_facilities_id DEFAULT NEWSEQUENTIALID(),
    factory_id    UNIQUEIDENTIFIER NULL,
    facility_name NVARCHAR(60)     NOT NULL,
    facility_type NVARCHAR(30)     NOT NULL,
    status        VARCHAR(10)      NOT NULL,
    CONSTRAINT pk_facilities PRIMARY KEY (id),
    CONSTRAINT fk_facilities_factory FOREIGN KEY (factory_id) REFERENCES garment.factories(id),
    CONSTRAINT ck_facilities_status CHECK (status IN ('BAIK','RUSAK','PERBAIKAN'))
);
GO

/* ---------- equipment ---------- */
CREATE TABLE garment.equipment (
    id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_equipment_id DEFAULT NEWSEQUENTIALID(),
    factory_id            UNIQUEIDENTIFIER NOT NULL,
    line_id               UNIQUEIDENTIFIER NULL,
    supplier_id           UNIQUEIDENTIFIER NULL,
    equipment_name        NVARCHAR(60)     NOT NULL,
    equipment_type        NVARCHAR(60)     NOT NULL,
    brand                 NVARCHAR(60)     NOT NULL,
    serial_no             VARCHAR(40)      NOT NULL,
    purchase_date         DATE             NOT NULL,
    purchase_price        DECIMAL(16,2)    NOT NULL,
    service_interval_days SMALLINT         NOT NULL,
    status                VARCHAR(10)      NOT NULL,
    CONSTRAINT pk_equipment PRIMARY KEY (id),
    CONSTRAINT uq_equipment_serial UNIQUE (serial_no),
    CONSTRAINT fk_equipment_factory  FOREIGN KEY (factory_id)  REFERENCES garment.factories(id),
    CONSTRAINT fk_equipment_line     FOREIGN KEY (line_id)     REFERENCES garment.production_lines(id),
    CONSTRAINT fk_equipment_supplier FOREIGN KEY (supplier_id) REFERENCES garment.suppliers(id),
    CONSTRAINT ck_equipment_price    CHECK (purchase_price >= 0),
    CONSTRAINT ck_equipment_interval CHECK (service_interval_days > 0),
    CONSTRAINT ck_equipment_status   CHECK (status IN ('AKTIF','PERBAIKAN','RUSAK'))
);
GO

/* ---------- maintenances ---------- */
CREATE TABLE garment.maintenances (
    id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_maintenances_id DEFAULT NEWSEQUENTIALID(),
    equipment_id       UNIQUEIDENTIFIER NULL,
    facility_id        UNIQUEIDENTIFIER NULL,
    reported_by        UNIQUEIDENTIFIER NOT NULL,
    technician_id      UNIQUEIDENTIFIER NULL,
    vendor_id          UNIQUEIDENTIFIER NULL,
    maintenance_type   VARCHAR(9)       NOT NULL,
    damage_description NVARCHAR(300)    NOT NULL,
    corrective_action  NVARCHAR(300)    NULL,
    repair_cost        DECIMAL(16,2)    NULL,
    status             VARCHAR(10)      NOT NULL CONSTRAINT df_maintenances_status DEFAULT 'DILAPORKAN',
    reported_date      DATETIME2(0)     NOT NULL CONSTRAINT df_maintenances_reported DEFAULT SYSDATETIME(),
    finish_date        DATETIME2(0)     NULL,
    CONSTRAINT pk_maintenances PRIMARY KEY (id),
    CONSTRAINT fk_maintenances_equipment  FOREIGN KEY (equipment_id)  REFERENCES garment.equipment(id),
    CONSTRAINT fk_maintenances_facility   FOREIGN KEY (facility_id)   REFERENCES garment.facilities(id),
    CONSTRAINT fk_maintenances_reporter   FOREIGN KEY (reported_by)   REFERENCES garment.employees(id),
    CONSTRAINT fk_maintenances_technician FOREIGN KEY (technician_id) REFERENCES garment.employees(id),
    CONSTRAINT fk_maintenances_vendor     FOREIGN KEY (vendor_id)     REFERENCES garment.suppliers(id),
    -- tepat satu objek: mesin ATAU fasilitas
    CONSTRAINT ck_maintenances_target CHECK (
        (equipment_id IS NOT NULL AND facility_id IS NULL) OR
        (equipment_id IS NULL AND facility_id IS NOT NULL)
    ),
    CONSTRAINT ck_maintenances_type   CHECK (maintenance_type IN ('PREVENTIF','KOREKTIF')),
    CONSTRAINT ck_maintenances_status CHECK (status IN ('DILAPORKAN','DIKERJAKAN','SELESAI')),
    CONSTRAINT ck_maintenances_cost   CHECK (repair_cost IS NULL OR repair_cost >= 0),
    CONSTRAINT ck_maintenances_finish CHECK (finish_date IS NULL OR finish_date >= reported_date)
);
GO

/* =====================================================================
   BAGIAN 2: tabel yang bergantung pada tabel B (03-order.sql)
   ===================================================================== */

/* ---------- bom (relasi M:N bill_of_materials: items x raw_materials) ---------- */
CREATE TABLE garment.bom (
    item_id             UNIQUEIDENTIFIER NOT NULL,
    material_id         UNIQUEIDENTIFIER NOT NULL,
    qty_per_pcs         DECIMAL(10,4)    NOT NULL,
    unit                NVARCHAR(20)     NOT NULL,
    waste_tolerance_pct DECIMAL(5,2)     NOT NULL CONSTRAINT df_bom_waste DEFAULT 0,
    CONSTRAINT pk_bom PRIMARY KEY (item_id, material_id),
    CONSTRAINT fk_bom_item     FOREIGN KEY (item_id)     REFERENCES garment.items(id),
    CONSTRAINT fk_bom_material FOREIGN KEY (material_id) REFERENCES garment.raw_materials(id),
    CONSTRAINT ck_bom_qty   CHECK (qty_per_pcs > 0),
    CONSTRAINT ck_bom_waste CHECK (waste_tolerance_pct BETWEEN 0 AND 100)
);
GO

/* ---------- qc_standards ---------- */
CREATE TABLE garment.qc_standards (
    id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_qc_standards_id DEFAULT NEWSEQUENTIALID(),
    type_code          CHAR(2)          NULL,
    parameter_name     NVARCHAR(100)    NOT NULL,
    tolerance_value    NVARCHAR(50)     NOT NULL,
    sampling_reference VARCHAR(30)      NOT NULL,
    CONSTRAINT pk_qc_standards PRIMARY KEY (id),
    CONSTRAINT fk_qc_standards_type FOREIGN KEY (type_code) REFERENCES garment.product_types(type_code)
);
GO

/* ---------- spk (satu SPK per style = satu baris order_details) ---------- */
CREATE TABLE garment.spk (
    id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_spk_id DEFAULT NEWSEQUENTIALID(),
    spk_no                CHAR(12)         NOT NULL,
    order_detail_id       UNIQUEIDENTIFIER NOT NULL,
    line_id               UNIQUEIDENTIFIER NOT NULL,
    created_by            UNIQUEIDENTIFIER NOT NULL,
    materials_complete_by UNIQUEIDENTIFIER NOT NULL,
    decided_by            UNIQUEIDENTIFIER NULL,
    start_date            DATE             NULL,
    target_date           DATE             NOT NULL,
    finish_date           DATE             NULL,
    status                VARCHAR(20)      NOT NULL CONSTRAINT df_spk_status DEFAULT 'MENUNGGU_PERSETUJUAN',
    approved_at           DATETIME2(0)     NULL,
    reject_reason         NVARCHAR(500)    NULL,
    created_at            DATETIME2(0)     NOT NULL CONSTRAINT df_spk_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_spk PRIMARY KEY (id),
    CONSTRAINT uq_spk_no UNIQUE (spk_no),
    CONSTRAINT fk_spk_order_detail FOREIGN KEY (order_detail_id)       REFERENCES garment.order_details(id),
    CONSTRAINT fk_spk_line         FOREIGN KEY (line_id)               REFERENCES garment.production_lines(id),
    CONSTRAINT fk_spk_created_by   FOREIGN KEY (created_by)            REFERENCES garment.employees(id),
    CONSTRAINT fk_spk_materials_by FOREIGN KEY (materials_complete_by) REFERENCES garment.employees(id),
    CONSTRAINT fk_spk_decided_by   FOREIGN KEY (decided_by)            REFERENCES garment.employees(id),
    CONSTRAINT ck_spk_no_format CHECK (spk_no LIKE 'SPK-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]'),
    CONSTRAINT ck_spk_status    CHECK (status IN ('MENUNGGU_PERSETUJUAN','DISETUJUI','DITOLAK')),
    -- approved_at wajib terisi untuk semua status selain MENUNGGU_PERSETUJUAN dan DITOLAK
    CONSTRAINT ck_spk_approved_at CHECK (status IN ('MENUNGGU_PERSETUJUAN','DITOLAK') OR approved_at IS NOT NULL),
    -- alasan wajib bila DITOLAK (RB-33)
    CONSTRAINT ck_spk_reject_reason CHECK (status <> 'DITOLAK' OR LEN(LTRIM(RTRIM(ISNULL(reject_reason, '')))) > 0),
    CONSTRAINT ck_spk_dates CHECK (
        (finish_date IS NULL OR start_date IS NULL OR finish_date >= start_date)
    )
);
GO
-- RB-31: satu SPK aktif per style; SPK DITOLAK tidak dihitung
CREATE UNIQUE INDEX uq_spk_detail_active ON garment.spk (order_detail_id)
    WHERE status IN ('MENUNGGU_PERSETUJUAN','DISETUJUI');
GO
CREATE INDEX ix_spk_status ON garment.spk (status);
GO

/* ---------- spk_sizes (entitas lemah) ---------- */
CREATE TABLE garment.spk_sizes (
    spk_id UNIQUEIDENTIFIER NOT NULL,
    size   VARCHAR(10)      NOT NULL,
    qty    INT              NOT NULL,
    CONSTRAINT pk_spk_sizes PRIMARY KEY (spk_id, size),
    CONSTRAINT fk_spk_sizes_spk FOREIGN KEY (spk_id) REFERENCES garment.spk(id),
    CONSTRAINT ck_spk_sizes_qty CHECK (qty > 0)
);
GO

/* ---------- production_progress (SPV hanya mengisi qty_done, K-09) ---------- */
CREATE TABLE garment.production_progress (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_production_progress_id DEFAULT NEWSEQUENTIALID(),
    spk_id        UNIQUEIDENTIFIER NOT NULL,
    stage_code    VARCHAR(10)      NOT NULL,
    work_date     DATE             NOT NULL,
    qty_done      INT              NOT NULL,
    variance_note NVARCHAR(300)    NULL,   -- wajib bila kumulatif Cutting <> jumlah SPK (dicek di SP)
    recorded_by   UNIQUEIDENTIFIER NOT NULL,
    created_at    DATETIME2(0)     NOT NULL CONSTRAINT df_production_progress_created DEFAULT SYSDATETIME(),
    updated_at    DATETIME2(0)     NOT NULL CONSTRAINT df_production_progress_updated DEFAULT SYSDATETIME(),
    CONSTRAINT pk_production_progress PRIMARY KEY (id),
    CONSTRAINT uq_production_progress_spk_stage_date UNIQUE (spk_id, stage_code, work_date),
    CONSTRAINT fk_production_progress_spk   FOREIGN KEY (spk_id)      REFERENCES garment.spk(id),
    CONSTRAINT fk_production_progress_stage FOREIGN KEY (stage_code)  REFERENCES garment.production_stages(stage_code),
    CONSTRAINT fk_production_progress_by    FOREIGN KEY (recorded_by) REFERENCES garment.employees(id),
    CONSTRAINT ck_production_progress_qty   CHECK (qty_done >= 0)
);
GO
CREATE INDEX ix_production_progress_work_date ON garment.production_progress (work_date);
GO

/* ---------- order_materials (RSI: materials) ---------- */
CREATE TABLE garment.order_materials (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_order_materials_id DEFAULT NEWSEQUENTIALID(),
    order_detail_id UNIQUEIDENTIFIER NOT NULL,
    material_id     UNIQUEIDENTIFIER NOT NULL,
    qty             DECIMAL(12,2)    NOT NULL,
    unit            NVARCHAR(20)     NOT NULL,
    source          VARCHAR(8)       NOT NULL,
    supplier_id     UNIQUEIDENTIFIER NULL,
    material_price  DECIMAL(16,2)    NULL,
    received_date   DATE             NOT NULL,
    checked_by      UNIQUEIDENTIFIER NOT NULL,
    checked_at      DATETIME2(0)     NOT NULL CONSTRAINT df_order_materials_checked DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0)     NOT NULL CONSTRAINT df_order_materials_updated DEFAULT SYSDATETIME(),
    CONSTRAINT pk_order_materials PRIMARY KEY (id),
    CONSTRAINT fk_order_materials_detail   FOREIGN KEY (order_detail_id) REFERENCES garment.order_details(id),
    CONSTRAINT fk_order_materials_material FOREIGN KEY (material_id)     REFERENCES garment.raw_materials(id),
    CONSTRAINT fk_order_materials_supplier FOREIGN KEY (supplier_id)     REFERENCES garment.suppliers(id),
    CONSTRAINT fk_order_materials_checker  FOREIGN KEY (checked_by)      REFERENCES garment.employees(id),
    CONSTRAINT ck_order_materials_qty    CHECK (qty > 0),
    CONSTRAINT ck_order_materials_source CHECK (source IN ('BUYER','SUPPLIER')),
    CONSTRAINT ck_order_materials_price  CHECK (material_price IS NULL OR material_price > 0),
    -- RB-26: supplier dan harga wajib bila bahan dari supplier
    CONSTRAINT ck_order_materials_supplier_required CHECK (
        source <> 'SUPPLIER' OR (supplier_id IS NOT NULL AND material_price IS NOT NULL)
    )
);
GO
CREATE INDEX ix_order_materials_detail   ON garment.order_materials (order_detail_id);
GO
CREATE INDEX ix_order_materials_supplier ON garment.order_materials (supplier_id);
GO

/* ---------- material_usages ---------- */
CREATE TABLE garment.material_usages (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_material_usages_id DEFAULT NEWSEQUENTIALID(),
    spk_id      UNIQUEIDENTIFIER NOT NULL,
    material_id UNIQUEIDENTIFIER NOT NULL,
    batch_no    VARCHAR(30)      NOT NULL,
    used_qty    DECIMAL(12,2)    NOT NULL,
    usage_date  DATE             NOT NULL,
    recorded_by UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT pk_material_usages PRIMARY KEY (id),
    CONSTRAINT fk_material_usages_spk      FOREIGN KEY (spk_id)      REFERENCES garment.spk(id),
    CONSTRAINT fk_material_usages_material FOREIGN KEY (material_id) REFERENCES garment.raw_materials(id),
    CONSTRAINT fk_material_usages_by       FOREIGN KEY (recorded_by) REFERENCES garment.employees(id),
    CONSTRAINT ck_material_usages_qty CHECK (used_qty > 0)
);
GO

/* ---------- purchase_orders ---------- */
CREATE TABLE garment.purchase_orders (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_purchase_orders_id DEFAULT NEWSEQUENTIALID(),
    po_no         CHAR(11)         NOT NULL,
    supplier_id   UNIQUEIDENTIFIER NOT NULL,
    factory_id    UNIQUEIDENTIFIER NOT NULL,
    order_id      UNIQUEIDENTIFIER NULL,
    created_by    UNIQUEIDENTIFIER NOT NULL,
    approved_by   UNIQUEIDENTIFIER NULL,
    po_date       DATE             NOT NULL CONSTRAINT df_purchase_orders_date DEFAULT CAST(SYSDATETIME() AS DATE),
    required_date DATE             NOT NULL,
    incoterm      VARCHAR(3)       NULL,
    currency      CHAR(3)          NOT NULL CONSTRAINT df_purchase_orders_currency DEFAULT 'IDR',
    exchange_rate DECIMAL(12,4)    NOT NULL CONSTRAINT df_purchase_orders_rate DEFAULT 1,
    status        VARCHAR(17)      NOT NULL CONSTRAINT df_purchase_orders_status DEFAULT 'DRAF',
    CONSTRAINT pk_purchase_orders PRIMARY KEY (id),
    CONSTRAINT uq_purchase_orders_no UNIQUE (po_no),
    CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES garment.suppliers(id),
    CONSTRAINT fk_purchase_orders_factory  FOREIGN KEY (factory_id)  REFERENCES garment.factories(id),
    CONSTRAINT fk_purchase_orders_order    FOREIGN KEY (order_id)    REFERENCES garment.orders(id),
    CONSTRAINT fk_purchase_orders_creator  FOREIGN KEY (created_by)  REFERENCES garment.employees(id),
    CONSTRAINT fk_purchase_orders_approver FOREIGN KEY (approved_by) REFERENCES garment.employees(id),
    CONSTRAINT ck_purchase_orders_no_format CHECK (po_no LIKE 'PO-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]'),
    CONSTRAINT ck_purchase_orders_dates  CHECK (required_date >= po_date),
    CONSTRAINT ck_purchase_orders_incoterm CHECK (incoterm IS NULL OR incoterm IN ('EXW','FCA','FOB','CFR','CIF','DAP','DDP')),
    CONSTRAINT ck_purchase_orders_rate   CHECK (exchange_rate > 0),
    CONSTRAINT ck_purchase_orders_status CHECK (status IN ('DRAF','DISETUJUI','DITERIMA_SEBAGIAN','SELESAI','DIBATALKAN'))
);
GO

/* ---------- purchase_order_items ---------- */
CREATE TABLE garment.purchase_order_items (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_purchase_order_items_id DEFAULT NEWSEQUENTIALID(),
    po_id       UNIQUEIDENTIFIER NOT NULL,
    material_id UNIQUEIDENTIFIER NOT NULL,
    ordered_qty DECIMAL(12,2)    NOT NULL,
    unit_price  DECIMAL(16,2)    NOT NULL,
    CONSTRAINT pk_purchase_order_items PRIMARY KEY (id),
    CONSTRAINT uq_purchase_order_items UNIQUE (po_id, material_id),
    CONSTRAINT fk_purchase_order_items_po       FOREIGN KEY (po_id)       REFERENCES garment.purchase_orders(id),
    CONSTRAINT fk_purchase_order_items_material FOREIGN KEY (material_id) REFERENCES garment.raw_materials(id),
    CONSTRAINT ck_purchase_order_items_qty   CHECK (ordered_qty > 0),
    CONSTRAINT ck_purchase_order_items_price CHECK (unit_price > 0)
);
GO

/* ---------- material_receipts ---------- */
CREATE TABLE garment.material_receipts (
    id                        UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_material_receipts_id DEFAULT NEWSEQUENTIALID(),
    po_id                     UNIQUEIDENTIFIER NOT NULL,
    warehouse_id              UNIQUEIDENTIFIER NOT NULL,
    received_by               UNIQUEIDENTIFIER NOT NULL,
    supplier_delivery_note_no VARCHAR(30)      NOT NULL,
    arrival_date              DATE             NOT NULL,
    CONSTRAINT pk_material_receipts PRIMARY KEY (id),
    CONSTRAINT fk_material_receipts_po        FOREIGN KEY (po_id)        REFERENCES garment.purchase_orders(id),
    CONSTRAINT fk_material_receipts_warehouse FOREIGN KEY (warehouse_id) REFERENCES garment.warehouses(id),
    CONSTRAINT fk_material_receipts_receiver  FOREIGN KEY (received_by)  REFERENCES garment.employees(id)
);
GO

/* ---------- material_receipt_items ---------- */
CREATE TABLE garment.material_receipt_items (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_material_receipt_items_id DEFAULT NEWSEQUENTIALID(),
    receipt_id     UNIQUEIDENTIFIER NOT NULL,
    po_item_id     UNIQUEIDENTIFIER NOT NULL,
    origin_country CHAR(2)          NOT NULL,
    batch_no       VARCHAR(30)      NOT NULL,
    received_qty   DECIMAL(12,2)    NOT NULL,
    rejected_qty   DECIMAL(12,2)    NOT NULL CONSTRAINT df_material_receipt_items_rejected DEFAULT 0,
    CONSTRAINT pk_material_receipt_items PRIMARY KEY (id),
    CONSTRAINT fk_material_receipt_items_receipt FOREIGN KEY (receipt_id)     REFERENCES garment.material_receipts(id),
    CONSTRAINT fk_material_receipt_items_po_item FOREIGN KEY (po_item_id)     REFERENCES garment.purchase_order_items(id),
    CONSTRAINT fk_material_receipt_items_country FOREIGN KEY (origin_country) REFERENCES garment.countries(country_code),
    CONSTRAINT ck_material_receipt_items_qty CHECK (received_qty > 0 AND rejected_qty >= 0 AND rejected_qty <= received_qty)
);
GO

/* ---------- import_documents (1:1 dengan material_receipts) ---------- */
CREATE TABLE garment.import_documents (
    id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_import_documents_id DEFAULT NEWSEQUENTIALID(),
    receipt_id            UNIQUEIDENTIFIER NOT NULL,
    forwarder_id          UNIQUEIDENTIFIER NULL,
    customs_document_type VARCHAR(4)       NOT NULL,
    customs_document_no   VARCHAR(30)      NOT NULL,
    document_date         DATE             NOT NULL,
    bl_awb_no             VARCHAR(30)      NOT NULL,
    loading_port          NVARCHAR(60)     NOT NULL,
    discharge_port        NVARCHAR(60)     NOT NULL,
    cif_value             DECIMAL(16,2)    NOT NULL,
    import_duty           DECIMAL(16,2)    NOT NULL,
    import_vat            DECIMAL(16,2)    NOT NULL,
    import_pph22          DECIMAL(16,2)    NOT NULL,
    customs_status        VARCHAR(7)       NOT NULL CONSTRAINT df_import_documents_status DEFAULT 'PROSES',
    CONSTRAINT pk_import_documents PRIMARY KEY (id),
    CONSTRAINT uq_import_documents_receipt UNIQUE (receipt_id),
    CONSTRAINT fk_import_documents_receipt   FOREIGN KEY (receipt_id)   REFERENCES garment.material_receipts(id),
    CONSTRAINT fk_import_documents_forwarder FOREIGN KEY (forwarder_id) REFERENCES garment.expeditions(id),
    CONSTRAINT ck_import_documents_type   CHECK (customs_document_type IN ('BC20','BC23')),
    CONSTRAINT ck_import_documents_values CHECK (cif_value >= 0 AND import_duty >= 0 AND import_vat >= 0 AND import_pph22 >= 0),
    CONSTRAINT ck_import_documents_status CHECK (customs_status IN ('PROSES','SELESAI'))
);
GO

/* ---------- qc_results ---------- */
CREATE TABLE garment.qc_results (
    id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_qc_results_id DEFAULT NEWSEQUENTIALID(),
    inspection_type    VARCHAR(8)       NOT NULL,
    spk_id             UNIQUEIDENTIFIER NULL,
    stage_code         VARCHAR(10)      NULL,
    receipt_item_id    UNIQUEIDENTIFIER NULL,
    standard_id        UNIQUEIDENTIFIER NOT NULL,
    inspected_by       UNIQUEIDENTIFIER NOT NULL,
    check_date         DATE             NOT NULL,
    sample_qty         INT              NULL,
    qty_passed         INT              NOT NULL,
    final_result       VARCHAR(11)      NULL,
    inspected_by_buyer BIT              NOT NULL CONSTRAINT df_qc_results_by_buyer DEFAULT 0,
    created_at         DATETIME2(0)     NOT NULL CONSTRAINT df_qc_results_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_qc_results PRIMARY KEY (id),
    CONSTRAINT fk_qc_results_spk       FOREIGN KEY (spk_id)          REFERENCES garment.spk(id),
    CONSTRAINT fk_qc_results_stage     FOREIGN KEY (stage_code)      REFERENCES garment.production_stages(stage_code),
    CONSTRAINT fk_qc_results_receipt   FOREIGN KEY (receipt_item_id) REFERENCES garment.material_receipt_items(id),
    CONSTRAINT fk_qc_results_standard  FOREIGN KEY (standard_id)     REFERENCES garment.qc_standards(id),
    CONSTRAINT fk_qc_results_inspector FOREIGN KEY (inspected_by)    REFERENCES garment.employees(id),
    CONSTRAINT ck_qc_results_type   CHECK (inspection_type IN ('INCOMING','INLINE','FINAL')),
    -- INCOMING: memeriksa bahan masuk. INLINE/FINAL: memeriksa SPK pada suatu tahap.
    CONSTRAINT ck_qc_results_target CHECK (
        (inspection_type = 'INCOMING' AND receipt_item_id IS NOT NULL AND spk_id IS NULL AND stage_code IS NULL) OR
        (inspection_type IN ('INLINE','FINAL') AND spk_id IS NOT NULL AND stage_code IS NOT NULL AND receipt_item_id IS NULL)
    ),
    CONSTRAINT ck_qc_results_stage  CHECK (stage_code IS NULL OR stage_code <> 'PACKING'),   -- RB-41
    CONSTRAINT ck_qc_results_qty    CHECK (qty_passed >= 0 AND (sample_qty IS NULL OR sample_qty > 0)),
    CONSTRAINT ck_qc_results_result CHECK (final_result IS NULL OR final_result IN ('LOLOS','TIDAK_LOLOS'))
);
GO
CREATE INDEX ix_qc_results_spk_stage ON garment.qc_results (spk_id, stage_code);
GO

/* ---------- qc_defects ---------- */
CREATE TABLE garment.qc_defects (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_qc_defects_id DEFAULT NEWSEQUENTIALID(),
    qc_id          UNIQUEIDENTIFIER NOT NULL,
    defect_type_id UNIQUEIDENTIFIER NOT NULL,
    qty            INT              NOT NULL,
    action_taken   NVARCHAR(200)    NULL,
    CONSTRAINT pk_qc_defects PRIMARY KEY (id),
    CONSTRAINT uq_qc_defects UNIQUE (qc_id, defect_type_id),
    CONSTRAINT fk_qc_defects_qc   FOREIGN KEY (qc_id)          REFERENCES garment.qc_results(id),
    CONSTRAINT fk_qc_defects_type FOREIGN KEY (defect_type_id) REFERENCES garment.defect_types(id),
    CONSTRAINT ck_qc_defects_qty  CHECK (qty > 0)
);
GO

/* ---------- product_stocks ---------- */
CREATE TABLE garment.product_stocks (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_product_stocks_id DEFAULT NEWSEQUENTIALID(),
    location_id     UNIQUEIDENTIFIER NOT NULL,
    variant_id      UNIQUEIDENTIFIER NOT NULL,
    spk_id          UNIQUEIDENTIFIER NULL,
    available_qty   INT              NOT NULL CONSTRAINT df_product_stocks_qty DEFAULT 0,
    goods_condition VARCHAR(5)       NOT NULL CONSTRAINT df_product_stocks_condition DEFAULT 'BAIK',
    updated_at      DATETIME2(0)     NOT NULL CONSTRAINT df_product_stocks_updated DEFAULT SYSDATETIME(),
    CONSTRAINT pk_product_stocks PRIMARY KEY (id),
    CONSTRAINT fk_product_stocks_location FOREIGN KEY (location_id) REFERENCES garment.rack_locations(id),
    CONSTRAINT fk_product_stocks_variant  FOREIGN KEY (variant_id)  REFERENCES garment.item_variants(id),
    CONSTRAINT fk_product_stocks_spk      FOREIGN KEY (spk_id)      REFERENCES garment.spk(id),
    CONSTRAINT ck_product_stocks_qty       CHECK (available_qty >= 0),
    CONSTRAINT ck_product_stocks_condition CHECK (goods_condition IN ('BAIK','RUSAK'))
);
GO

/* ---------- stock_movements (stok hanya berubah lewat tabel ini) ---------- */
CREATE TABLE garment.stock_movements (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_stock_movements_id DEFAULT NEWSEQUENTIALID(),
    movement_type    VARCHAR(11)      NOT NULL,
    from_location_id UNIQUEIDENTIFIER NULL,
    to_location_id   UNIQUEIDENTIFIER NULL,
    material_id      UNIQUEIDENTIFIER NULL,
    variant_id       UNIQUEIDENTIFIER NULL,
    batch_no         VARCHAR(30)      NULL,
    qty              DECIMAL(12,2)    NOT NULL,
    reference_type   VARCHAR(20)      NOT NULL,
    reference_no     VARCHAR(30)      NOT NULL,
    moved_by         UNIQUEIDENTIFIER NOT NULL,
    movement_date    DATETIME2(0)     NOT NULL CONSTRAINT df_stock_movements_date DEFAULT SYSDATETIME(),
    CONSTRAINT pk_stock_movements PRIMARY KEY (id),
    CONSTRAINT fk_stock_movements_from     FOREIGN KEY (from_location_id) REFERENCES garment.rack_locations(id),
    CONSTRAINT fk_stock_movements_to       FOREIGN KEY (to_location_id)   REFERENCES garment.rack_locations(id),
    CONSTRAINT fk_stock_movements_material FOREIGN KEY (material_id)      REFERENCES garment.raw_materials(id),
    CONSTRAINT fk_stock_movements_variant  FOREIGN KEY (variant_id)       REFERENCES garment.item_variants(id),
    CONSTRAINT fk_stock_movements_by       FOREIGN KEY (moved_by)         REFERENCES garment.employees(id),
    CONSTRAINT ck_stock_movements_type CHECK (movement_type IN ('MASUK','KELUAR','PINDAH','PENYESUAIAN')),
    -- tepat satu barang: bahan ATAU varian produk
    CONSTRAINT ck_stock_movements_item CHECK (
        (material_id IS NOT NULL AND variant_id IS NULL) OR
        (material_id IS NULL AND variant_id IS NOT NULL)
    ),
    -- lokasi sesuai jenis mutasi
    CONSTRAINT ck_stock_movements_location CHECK (
        (movement_type = 'MASUK'       AND to_location_id IS NOT NULL AND from_location_id IS NULL) OR
        (movement_type = 'KELUAR'      AND from_location_id IS NOT NULL AND to_location_id IS NULL) OR
        (movement_type = 'PINDAH'      AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL
                                       AND from_location_id <> to_location_id) OR
        (movement_type = 'PENYESUAIAN' AND (from_location_id IS NOT NULL OR to_location_id IS NOT NULL))
    ),
    CONSTRAINT ck_stock_movements_qty CHECK (qty > 0)
);
GO

/* ---------- stock_counts (stok opname) ---------- */
CREATE TABLE garment.stock_counts (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_stock_counts_id DEFAULT NEWSEQUENTIALID(),
    location_id    UNIQUEIDENTIFIER NOT NULL,
    material_id    UNIQUEIDENTIFIER NULL,
    variant_id     UNIQUEIDENTIFIER NULL,
    counted_by     UNIQUEIDENTIFIER NOT NULL,
    count_date     DATE             NOT NULL,
    system_stock   DECIMAL(12,2)    NOT NULL,
    physical_stock DECIMAL(12,2)    NOT NULL,
    CONSTRAINT pk_stock_counts PRIMARY KEY (id),
    CONSTRAINT fk_stock_counts_location FOREIGN KEY (location_id) REFERENCES garment.rack_locations(id),
    CONSTRAINT fk_stock_counts_material FOREIGN KEY (material_id) REFERENCES garment.raw_materials(id),
    CONSTRAINT fk_stock_counts_variant  FOREIGN KEY (variant_id)  REFERENCES garment.item_variants(id),
    CONSTRAINT fk_stock_counts_by       FOREIGN KEY (counted_by)  REFERENCES garment.employees(id),
    CONSTRAINT ck_stock_counts_item CHECK (
        (material_id IS NOT NULL AND variant_id IS NULL) OR
        (material_id IS NULL AND variant_id IS NOT NULL)
    ),
    CONSTRAINT ck_stock_counts_qty CHECK (system_stock >= 0 AND physical_stock >= 0)
);
GO