-- =====================================================================
-- Schema garment. Dijalankan setelah 00, 01, 02, 03.
--
-- BAGIAN 1: tabel yang hanya bergantung pada tabel A (01-org.sql).
--           Bisa dicoba sekarang: jalankan 00 -> 01 -> file ini.
-- BAGIAN 2: tabel yang bergantung pada tabel B (03-order.sql).
--           Ditulis setelah 03-order.sql tersedia.
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
   BAGIAN 2 (menyusul setelah 03-order.sql dari B tersedia)
   spk, spk_sizes, production_progress, bom, order_materials,
   material_usages, purchase_orders, purchase_order_items,
   material_receipts, material_receipt_items, import_documents,
   qc_standards, qc_results, qc_defects, product_stocks,
   stock_movements, stock_counts
   ===================================================================== */