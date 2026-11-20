USE solaris_db;
GO

/* ---------------------------------------------------------------------
   1. tax_types
   --------------------------------------------------------------------- */
CREATE TABLE garment.tax_types (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_tax_types_id DEFAULT NEWSEQUENTIALID(),
    tax_name NVARCHAR(40) NOT NULL,
    rate_pct DECIMAL(5,2) NOT NULL,
    valid_from DATE NOT NULL,
    account_code VARCHAR(10) NOT NULL,   
    CONSTRAINT pk_tax_types PRIMARY KEY (id),
    CONSTRAINT uq_tax_types_name_from UNIQUE (tax_name, valid_from),  
    CONSTRAINT ck_tax_types_rate CHECK (rate_pct BETWEEN 0 AND 100),
    CONSTRAINT fk_tax_types_account FOREIGN KEY (account_code) REFERENCES garment.accounts (account_code)
);
GO

/* ---------------------------------------------------------------------
   2. taxes
      tax_amount (derived) dihitung di view, tidak disimpan.
   --------------------------------------------------------------------- */
CREATE TABLE garment.taxes (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_taxes_id     DEFAULT NEWSEQUENTIALID(),
    tax_type_id UNIQUEIDENTIFIER NOT NULL,
    factory_id UNIQUEIDENTIFIER NOT NULL,
    tax_year SMALLINT NOT NULL,
    tax_month TINYINT NOT NULL,
    tax_base_amount DECIMAL(16,2) NOT NULL,   -- DPP
    tax_invoice_no VARCHAR(30) NULL,       -- nomor faktur pajak / bukti potong
    reference_type VARCHAR(20) NOT NULL,   
    reference_no VARCHAR(30) NOT NULL,
    ntpn VARCHAR(20) NULL,
    status VARCHAR(8) NOT NULL CONSTRAINT df_taxes_status DEFAULT 'TERUTANG',
    deposit_date DATE NULL,
    CONSTRAINT pk_taxes PRIMARY KEY (id),
    CONSTRAINT ck_taxes_year CHECK (tax_year BETWEEN 2000 AND 2100),
    CONSTRAINT ck_taxes_month CHECK (tax_month BETWEEN 1 AND 12),
    CONSTRAINT ck_taxes_base CHECK (tax_base_amount >= 0),
    CONSTRAINT ck_taxes_status CHECK (status IN ('TERUTANG', 'DISETOR')),
    -- pajak yang sudah disetor wajib punya tanggal setor dan NTPN
    CONSTRAINT ck_taxes_deposit CHECK (status = 'TERUTANG' OR (deposit_date IS NOT NULL AND ntpn IS NOT NULL)),
    CONSTRAINT fk_taxes_type FOREIGN KEY (tax_type_id) REFERENCES garment.tax_types (id),
    CONSTRAINT fk_taxes_factory FOREIGN KEY (factory_id)  REFERENCES garment.factories (id)
);
GO

/* ---------------------------------------------------------------------
   3. sales_invoices
   --------------------------------------------------------------------- */
CREATE TABLE garment.sales_invoices (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_sales_invoices_id      DEFAULT NEWSEQUENTIALID(),
    invoice_no CHAR(12) NOT NULL,   -- INV-TTBB-NNN, dibuat fn_next_doc_no('INV')
    order_id UNIQUEIDENTIFIER NOT NULL,
    shipment_id UNIQUEIDENTIFIER NULL,
    cancellation_id UNIQUEIDENTIFIER NULL,
    invoice_type VARCHAR(9) NOT NULL,
    currency CHAR(3) NOT NULL CONSTRAINT df_sales_invoices_currency DEFAULT 'IDR',
    exchange_rate DECIMAL(12,4) NOT NULL CONSTRAINT df_sales_invoices_rate     DEFAULT 1,
    subtotal DECIMAL(16,2) NOT NULL,
    discount DECIMAL(16,2) NOT NULL CONSTRAINT df_sales_invoices_discount DEFAULT 0,
    vat_amount DECIMAL(16,2) NOT NULL CONSTRAINT df_sales_invoices_vat      DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(11) NOT NULL CONSTRAINT df_sales_invoices_status   DEFAULT 'BELUM_LUNAS',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_sales_invoices_created  DEFAULT SYSDATETIME(),
    CONSTRAINT pk_sales_invoices PRIMARY KEY (id),
    CONSTRAINT uq_sales_invoices_no UNIQUE (invoice_no),
    CONSTRAINT ck_sales_invoices_no CHECK (invoice_no LIKE 'INV-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]'),
    CONSTRAINT ck_sales_invoices_type CHECK (invoice_type IN ('DP', 'PELUNASAN', 'DENDA')),
    CONSTRAINT ck_sales_invoices_cancel CHECK ((invoice_type = 'DENDA' AND cancellation_id IS NOT NULL) OR (invoice_type <> 'DENDA' AND cancellation_id IS NULL)),
    CONSTRAINT ck_sales_invoices_rate CHECK (exchange_rate > 0),
    CONSTRAINT ck_sales_invoices_amounts CHECK (subtotal >= 0 AND discount >= 0 AND vat_amount >= 0 AND discount <= subtotal),
    CONSTRAINT ck_sales_invoices_status CHECK (status IN ('BELUM_LUNAS', 'LUNAS', 'BATAL')),
    CONSTRAINT fk_sales_invoices_order FOREIGN KEY (order_id) REFERENCES garment.orders (id),
    CONSTRAINT fk_sales_invoices_shipment FOREIGN KEY (shipment_id) REFERENCES garment.shipments (id),
    CONSTRAINT fk_sales_invoices_cancel FOREIGN KEY (cancellation_id) REFERENCES garment.order_cancellations (id)
);
GO

/* ---------------------------------------------------------------------
   4. supplier_bills
   --------------------------------------------------------------------- */
CREATE TABLE garment.supplier_bills (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_supplier_bills_id     DEFAULT NEWSEQUENTIALID(),
    po_id UNIQUEIDENTIFIER NOT NULL,
    supplier_invoice_no VARCHAR(30) NOT NULL,
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency CHAR(3) NOT NULL CONSTRAINT df_supplier_bills_currency DEFAULT 'IDR',
    total DECIMAL(16,2) NOT NULL,
    status VARCHAR(11) NOT NULL CONSTRAINT df_supplier_bills_status DEFAULT 'BELUM_LUNAS',
    CONSTRAINT pk_supplier_bills PRIMARY KEY (id),
    CONSTRAINT uq_supplier_bills_po_invoice UNIQUE (po_id, supplier_invoice_no),  
    CONSTRAINT ck_supplier_bills_dates CHECK (due_date >= bill_date),
    CONSTRAINT ck_supplier_bills_total CHECK (total > 0),
    CONSTRAINT ck_supplier_bills_status CHECK (status IN ('BELUM_LUNAS', 'LUNAS')),
    CONSTRAINT fk_supplier_bills_po FOREIGN KEY (po_id) REFERENCES garment.purchase_orders (id)
);
GO

/* ---------------------------------------------------------------------
   5. payments
   --------------------------------------------------------------------- */
CREATE TABLE garment.payments (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_payments_id DEFAULT NEWSEQUENTIALID(),
    direction VARCHAR(6) NOT NULL,
    invoice_id UNIQUEIDENTIFIER NULL,
    bill_id UNIQUEIDENTIFIER NULL,
    cancellation_id UNIQUEIDENTIFIER NULL,   -- refund pembatalan
    bank_account_id UNIQUEIDENTIFIER NOT NULL,
    amount DECIMAL(16,2) NOT NULL,  
    currency CHAR(3) NOT NULL CONSTRAINT df_payments_currency DEFAULT 'IDR',
    exchange_rate DECIMAL(12,4) NOT NULL CONSTRAINT df_payments_rate     DEFAULT 1,
    payment_method VARCHAR(8) NOT NULL,
    reference_no VARCHAR(30) NOT NULL,
    status VARCHAR(8) NOT NULL CONSTRAINT df_payments_status   DEFAULT 'PENDING',
    paid_date DATE NOT NULL,
    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT ck_payments_direction  CHECK (direction IN ('MASUK', 'KELUAR')),
    CONSTRAINT ck_payments_one_target CHECK ((CASE WHEN invoice_id IS NULL THEN 0 ELSE 1 END
                                            + CASE WHEN bill_id IS NULL THEN 0 ELSE 1 END
                                            + CASE WHEN cancellation_id IS NULL THEN 0 ELSE 1 END) = 1),
    CONSTRAINT ck_payments_dir_match CHECK ((invoice_id IS NOT NULL AND direction = 'MASUK') OR (invoice_id IS NULL AND direction = 'KELUAR')),
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT ck_payments_rate CHECK (exchange_rate > 0),
    CONSTRAINT ck_payments_method CHECK (payment_method IN ('TRANSFER', 'TT', 'LC', 'GIRO', 'TUNAI')),
    CONSTRAINT ck_payments_status CHECK (status IN ('BERHASIL', 'GAGAL', 'PENDING')),
    CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES garment.sales_invoices (id),
    CONSTRAINT fk_payments_bill FOREIGN KEY (bill_id) REFERENCES garment.supplier_bills (id),
    CONSTRAINT fk_payments_cancel FOREIGN KEY (cancellation_id) REFERENCES garment.order_cancellations (id),
    CONSTRAINT fk_payments_bank FOREIGN KEY (bank_account_id) REFERENCES garment.company_bank_accounts (id)
);
GO

/* =====================================================================
   INDEX 
   ===================================================================== */

-- Daftar invoice per order dan status lunas 
CREATE INDEX ix_sales_invoices_order
    ON garment.sales_invoices (order_id, status);
GO

-- Invoice jatuh tempo yang belum lunas
CREATE INDEX ix_sales_invoices_due
    ON garment.sales_invoices (status, due_date);
GO

-- Total pembayaran per invoice, dipakai sp_record_payment untuk menentukan LUNAS
CREATE INDEX ix_payments_invoice
    ON garment.payments (invoice_id) WHERE invoice_id IS NOT NULL;
GO

-- Total pembayaran per tagihan supplier
CREATE INDEX ix_payments_bill
    ON garment.payments (bill_id) WHERE bill_id IS NOT NULL;
GO

-- Refund per pembatalan
CREATE INDEX ix_payments_cancellation
    ON garment.payments (cancellation_id) WHERE cancellation_id IS NOT NULL;
GO

-- Rekap pajak per pabrik per masa
CREATE INDEX ix_taxes_factory_period
    ON garment.taxes (factory_id, tax_year, tax_month);
GO