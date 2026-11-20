USE solaris_db;
GO

/* ---------- factories ---------- */
CREATE TABLE garment.factories (
    id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_factories_id DEFAULT NEWSEQUENTIALID(),
    factory_name       NVARCHAR(100)    NOT NULL,
    address            NVARCHAR(200)    NOT NULL,
    city               NVARCHAR(50)     NOT NULL,
    province           NVARCHAR(50)     NOT NULL,
    phone              VARCHAR(20)      NOT NULL,
    email              VARCHAR(100)     NULL,
    bonded_zone_status BIT              NOT NULL CONSTRAINT df_factories_bonded DEFAULT 0,
    operating_status   VARCHAR(10)      NOT NULL,
    created_at         DATETIME2(0)     NOT NULL CONSTRAINT df_factories_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_factories PRIMARY KEY (id),
    CONSTRAINT ck_factories_status CHECK (operating_status IN ('AKTIF','NONAKTIF'))
);
GO

/* ---------- countries ---------- */
CREATE TABLE garment.countries (
    country_code CHAR(2)      NOT NULL,
    country_name NVARCHAR(60) NOT NULL,
    CONSTRAINT pk_countries PRIMARY KEY (country_code),
    CONSTRAINT ck_countries_code CHECK (country_code NOT LIKE '%[^A-Z]%')
);
GO

/* ---------- production_stages (dipakai B dan C) ---------- */
CREATE TABLE garment.production_stages (
    stage_code VARCHAR(10)  NOT NULL,
    stage_name NVARCHAR(30) NOT NULL,
    sequence   TINYINT      NOT NULL,
    CONSTRAINT pk_production_stages PRIMARY KEY (stage_code),
    CONSTRAINT ck_production_stages_code CHECK (stage_code IN ('CUTTING','SEWING','TRIMMING','FINISHING','IRONING','PACKING')),
    CONSTRAINT uq_production_stages_seq UNIQUE (sequence),
    CONSTRAINT ck_production_stages_seq CHECK (sequence BETWEEN 1 AND 6)
);
GO

/* ---------- divisions (tanpa kolom kepala dulu; relasi melingkar dengan employees) ---------- */
CREATE TABLE garment.divisions (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_divisions_id DEFAULT NEWSEQUENTIALID(),
    factory_id    UNIQUEIDENTIFIER NOT NULL,
    division_name NVARCHAR(60)     NOT NULL,
    CONSTRAINT pk_divisions PRIMARY KEY (id),
    CONSTRAINT fk_divisions_factory FOREIGN KEY (factory_id) REFERENCES garment.factories(id)
);
GO

/* ---------- positions ---------- */
CREATE TABLE garment.positions (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_positions_id DEFAULT NEWSEQUENTIALID(),
    position_name   NVARCHAR(60)     NOT NULL,
    position_level  TINYINT          NOT NULL,
    base_salary_min DECIMAL(16,2)    NOT NULL,
    base_salary_max DECIMAL(16,2)    NOT NULL,
    CONSTRAINT pk_positions PRIMARY KEY (id),
    CONSTRAINT ck_positions_salary CHECK (base_salary_min <= base_salary_max)
);
GO

/* ---------- shifts ---------- */
CREATE TABLE garment.shifts (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_shifts_id DEFAULT NEWSEQUENTIALID(),
    shift_name NVARCHAR(30)     NOT NULL,
    start_time TIME(0)          NOT NULL,
    end_time   TIME(0)          NOT NULL,
    CONSTRAINT pk_shifts PRIMARY KEY (id)
);
GO

/* ---------- employees ---------- */
CREATE TABLE garment.employees (
    id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_employees_id DEFAULT NEWSEQUENTIALID(),
    nik                 CHAR(16)         NOT NULL,
    full_name           NVARCHAR(100)    NOT NULL,
    birth_date          DATE             NOT NULL,
    gender              CHAR(1)          NOT NULL,
    employee_type       VARCHAR(12)      NOT NULL,
    address             NVARCHAR(200)    NOT NULL,
    phone               VARCHAR(20)      NOT NULL,
    email               VARCHAR(100)     NULL,
    npwp                VARCHAR(20)      NULL,
    bpjs_health_no      VARCHAR(20)      NULL,
    bpjs_employment_no  VARCHAR(20)      NULL,
    bank_name           NVARCHAR(50)     NULL,
    account_no          VARCHAR(30)      NULL,
    factory_id          UNIQUEIDENTIFIER NOT NULL,
    division_id         UNIQUEIDENTIFIER NOT NULL,
    position_id         UNIQUEIDENTIFIER NOT NULL,
    shift_id            UNIQUEIDENTIFIER NULL,
    is_active           BIT              NOT NULL CONSTRAINT df_employees_active DEFAULT 1,
    join_date           DATE             NOT NULL,
    created_at          DATETIME2(0)     NOT NULL CONSTRAINT df_employees_created DEFAULT SYSDATETIME(),
    updated_at          DATETIME2(0)     NOT NULL CONSTRAINT df_employees_updated DEFAULT SYSDATETIME(),
    CONSTRAINT pk_employees PRIMARY KEY (id),
    CONSTRAINT uq_employees_nik UNIQUE (nik),
    CONSTRAINT ck_employees_nik CHECK (nik NOT LIKE '%[^0-9]%'),
    CONSTRAINT ck_employees_gender CHECK (gender IN ('L','P')),
    CONSTRAINT ck_employees_type CHECK (employee_type IN ('TETAP','KONTRAK','HARIAN','MAGANG','OUTSOURCING')),
    CONSTRAINT fk_employees_factory  FOREIGN KEY (factory_id)  REFERENCES garment.factories(id),
    CONSTRAINT fk_employees_division FOREIGN KEY (division_id) REFERENCES garment.divisions(id),
    CONSTRAINT fk_employees_position FOREIGN KEY (position_id) REFERENCES garment.positions(id),
    CONSTRAINT fk_employees_shift    FOREIGN KEY (shift_id)    REFERENCES garment.shifts(id)
);
GO

/* ---------- divisions.head_employee_id (relasi 1:1, ditambahkan setelah employees) ---------- */
ALTER TABLE garment.divisions ADD head_employee_id UNIQUEIDENTIFIER NULL;
GO
ALTER TABLE garment.divisions
    ADD CONSTRAINT fk_divisions_head FOREIGN KEY (head_employee_id) REFERENCES garment.employees(id);
GO
CREATE UNIQUE INDEX uq_divisions_head ON garment.divisions(head_employee_id)
    WHERE head_employee_id IS NOT NULL;
GO

/* ---------- employment_contracts (entitas lemah) ---------- */
CREATE TABLE garment.employment_contracts (
    employee_id          UNIQUEIDENTIFIER NOT NULL,
    contract_seq         TINYINT          NOT NULL,
    contract_type        VARCHAR(10)      NOT NULL,
    contract_document_no VARCHAR(30)      NOT NULL,
    base_salary          DECIMAL(16,2)    NOT NULL,
    start_date           DATE             NOT NULL,
    finish_date          DATE             NULL,
    status               VARCHAR(10)      NOT NULL,
    CONSTRAINT pk_employment_contracts PRIMARY KEY (employee_id, contract_seq),
    CONSTRAINT fk_employment_contracts_emp FOREIGN KEY (employee_id) REFERENCES garment.employees(id),
    CONSTRAINT ck_employment_contracts_type   CHECK (contract_type IN ('PKWT','PKWTT','HARIAN','MAGANG')),
    CONSTRAINT ck_employment_contracts_status CHECK (status IN ('AKTIF','SELESAI','DIPUTUS')),
    CONSTRAINT ck_employment_contracts_salary CHECK (base_salary >= 0),
    CONSTRAINT ck_employment_contracts_dates  CHECK (finish_date IS NULL OR finish_date >= start_date)
);
GO

/* ---------- skills ---------- */
CREATE TABLE garment.skills (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_skills_id DEFAULT NEWSEQUENTIALID(),
    skill_category NVARCHAR(50)     NOT NULL,
    skill_name     NVARCHAR(80)     NOT NULL,
    CONSTRAINT pk_skills PRIMARY KEY (id)
);
GO

/* ---------- employee_skills (M:N masters) ---------- */
CREATE TABLE garment.employee_skills (
    employee_id    UNIQUEIDENTIFIER NOT NULL,
    skill_id       UNIQUEIDENTIFIER NOT NULL,
    skill_level    VARCHAR(10)      NOT NULL,
    certified_date DATE             NULL,
    CONSTRAINT pk_employee_skills PRIMARY KEY (employee_id, skill_id),
    CONSTRAINT fk_employee_skills_emp   FOREIGN KEY (employee_id) REFERENCES garment.employees(id),
    CONSTRAINT fk_employee_skills_skill FOREIGN KEY (skill_id)    REFERENCES garment.skills(id),
    CONSTRAINT ck_employee_skills_level CHECK (skill_level IN ('DASAR','MENENGAH','AHLI'))
);
GO

/* ---------- interns (subclass employees) ---------- */
CREATE TABLE garment.interns (
    employee_id  UNIQUEIDENTIFIER NOT NULL,
    mentor_id    UNIQUEIDENTIFIER NOT NULL,
    institution  NVARCHAR(100)    NOT NULL,
    major        NVARCHAR(80)     NOT NULL,
    program_type VARCHAR(10)      NOT NULL,
    allowance    DECIMAL(16,2)    NOT NULL,
    start_date   DATE             NOT NULL,
    finish_date  DATE             NOT NULL,
    final_score  DECIMAL(5,2)     NULL,
    CONSTRAINT pk_interns PRIMARY KEY (employee_id),
    CONSTRAINT fk_interns_employee FOREIGN KEY (employee_id) REFERENCES garment.employees(id),
    CONSTRAINT fk_interns_mentor   FOREIGN KEY (mentor_id)   REFERENCES garment.employees(id),
    CONSTRAINT ck_interns_mentor   CHECK (mentor_id <> employee_id),
    CONSTRAINT ck_interns_program  CHECK (program_type IN ('PKL','KAMPUS','MANDIRI')),
    CONSTRAINT ck_interns_dates    CHECK (finish_date >= start_date),
    CONSTRAINT ck_interns_score    CHECK (final_score IS NULL OR final_score BETWEEN 0 AND 100)
);
GO

/* ---------- attendances (entitas lemah) ---------- */
CREATE TABLE garment.attendances (
    employee_id       UNIQUEIDENTIFIER NOT NULL,
    work_date         DATE             NOT NULL,
    clock_in          TIME(0)          NOT NULL,
    clock_out         TIME(0)          NULL,
    overtime_hours    DECIMAL(4,1)     NOT NULL CONSTRAINT df_attendances_ot DEFAULT 0,
    attendance_status VARCHAR(10)      NOT NULL,
    CONSTRAINT pk_attendances PRIMARY KEY (employee_id, work_date),
    CONSTRAINT fk_attendances_employee FOREIGN KEY (employee_id) REFERENCES garment.employees(id),
    CONSTRAINT ck_attendances_status CHECK (attendance_status IN ('HADIR','IZIN','SAKIT','ALPA','CUTI')),
    CONSTRAINT ck_attendances_ot     CHECK (overtime_hours >= 0)
);
GO

/* ---------- warehouses ---------- */
CREATE TABLE garment.warehouses (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_warehouses_id DEFAULT NEWSEQUENTIALID(),
    factory_id       UNIQUEIDENTIFIER NOT NULL,
    head_employee_id UNIQUEIDENTIFIER NOT NULL,
    warehouse_name   NVARCHAR(60)     NOT NULL,
    warehouse_type   VARCHAR(12)      NOT NULL,
    address          NVARCHAR(200)    NOT NULL,
    capacity_m3      DECIMAL(10,2)    NOT NULL,
    CONSTRAINT pk_warehouses PRIMARY KEY (id),
    CONSTRAINT fk_warehouses_factory FOREIGN KEY (factory_id)       REFERENCES garment.factories(id),
    CONSTRAINT fk_warehouses_head    FOREIGN KEY (head_employee_id) REFERENCES garment.employees(id),
    CONSTRAINT ck_warehouses_type CHECK (warehouse_type IN ('BAHAN','BARANG_JADI','CAMPURAN')),
    CONSTRAINT ck_warehouses_cap  CHECK (capacity_m3 >= 0)
);
GO

/* ---------- rack_locations ---------- */
CREATE TABLE garment.rack_locations (
    id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_rack_locations_id DEFAULT NEWSEQUENTIALID(),
    warehouse_id UNIQUEIDENTIFIER NOT NULL,
    rack_code    VARCHAR(20)      NOT NULL,
    capacity     INT              NOT NULL,
    CONSTRAINT pk_rack_locations PRIMARY KEY (id),
    CONSTRAINT fk_rack_locations_wh FOREIGN KEY (warehouse_id) REFERENCES garment.warehouses(id),
    CONSTRAINT uq_rack_locations UNIQUE (warehouse_id, rack_code),
    CONSTRAINT ck_rack_locations_cap CHECK (capacity >= 0)
);
GO
