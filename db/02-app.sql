USE solaris_db;
GO

-- ---------------------------------------------------------------------------
-- roles (PK = kode)
-- ---------------------------------------------------------------------------
CREATE TABLE app.roles (
    role_code    VARCHAR(12)   NOT NULL,
    role_name    NVARCHAR(50)  NOT NULL,
    access_tier  VARCHAR(10)   NOT NULL,
    CONSTRAINT pk_roles PRIMARY KEY (role_code),
    CONSTRAINT ck_roles_code CHECK (role_code IN ('SUPERADMIN', 'ADMIN', 'PIMPINAN', 'MARKETING', 'PPIC', 'SPV', 'QC')),
    CONSTRAINT ck_roles_tier CHECK (access_tier IN ('SUPERADMIN', 'ADMIN', 'USER'))
);
GO

-- ---------------------------------------------------------------------------
-- users (1:1 dengan employees lewat employee_id; full_name diambil dari employees)
-- ---------------------------------------------------------------------------
CREATE TABLE app.users (
    id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_users_id DEFAULT NEWSEQUENTIALID(),
    employee_id           UNIQUEIDENTIFIER NOT NULL,
    username              VARCHAR(50)      NOT NULL,
    password_hash         VARCHAR(100)     NOT NULL,   -- bcrypt, tidak pernah teks biasa
    role_code             VARCHAR(12)      NOT NULL,
    is_active             BIT              NOT NULL CONSTRAINT df_users_active  DEFAULT 1,
    is_locked             BIT              NOT NULL CONSTRAINT df_users_locked  DEFAULT 0,
    failed_login_count    TINYINT          NOT NULL CONSTRAINT df_users_failed  DEFAULT 0,
    must_change_password  BIT              NOT NULL CONSTRAINT df_users_mustchg DEFAULT 0,
    last_login_at         DATETIME2(0)     NULL,
    created_at            DATETIME2(0)     NOT NULL CONSTRAINT df_users_created DEFAULT SYSDATETIME(),
    updated_at            DATETIME2(0)     NOT NULL CONSTRAINT df_users_updated DEFAULT SYSDATETIME(),
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_employee UNIQUE (employee_id),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT ck_users_username_len CHECK (LEN(username) BETWEEN 4 AND 50),
    CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES garment.employees (id),
    CONSTRAINT fk_users_role     FOREIGN KEY (role_code)   REFERENCES app.roles (role_code)
);
GO
CREATE INDEX ix_users_role ON app.users (role_code);
GO

-- ---------------------------------------------------------------------------
-- sessions (id disimpan di JWT sebagai klaim sid)
-- ---------------------------------------------------------------------------
CREATE TABLE app.sessions (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_sessions_id DEFAULT NEWSEQUENTIALID(),
    user_id           UNIQUEIDENTIFIER NOT NULL,
    device            NVARCHAR(150)    NOT NULL,
    ip_address        VARCHAR(45)      NOT NULL,
    login_at          DATETIME2(0)     NOT NULL CONSTRAINT df_sessions_login DEFAULT SYSDATETIME(),
    last_activity_at  DATETIME2(0)     NOT NULL CONSTRAINT df_sessions_last  DEFAULT SYSDATETIME(),
    status            VARCHAR(10)      NOT NULL CONSTRAINT df_sessions_status DEFAULT 'AKTIF',
    end_reason        VARCHAR(20)      NULL,
    ended_at          DATETIME2(0)     NULL,
    CONSTRAINT pk_sessions PRIMARY KEY (id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES app.users (id),
    CONSTRAINT ck_sessions_status CHECK (status IN ('AKTIF', 'BERAKHIR')),
    CONSTRAINT ck_sessions_end_reason CHECK (end_reason IS NULL OR end_reason IN
        ('LOGOUT', 'TIDAK_AKTIF', 'DIAKHIRI_ADMIN', 'RESET_PASSWORD', 'AKUN_NONAKTIF'))
);
GO
CREATE INDEX ix_sessions_user_status ON app.sessions (user_id, status);
CREATE INDEX ix_sessions_status_last ON app.sessions (status, last_activity_at);
GO

-- ---------------------------------------------------------------------------
-- activity_logs (hanya ditambah; dijaga trg_activity_logs_append_only)
-- ---------------------------------------------------------------------------
CREATE TABLE app.activity_logs (
    id             BIGINT IDENTITY(1,1) NOT NULL,
    user_id        UNIQUEIDENTIFIER     NULL,       -- NULL bila username tidak dikenal
    username       VARCHAR(50)          NOT NULL,
    action_type    VARCHAR(20)          NOT NULL,
    resource_type  VARCHAR(40)          NULL,       -- nama tabel dengan schema, mis. garment.orders
    resource_id    VARCHAR(36)          NULL,
    old_values     NVARCHAR(MAX)        NULL,
    new_values     NVARCHAR(MAX)        NULL,
    device         NVARCHAR(150)        NULL,
    ip_address     VARCHAR(45)          NOT NULL,
    created_at     DATETIME2(0)         NOT NULL CONSTRAINT df_activity_logs_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_activity_logs PRIMARY KEY (id),
    CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES app.users (id),
    CONSTRAINT ck_activity_logs_action CHECK (action_type IN
        ('LOGIN_BERHASIL', 'LOGIN_GAGAL', 'LOGOUT', 'SESI_BERAKHIR', 'SESI_DIAKHIRI',
         'AKUN_TERKUNCI', 'BUKA_KUNCI', 'RESET_PASSWORD', 'GANTI_PASSWORD', 'AKSES_DITOLAK',
         'TAMBAH', 'UBAH', 'SETUJU', 'TOLAK', 'TARIK', 'BATAL')),
    CONSTRAINT ck_activity_logs_old_json CHECK (old_values IS NULL OR ISJSON(old_values) = 1),
    CONSTRAINT ck_activity_logs_new_json CHECK (new_values IS NULL OR ISJSON(new_values) = 1)
);
GO
CREATE INDEX ix_activity_logs_user_created ON app.activity_logs (user_id, created_at);
CREATE INDEX ix_activity_logs_created      ON app.activity_logs (created_at);
CREATE INDEX ix_activity_logs_action       ON app.activity_logs (action_type);
GO

-- ---------------------------------------------------------------------------
-- password_reset_requests
-- ---------------------------------------------------------------------------
CREATE TABLE app.password_reset_requests (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_pwreset_id DEFAULT NEWSEQUENTIALID(),
    user_id       UNIQUEIDENTIFIER NOT NULL,
    note          NVARCHAR(200)    NULL,
    status        VARCHAR(10)      NOT NULL CONSTRAINT df_pwreset_status DEFAULT 'MENUNGGU',
    handled_by    UNIQUEIDENTIFIER NULL,
    requested_at  DATETIME2(0)     NOT NULL CONSTRAINT df_pwreset_requested DEFAULT SYSDATETIME(),
    handled_at    DATETIME2(0)     NULL,
    CONSTRAINT pk_password_reset_requests PRIMARY KEY (id),
    CONSTRAINT fk_pwreset_user    FOREIGN KEY (user_id)    REFERENCES app.users (id),
    CONSTRAINT fk_pwreset_handler FOREIGN KEY (handled_by) REFERENCES app.users (id),
    CONSTRAINT ck_pwreset_status CHECK (status IN ('MENUNGGU', 'SELESAI'))
);
GO
-- RB-61: satu permintaan MENUNGGU per akun
CREATE UNIQUE INDEX uq_pwreset_one_pending ON app.password_reset_requests (user_id)
    WHERE status = 'MENUNGGU';
GO

-- ---------------------------------------------------------------------------
-- notifications (N-01 .. N-11)
-- ---------------------------------------------------------------------------
CREATE TABLE app.notifications (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_notifications_id DEFAULT NEWSEQUENTIALID(),
    recipient_id  UNIQUEIDENTIFIER NOT NULL,
    event_code    CHAR(4)          NOT NULL,
    message       NVARCHAR(300)    NOT NULL,
    link          VARCHAR(200)     NULL,
    dedup_key     VARCHAR(80)      NULL,
    is_read       BIT              NOT NULL CONSTRAINT df_notifications_read DEFAULT 0,
    created_at    DATETIME2(0)     NOT NULL CONSTRAINT df_notifications_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_notifications PRIMARY KEY (id),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES app.users (id),
    CONSTRAINT ck_notifications_event CHECK (event_code IN
        ('N-01', 'N-02', 'N-03', 'N-04', 'N-05', 'N-06', 'N-07', 'N-08', 'N-09', 'N-10', 'N-11'))
);
GO
CREATE INDEX ix_notifications_recipient ON app.notifications (recipient_id, is_read, created_at);
CREATE UNIQUE INDEX uq_notifications_dedup ON app.notifications (recipient_id, dedup_key)
    WHERE dedup_key IS NOT NULL;
GO