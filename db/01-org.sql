USE solaris_db;
GO

-- ---------------------------------------------------------------------------
-- factories
-- ---------------------------------------------------------------------------
CREATE TABLE garment.factories (
    id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_factories_id DEFAULT NEWSEQUENTIALID(),
    factory_name        NVARCHAR(100)    NOT NULL,
    address             NVARCHAR(200)    NOT NULL,
    city                NVARCHAR(50)     NOT NULL,
    province            NVARCHAR(50)     NOT NULL,
    phone               VARCHAR(20)      NOT NULL,
    email               VARCHAR(100)     NULL,
    bonded_zone_status  BIT              NOT NULL CONSTRAINT DF_factories_bonded DEFAULT 0,
    operating_status    VARCHAR(10)      NOT NULL,
    created_at          DATETIME2(0)     NOT NULL CONSTRAINT DF_factories_created DEFAULT SYSDATETIME(),
    CONSTRAINT PK_factories PRIMARY KEY (id),
    CONSTRAINT CK_factories_operating CHECK (operating_status IN ('AKTIF', 'NONAKTIF'))
);
GO

-- ---------------------------------------------------------------------------
-- countries (PK = kode ISO 3166 alpha-2)
-- ---------------------------------------------------------------------------
CREATE TABLE garment.countries (
    country_code  CHAR(2)       NOT NULL,
    country_name  NVARCHAR(60)  NOT NULL,
    CONSTRAINT PK_countries PRIMARY KEY (country_code)
);
GO

-- ---------------------------------------------------------------------------
-- production_stages (dipakai B dan C)
-- ---------------------------------------------------------------------------
CREATE TABLE garment.production_stages (
    stage_code  VARCHAR(10)   NOT NULL,
    stage_name  NVARCHAR(30)  NOT NULL,
    [sequence]  TINYINT       NOT NULL,
    CONSTRAINT PK_production_stages PRIMARY KEY (stage_code),
    CONSTRAINT UQ_production_stages_sequence UNIQUE ([sequence]),
    CONSTRAINT CK_production_stages_code CHECK (stage_code IN ('CUTTING', 'SEWING', 'TRIMMING', 'FINISHING', 'IRONING', 'PACKING')),
    CONSTRAINT CK_production_stages_sequence CHECK ([sequence] BETWEEN 1 AND 6)
);
GO

-- ---------------------------------------------------------------------------
-- divisions (head_employee_id: FK ditambahkan setelah employees dibuat)
-- ---------------------------------------------------------------------------
CREATE TABLE garment.divisions (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_divisions_id DEFAULT NEWSEQUENTIALID(),
    factory_id        UNIQUEIDENTIFIER NOT NULL,
    division_name     NVARCHAR(60)     NOT NULL,
    head_employee_id  UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_divisions PRIMARY KEY (id),
    CONSTRAINT FK_divisions_factory FOREIGN KEY (factory_id) REFERENCES garment.factories (id)
);
GO
CREATE INDEX IX_divisions_factory ON garment.divisions (factory_id);
GO

-- ---------------------------------------------------------------------------
-- positions
-- ---------------------------------------------------------------------------
CREATE TABLE garment.positions (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_positions_id DEFAULT NEWSEQUENTIALID(),
    position_name     NVARCHAR(60)     NOT NULL,
    position_level    TINYINT          NOT NULL,
    base_salary_min   DECIMAL(16,2)    NOT NULL,
    base_salary_max   DECIMAL(16,2)    NOT NULL,
    CONSTRAINT PK_positions PRIMARY KEY (id),
    CONSTRAINT CK_positions_salary CHECK (base_salary_min <= base_salary_max)
);
GO

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------
CREATE TABLE garment.shifts (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_shifts_id DEFAULT NEWSEQUENTIALID(),
    shift_name  NVARCHAR(30)     NOT NULL,
    start_time  TIME(0)          NOT NULL,
    end_time    TIME(0)          NOT NULL,
    CONSTRAINT PK_shifts PRIMARY KEY (id)
);
GO

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
CREATE TABLE garment.employees (
    id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_employees_id DEFAULT NEWSEQUENTIALID(),
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
    is_active           BIT              NOT NULL CONSTRAINT DF_employees_active DEFAULT 1,
    join_date           DATE             NOT NULL,
    created_at          DATETIME2(0)     NOT NULL CONSTRAINT DF_employees_created DEFAULT SYSDATETIME(),
    updated_at          DATETIME2(0)     NOT NULL CONSTRAINT DF_employees_updated DEFAULT SYSDATETIME(),
    CONSTRAINT PK_employees PRIMARY KEY (id),
    CONSTRAINT UQ_employees_nik UNIQUE (nik),
    CONSTRAINT CK_employees_nik CHECK (nik NOT LIKE '%[^0-9]%'),
    CONSTRAINT CK_employees_gender CHECK (gender IN ('L', 'P')),
    CONSTRAINT CK_employees_type CHECK (employee_type IN ('TETAP', 'KONTRAK', 'HARIAN', 'MAGANG', 'OUTSOURCING')),
    CONSTRAINT FK_employees_factory  FOREIGN KEY (factory_id)  REFERENCES garment.factories (id),
    CONSTRAINT FK_employees_division FOREIGN KEY (division_id) REFERENCES garment.divisions (id),
    CONSTRAINT FK_employees_position FOREIGN KEY (position_id) REFERENCES garment.positions (id),
    CONSTRAINT FK_employees_shift    FOREIGN KEY (shift_id)    REFERENCES garment.shifts (id)
);
GO
CREATE INDEX IX_employees_factory  ON garment.employees (factory_id);
CREATE INDEX IX_employees_division ON garment.employees (division_id);
CREATE INDEX IX_employees_position ON garment.employees (position_id);
GO

-- Relasi 1:1 kepala divisi (melingkar dengan employees)
ALTER TABLE garment.divisions
    ADD CONSTRAINT FK_divisions_head FOREIGN KEY (head_employee_id) REFERENCES garment.employees (id);
GO
CREATE UNIQUE INDEX UQ_divisions_head ON garment.divisions (head_employee_id)
    WHERE head_employee_id IS NOT NULL;
GO

-- ---------------------------------------------------------------------------
-- employment_contracts (entitas lemah)
-- ---------------------------------------------------------------------------
CREATE TABLE garment.employment_contracts (
    employee_id          UNIQUEIDENTIFIER NOT NULL,
    contract_seq         TINYINT          NOT NULL,
    contract_type        VARCHAR(10)      NOT NULL,
    contract_document_no VARCHAR(30)      NOT NULL,
    base_salary          DECIMAL(16,2)    NOT NULL,
    start_date           DATE             NOT NULL,
    finish_date          DATE             NULL,
    status               VARCHAR(10)      NOT NULL,
    CONSTRAINT PK_employment_contracts PRIMARY KEY (employee_id, contract_seq),
    CONSTRAINT FK_employment_contracts_employee FOREIGN KEY (employee_id) REFERENCES garment.employees (id),
    CONSTRAINT CK_employment_contracts_type CHECK (contract_type IN ('PKWT', 'PKWTT', 'HARIAN', 'MAGANG')),
    CONSTRAINT CK_employment_contracts_status CHECK (status IN ('AKTIF', 'SELESAI', 'DIPUTUS')),
    CONSTRAINT CK_employment_contracts_dates CHECK (finish_date IS NULL OR finish_date >= start_date)
);
GO

-- ---------------------------------------------------------------------------
-- skills dan employee_skills (M:N masters)
-- ---------------------------------------------------------------------------
CREATE TABLE garment.skills (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_skills_id DEFAULT NEWSEQUENTIALID(),
    skill_category  NVARCHAR(50)     NOT NULL,
    skill_name      NVARCHAR(80)     NOT NULL,
    CONSTRAINT PK_skills PRIMARY KEY (id)
);
GO

CREATE TABLE garment.employee_skills (
    employee_id     UNIQUEIDENTIFIER NOT NULL,
    skill_id        UNIQUEIDENTIFIER NOT NULL,
    skill_level     VARCHAR(10)      NOT NULL,
    certified_date  DATE             NULL,
    CONSTRAINT PK_employee_skills PRIMARY KEY (employee_id, skill_id),
    CONSTRAINT FK_employee_skills_employee FOREIGN KEY (employee_id) REFERENCES garment.employees (id),
    CONSTRAINT FK_employee_skills_skill    FOREIGN KEY (skill_id)    REFERENCES garment.skills (id),
    CONSTRAINT CK_employee_skills_level CHECK (skill_level IN ('DASAR', 'MENENGAH', 'AHLI'))
);
GO
CREATE INDEX IX_employee_skills_skill ON garment.employee_skills (skill_id);
GO

-- ---------------------------------------------------------------------------
-- interns (subclass employees). Aturan employee_type = MAGANG dan mentor aktif
-- dijaga trigger trg_interns_check (07-objects-core.sql).
-- ---------------------------------------------------------------------------
CREATE TABLE garment.interns (
    employee_id   UNIQUEIDENTIFIER NOT NULL,
    mentor_id     UNIQUEIDENTIFIER NOT NULL,
    institution   NVARCHAR(100)    NOT NULL,
    major         NVARCHAR(80)     NOT NULL,
    program_type  VARCHAR(10)      NOT NULL,
    allowance     DECIMAL(16,2)    NOT NULL,
    start_date    DATE             NOT NULL,
    finish_date   DATE             NOT NULL,
    final_score   DECIMAL(5,2)     NULL,
    CONSTRAINT PK_interns PRIMARY KEY (employee_id),
    CONSTRAINT FK_interns_employee FOREIGN KEY (employee_id) REFERENCES garment.employees (id),
    CONSTRAINT FK_interns_mentor   FOREIGN KEY (mentor_id)   REFERENCES garment.employees (id),
    CONSTRAINT CK_interns_mentor CHECK (mentor_id <> employee_id),
    CONSTRAINT CK_interns_program CHECK (program_type IN ('PKL', 'KAMPUS', 'MANDIRI')),
    CONSTRAINT CK_interns_dates CHECK (finish_date >= start_date),
    CONSTRAINT CK_interns_score CHECK (final_score IS NULL OR final_score BETWEEN 0 AND 100)
);
GO
CREATE INDEX IX_interns_mentor ON garment.interns (mentor_id);
GO

-- ---------------------------------------------------------------------------
-- attendances (entitas lemah). clock_in/clock_out NULL karena status
-- IZIN/SAKIT/ALPA/CUTI tidak punya jam masuk.
-- ---------------------------------------------------------------------------
CREATE TABLE garment.attendances (
    employee_id        UNIQUEIDENTIFIER NOT NULL,
    work_date          DATE             NOT NULL,
    clock_in           TIME(0)          NULL,
    clock_out          TIME(0)          NULL,
    overtime_hours     DECIMAL(4,1)     NOT NULL CONSTRAINT DF_attendances_ot DEFAULT 0,
    attendance_status  VARCHAR(10)      NOT NULL,
    CONSTRAINT PK_attendances PRIMARY KEY (employee_id, work_date),
    CONSTRAINT FK_attendances_employee FOREIGN KEY (employee_id) REFERENCES garment.employees (id),
    CONSTRAINT CK_attendances_status CHECK (attendance_status IN ('HADIR', 'IZIN', 'SAKIT', 'ALPA', 'CUTI')),
    CONSTRAINT CK_attendances_overtime CHECK (overtime_hours >= 0)
);
GO

-- ---------------------------------------------------------------------------
-- warehouses dan rack_locations
-- ---------------------------------------------------------------------------
CREATE TABLE garment.warehouses (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_warehouses_id DEFAULT NEWSEQUENTIALID(),
    factory_id        UNIQUEIDENTIFIER NOT NULL,
    head_employee_id  UNIQUEIDENTIFIER NOT NULL,
    warehouse_name    NVARCHAR(60)     NOT NULL,
    warehouse_type    VARCHAR(12)      NOT NULL,
    address           NVARCHAR(200)    NOT NULL,
    capacity_m3       DECIMAL(10,2)    NOT NULL,
    CONSTRAINT PK_warehouses PRIMARY KEY (id),
    CONSTRAINT FK_warehouses_factory FOREIGN KEY (factory_id)       REFERENCES garment.factories (id),
    CONSTRAINT FK_warehouses_head    FOREIGN KEY (head_employee_id) REFERENCES garment.employees (id),
    CONSTRAINT CK_warehouses_type CHECK (warehouse_type IN ('BAHAN', 'BARANG_JADI', 'CAMPURAN'))
);
GO
CREATE INDEX IX_warehouses_factory ON garment.warehouses (factory_id);
GO

CREATE TABLE garment.rack_locations (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_rack_locations_id DEFAULT NEWSEQUENTIALID(),
    warehouse_id  UNIQUEIDENTIFIER NOT NULL,
    rack_code     VARCHAR(20)      NOT NULL,
    capacity      INT              NOT NULL,
    CONSTRAINT PK_rack_locations PRIMARY KEY (id),
    CONSTRAINT FK_rack_locations_warehouse FOREIGN KEY (warehouse_id) REFERENCES garment.warehouses (id),
    CONSTRAINT UQ_rack_locations_code UNIQUE (warehouse_id, rack_code)
);
GO