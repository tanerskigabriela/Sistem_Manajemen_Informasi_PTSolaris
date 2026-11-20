USE solaris_db;
GO

-- ---------------------------------------------------------------------------
-- accounts (COA, rekursif lewat parent_code)
-- ---------------------------------------------------------------------------
CREATE TABLE garment.accounts (
    account_code  VARCHAR(10)   NOT NULL,
    parent_code   VARCHAR(10)   NULL,
    account_name  NVARCHAR(80)  NOT NULL,
    account_type  VARCHAR(10)   NOT NULL,
    CONSTRAINT pk_accounts PRIMARY KEY (account_code),
    CONSTRAINT fk_accounts_parent FOREIGN KEY (parent_code) REFERENCES garment.accounts (account_code),
    CONSTRAINT ck_accounts_type CHECK (account_type IN ('ASET', 'KEWAJIBAN', 'EKUITAS', 'PENDAPATAN', 'BEBAN')),
    CONSTRAINT ck_accounts_parent_self CHECK (parent_code IS NULL OR parent_code <> account_code)
);
GO
CREATE INDEX ix_accounts_parent ON garment.accounts (parent_code);
GO

-- ---------------------------------------------------------------------------
-- company_bank_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE garment.company_bank_accounts (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_company_bank_accounts_id DEFAULT NEWSEQUENTIALID(),
    factory_id    UNIQUEIDENTIFIER NOT NULL,
    account_code  VARCHAR(10)      NOT NULL,
    bank_name     NVARCHAR(50)     NOT NULL,
    account_no    VARCHAR(30)      NOT NULL,
    currency      CHAR(3)          NOT NULL,
    CONSTRAINT pk_company_bank_accounts PRIMARY KEY (id),
    CONSTRAINT uq_company_bank_accounts_no UNIQUE (account_no),
    CONSTRAINT fk_company_bank_accounts_factory FOREIGN KEY (factory_id)   REFERENCES garment.factories (id),
    CONSTRAINT fk_company_bank_accounts_account FOREIGN KEY (account_code) REFERENCES garment.accounts (account_code)
);
GO
CREATE INDEX ix_company_bank_accounts_factory ON garment.company_bank_accounts (factory_id);
GO

-- ---------------------------------------------------------------------------
-- journals. reference_type/reference_no NULL agar jurnal umum manual
-- (tanpa dokumen sumber) bisa dicatat.
-- ---------------------------------------------------------------------------
CREATE TABLE garment.journals (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_journals_id DEFAULT NEWSEQUENTIALID(),
    journal_no      CHAR(11)         NOT NULL,   -- JU-TTBB-NNN
    factory_id      UNIQUEIDENTIFIER NOT NULL,
    created_by      UNIQUEIDENTIFIER NOT NULL,   -- employees.id (K-11)
    journal_date    DATE             NOT NULL,
    description     NVARCHAR(200)    NOT NULL,
    reference_type  VARCHAR(20)      NULL,
    reference_no    VARCHAR(30)      NULL,
    CONSTRAINT pk_journals PRIMARY KEY (id),
    CONSTRAINT uq_journals_no UNIQUE (journal_no),
    CONSTRAINT fk_journals_factory    FOREIGN KEY (factory_id) REFERENCES garment.factories (id),
    CONSTRAINT fk_journals_created_by FOREIGN KEY (created_by) REFERENCES garment.employees (id)
);
GO
CREATE INDEX ix_journals_factory_date ON garment.journals (factory_id, journal_date);
GO

-- ---------------------------------------------------------------------------
-- journal_lines (entitas lemah)
-- ---------------------------------------------------------------------------
CREATE TABLE garment.journal_lines (
    journal_id    UNIQUEIDENTIFIER NOT NULL,
    line_no       SMALLINT         NOT NULL,
    account_code  VARCHAR(10)      NOT NULL,
    debit         DECIMAL(16,2)    NOT NULL CONSTRAINT df_journal_lines_debit  DEFAULT 0,
    credit        DECIMAL(16,2)    NOT NULL CONSTRAINT df_journal_lines_credit DEFAULT 0,
    CONSTRAINT pk_journal_lines PRIMARY KEY (journal_id, line_no),
    CONSTRAINT fk_journal_lines_journal FOREIGN KEY (journal_id)   REFERENCES garment.journals (id),
    CONSTRAINT fk_journal_lines_account FOREIGN KEY (account_code) REFERENCES garment.accounts (account_code),
    -- tepat satu dari debit/credit yang > 0
    CONSTRAINT ck_journal_lines_one_side CHECK (
        (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
GO
CREATE INDEX ix_journal_lines_account ON garment.journal_lines (account_code);
GO

-- ---------------------------------------------------------------------------
-- payrolls (entitas lemah). net_salary derived:
--   base_salary + position_allowance + meal_allowance + transport_allowance
--   + overtime_pay - bpjs_deduction - pph21_deduction - other_deduction
-- ---------------------------------------------------------------------------
CREATE TABLE garment.payrolls (
    employee_id          UNIQUEIDENTIFIER NOT NULL,
    period_year          SMALLINT         NOT NULL,
    period_month         TINYINT          NOT NULL,
    bank_account_id      UNIQUEIDENTIFIER NOT NULL,
    base_salary          DECIMAL(16,2)    NOT NULL,
    position_allowance   DECIMAL(16,2)    NOT NULL CONSTRAINT df_payrolls_pos   DEFAULT 0,
    meal_allowance       DECIMAL(16,2)    NOT NULL CONSTRAINT df_payrolls_meal  DEFAULT 0,
    transport_allowance  DECIMAL(16,2)    NOT NULL CONSTRAINT df_payrolls_trans DEFAULT 0,
    overtime_pay         DECIMAL(16,2)    NOT NULL CONSTRAINT df_payrolls_ot    DEFAULT 0,
    bpjs_deduction       DECIMAL(16,2)    NOT NULL CONSTRAINT df_payrolls_bpjs  DEFAULT 0,
    pph21_deduction      DECIMAL(16,2)    NOT NULL CONSTRAINT df_payrolls_pph   DEFAULT 0,
    other_deduction      DECIMAL(16,2)    NOT NULL CONSTRAINT df_payrolls_other DEFAULT 0,
    status               VARCHAR(7)       NOT NULL,
    paid_date            DATE             NULL,
    CONSTRAINT pk_payrolls PRIMARY KEY (employee_id, period_year, period_month),
    CONSTRAINT fk_payrolls_employee FOREIGN KEY (employee_id)     REFERENCES garment.employees (id),
    CONSTRAINT fk_payrolls_bank     FOREIGN KEY (bank_account_id) REFERENCES garment.company_bank_accounts (id),
    CONSTRAINT ck_payrolls_month  CHECK (period_month BETWEEN 1 AND 12),
    CONSTRAINT ck_payrolls_status CHECK (status IN ('DRAF', 'DIBAYAR')),
    CONSTRAINT ck_payrolls_paid   CHECK (status = 'DRAF' OR paid_date IS NOT NULL)
);
GO
CREATE INDEX ix_payrolls_period ON garment.payrolls (period_year, period_month);
GO