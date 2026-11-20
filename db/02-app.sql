USE solaris_db;
GO

-- ---------------------------------------------------------------------------
-- roles (PK = kode)
-- ---------------------------------------------------------------------------
CREATE TABLE app.roles (
    role_code    VARCHAR(12)   NOT NULL,
    role_name    NVARCHAR(50)  NOT NULL,
    access_tier  VARCHAR(10)   NOT NULL,
    CONSTRAINT PK_roles PRIMARY KEY (role_code),
    CONSTRAINT CK_roles_code CHECK (role_code IN ('SUPERADMIN', 'ADMIN', 'PIMPINAN', 'MARKETING', 'PPIC', 'SPV', 'QC')),
    CONSTRAINT CK_roles_tier CHECK (access_tier IN ('SUPERADMIN', 'ADMIN', 'USER'))
);
GO

-- ---------------------------------------------------------------------------
-- users (1:1 dengan employees lewat employee_id; full_name diambil dari employees)
-- ---------------------------------------------------------------------------
CREATE TABLE app.users (
    id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_users_id DEFAULT NEWSEQUENTIALID(),
    employee_id           UNIQUEIDENTIFIER NOT NULL,
    username              VARCHAR(50)      NOT NULL,
    password_hash         VARCHAR(100)     NOT NULL,   -- bcrypt, tidak pernah teks biasa
    role_code             VARCHAR(12)      NOT NULL,
    is_active             BIT              NOT NULL CONSTRAINT DF_users_active  DEFAULT 1,
    is_locked             BIT              NOT NULL CONSTRAINT DF_users_locked  DEFAULT 0,
    failed_login_count    TINYINT          NOT NULL CONSTRAINT DF_users_failed  DEFAULT 0,
    must_change_password  BIT              NOT NULL CONSTRAINT DF_users_mustchg DEFAULT 0,
    last_login_at         DATETIME2(0)     NULL,
    created_at            DATETIME2(0)     NOT NULL CONSTRAINT DF_users_created DEFAULT SYSDATETIME(),
    updated_at            DATETIME2(0)     NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSDATETIME(),
    CONSTRAINT PK_users PRIMARY KEY (id),
    CONSTRAINT UQ_users_employee UNIQUE (employee_id),
    CONSTRAINT UQ_users_username UNIQUE (username),
    CONSTRAINT CK_users_username_len CHECK (LEN(username) BETWEEN 4 AND 50),
    CONSTRAINT FK_users_employee FOREIGN KEY (employee_id) REFERENCES garment.employees (id),
    CONSTRAINT FK_users_role     FOREIGN KEY (role_code)   REFERENCES app.roles (role_code)
);
GO
CREATE INDEX IX_users_role ON app.users (role_code);
GO

-- ---------------------------------------------------------------------------
-- sessions (id disimpan di JWT sebagai klaim sid)
-- ---------------------------------------------------------------------------
CREATE TABLE app.sessions (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sessions_id DEFAULT NEWSEQUENTIALID(),
    user_id           UNIQUEIDENTIFIER NOT NULL,
    device            NVARCHAR(150)    NULL,
    ip_address        VARCHAR(45)      NULL,
    login_at          DATETIME2(0)     NOT NULL CONSTRAINT DF_sessions_login DEFAULT SYSDATETIME(),
    last_activity_at  DATETIME2(0)     NOT NULL CONSTRAINT DF_sessions_last  DEFAULT SYSDATETIME(),
    status            VARCHAR(10)      NOT NULL CONSTRAINT DF_sessions_status DEFAULT 'AKTIF',
    end_reason        VARCHAR(20)      NULL,
    ended_at          DATETIME2(0)     NULL,
    CONSTRAINT PK_sessions PRIMARY KEY (id),
    CONSTRAINT FK_sessions_user FOREIGN KEY (user_id) REFERENCES app.users (id),
    CONSTRAINT CK_sessions_status CHECK (status IN ('AKTIF', 'BERAKHIR')),
    CONSTRAINT CK_sessions_end_reason CHECK (end_reason IS NULL OR end_reason IN
        ('LOGOUT', 'TIDAK_AKTIF', 'DIAKHIRI_ADMIN', 'RESET_PASSWORD', 'AKUN_NONAKTIF'))
);
GO
CREATE INDEX IX_sessions_user_status ON app.sessions (user_id, status);
CREATE INDEX IX_sessions_status_last ON app.sessions (status, last_activity_at);
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
    ip_address     VARCHAR(45)          NULL,
    created_at     DATETIME2(0)         NOT NULL CONSTRAINT DF_activity_logs_created DEFAULT SYSDATETIME(),
    CONSTRAINT PK_activity_logs PRIMARY KEY (id),
    CONSTRAINT FK_activity_logs_user FOREIGN KEY (user_id) REFERENCES app.users (id),
    CONSTRAINT CK_activity_logs_action CHECK (action_type IN
        ('LOGIN_BERHASIL', 'LOGIN_GAGAL', 'LOGOUT', 'SESI_BERAKHIR', 'SESI_DIAKHIRI',
         'AKUN_TERKUNCI', 'BUKA_KUNCI', 'RESET_PASSWORD', 'GANTI_PASSWORD', 'AKSES_DITOLAK',
         'TAMBAH', 'UBAH', 'SETUJU', 'TOLAK', 'TARIK', 'BATAL')),
    CONSTRAINT CK_activity_logs_old_json CHECK (old_values IS NULL OR ISJSON(old_values) = 1),
    CONSTRAINT CK_activity_logs_new_json CHECK (new_values IS NULL OR ISJSON(new_values) = 1)
);
GO
CREATE INDEX IX_activity_logs_user_created ON app.activity_logs (user_id, created_at);
CREATE INDEX IX_activity_logs_created      ON app.activity_logs (created_at);
CREATE INDEX IX_activity_logs_action       ON app.activity_logs (action_type);
GO

-- ---------------------------------------------------------------------------
-- password_reset_requests
-- ---------------------------------------------------------------------------
CREATE TABLE app.password_reset_requests (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_pwreset_id DEFAULT NEWSEQUENTIALID(),
    user_id       UNIQUEIDENTIFIER NOT NULL,
    note          NVARCHAR(200)    NULL,
    status        VARCHAR(10)      NOT NULL CONSTRAINT DF_pwreset_status DEFAULT 'MENUNGGU',
    handled_by    UNIQUEIDENTIFIER NULL,
    requested_at  DATETIME2(0)     NOT NULL CONSTRAINT DF_pwreset_requested DEFAULT SYSDATETIME(),
    handled_at    DATETIME2(0)     NULL,
    CONSTRAINT PK_password_reset_requests PRIMARY KEY (id),
    CONSTRAINT FK_pwreset_user    FOREIGN KEY (user_id)    REFERENCES app.users (id),
    CONSTRAINT FK_pwreset_handler FOREIGN KEY (handled_by) REFERENCES app.users (id),
    CONSTRAINT CK_pwreset_status CHECK (status IN ('MENUNGGU', 'SELESAI'))
);
GO
-- RB-61: satu permintaan MENUNGGU per akun
CREATE UNIQUE INDEX UQ_pwreset_one_pending ON app.password_reset_requests (user_id)
    WHERE status = 'MENUNGGU';
GO

-- ---------------------------------------------------------------------------
-- notifications (N-01 .. N-11)
-- ---------------------------------------------------------------------------
CREATE TABLE app.notifications (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_notifications_id DEFAULT NEWSEQUENTIALID(),
    recipient_id  UNIQUEIDENTIFIER NOT NULL,
    event_code    CHAR(4)          NOT NULL,
    message       NVARCHAR(300)    NOT NULL,
    link          VARCHAR(200)     NULL,
    dedup_key     VARCHAR(80)      NULL,
    is_read       BIT              NOT NULL CONSTRAINT DF_notifications_read DEFAULT 0,
    created_at    DATETIME2(0)     NOT NULL CONSTRAINT DF_notifications_created DEFAULT SYSDATETIME(),
    CONSTRAINT PK_notifications PRIMARY KEY (id),
    CONSTRAINT FK_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES app.users (id),
    CONSTRAINT CK_notifications_event CHECK (event_code IN
        ('N-01', 'N-02', 'N-03', 'N-04', 'N-05', 'N-06', 'N-07', 'N-08', 'N-09', 'N-10', 'N-11'))
);
GO
CREATE INDEX IX_notifications_recipient ON app.notifications (recipient_id, is_read, created_at);
CREATE UNIQUE INDEX UQ_notifications_dedup ON app.notifications (recipient_id, dedup_key)
    WHERE dedup_key IS NOT NULL;
GO