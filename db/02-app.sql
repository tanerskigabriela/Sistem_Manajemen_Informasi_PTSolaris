USE solaris_db;
GO

/* ---------- roles ---------- */
CREATE TABLE app.roles (
    role_code   VARCHAR(12)   NOT NULL,
    role_name   NVARCHAR(50)  NOT NULL,
    access_tier VARCHAR(10)   NOT NULL,
    description NVARCHAR(200) NULL,                       -- [ASUMSI]
    CONSTRAINT pk_roles PRIMARY KEY (role_code),
    CONSTRAINT ck_roles_tier CHECK (access_tier IN ('SUPERADMIN','ADMIN','USER'))
);
GO

/* ---------- users ---------- */
CREATE TABLE app.users (
    id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_users_id DEFAULT NEWSEQUENTIALID(),
    employee_id          UNIQUEIDENTIFIER NOT NULL,
    username             VARCHAR(50)      NOT NULL,
    password_hash        VARCHAR(100)     NOT NULL,       -- bcrypt
    role_code            VARCHAR(12)      NOT NULL,
    is_active            BIT              NOT NULL CONSTRAINT df_users_active DEFAULT 1,
    is_locked            BIT              NOT NULL CONSTRAINT df_users_locked DEFAULT 0,
    failed_login_count   INT              NOT NULL CONSTRAINT df_users_failed DEFAULT 0,
    must_change_password BIT              NOT NULL CONSTRAINT df_users_mcp DEFAULT 0,
    last_login_at        DATETIME2(0)     NULL,
    created_at           DATETIME2(0)     NOT NULL CONSTRAINT df_users_created DEFAULT SYSDATETIME(),
    updated_at           DATETIME2(0)     NOT NULL CONSTRAINT df_users_updated DEFAULT SYSDATETIME(),
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_employee UNIQUE (employee_id),    -- has_account, 1:1
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT ck_users_username CHECK (LEN(username) BETWEEN 4 AND 50),
    CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES garment.employees(id),
    CONSTRAINT fk_users_role     FOREIGN KEY (role_code)   REFERENCES app.roles(role_code)
);
GO

/* ---------- sessions ---------- */
CREATE TABLE app.sessions (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_sessions_id DEFAULT NEWSEQUENTIALID(),
    user_id          UNIQUEIDENTIFIER NOT NULL,
    token_hash       VARCHAR(100)     NOT NULL,           -- [ASUMSI]
    ip_address       VARCHAR(45)      NULL,
    user_agent       NVARCHAR(300)    NULL,
    status           VARCHAR(10)      NOT NULL CONSTRAINT df_sessions_status DEFAULT 'AKTIF',  -- [ASUMSI] nilai
    created_at       DATETIME2(0)     NOT NULL CONSTRAINT df_sessions_created DEFAULT SYSDATETIME(),
    last_activity_at DATETIME2(0)     NOT NULL CONSTRAINT df_sessions_last DEFAULT SYSDATETIME(),
    expires_at       DATETIME2(0)     NOT NULL,
    CONSTRAINT pk_sessions PRIMARY KEY (id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES app.users(id),
    CONSTRAINT ck_sessions_status CHECK (status IN ('AKTIF','KADALUARSA','DICABUT'))
);
GO
CREATE INDEX ix_sessions_user_status ON app.sessions(user_id, status);
GO

/* ---------- activity_logs (append-only; lihat trg_activity_logs_append_only) ---------- */
CREATE TABLE app.activity_logs (
    id          BIGINT IDENTITY(1,1) NOT NULL,
    user_id     UNIQUEIDENTIFIER     NULL,                -- NULL untuk login gagal dengan username tak dikenal
    action_type VARCHAR(30)          NOT NULL,            -- [ASUMSI] tanpa CK; daftar nilai mengikuti v1 (UNGGAH_DOKUMEN dihapus)
    entity_type VARCHAR(40)          NULL,
    entity_id   VARCHAR(40)          NULL,
    description NVARCHAR(500)        NULL,
    ip_address  VARCHAR(45)          NULL,
    created_at  DATETIME2(0)         NOT NULL CONSTRAINT df_activity_logs_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_activity_logs PRIMARY KEY (id),
    CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES app.users(id)
);
GO
CREATE INDEX ix_activity_logs_user_time ON app.activity_logs(user_id, created_at);
GO

/* ---------- password_reset_requests ---------- */
CREATE TABLE app.password_reset_requests (
    id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_prr_id DEFAULT NEWSEQUENTIALID(),
    user_id      UNIQUEIDENTIFIER NOT NULL,
    status       VARCHAR(10)      NOT NULL CONSTRAINT df_prr_status DEFAULT 'MENUNGGU',  -- [ASUMSI] nilai
    note         NVARCHAR(300)    NULL,
    requested_at DATETIME2(0)     NOT NULL CONSTRAINT df_prr_requested DEFAULT SYSDATETIME(),
    handled_by   UNIQUEIDENTIFIER NULL,
    handled_at   DATETIME2(0)     NULL,
    CONSTRAINT pk_password_reset_requests PRIMARY KEY (id),
    CONSTRAINT fk_prr_user    FOREIGN KEY (user_id)    REFERENCES app.users(id),
    CONSTRAINT fk_prr_handler FOREIGN KEY (handled_by) REFERENCES app.users(id),
    CONSTRAINT ck_prr_status CHECK (status IN ('MENUNGGU','SELESAI','DITOLAK'))
);
GO

/* ---------- notifications (event N-01 s.d. N-11; N-12 dan N-13 dihapus) ---------- */
CREATE TABLE app.notifications (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_notifications_id DEFAULT NEWSEQUENTIALID(),
    user_id        UNIQUEIDENTIFIER NOT NULL,             -- penerima
    event_code     VARCHAR(4)       NOT NULL,
    title          NVARCHAR(100)    NOT NULL,             -- [ASUMSI]
    message        NVARCHAR(500)    NOT NULL,             -- [ASUMSI]
    reference_type VARCHAR(20)      NULL,
    reference_id   VARCHAR(40)      NULL,
    is_read        BIT              NOT NULL CONSTRAINT df_notifications_read DEFAULT 0,
    created_at     DATETIME2(0)     NOT NULL CONSTRAINT df_notifications_created DEFAULT SYSDATETIME(),
    CONSTRAINT pk_notifications PRIMARY KEY (id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES app.users(id),
    CONSTRAINT ck_notifications_event CHECK (event_code IN
        ('N-01','N-02','N-03','N-04','N-05','N-06','N-07','N-08','N-09','N-10','N-11'))
);
GO
CREATE INDEX ix_notifications_user_read ON app.notifications(user_id, is_read, created_at);
GO
