-- Phase 4：Vault 文件级增量同步元数据表（设计 §8.2）

CREATE TABLE IF NOT EXISTS vault_space
(
    id          bigint       NOT NULL,
    user_id     bigint       NOT NULL,
    name        varchar(100) NOT NULL,
    used_bytes  bigint       NOT NULL DEFAULT 0,
    del_flag    char(1)      NOT NULL DEFAULT '0',
    create_dept bigint                DEFAULT NULL,
    create_by   bigint                DEFAULT NULL,
    create_time timestamp             DEFAULT CURRENT_TIMESTAMP,
    update_by   bigint                DEFAULT NULL,
    update_time timestamp             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_vault_space_user ON vault_space (user_id);
COMMENT ON TABLE vault_space IS 'Vault 云端库';

CREATE TABLE IF NOT EXISTS vault_device
(
    id           bigint       NOT NULL,
    vault_id     bigint       NOT NULL,
    user_id      bigint       NOT NULL,
    device_id    varchar(64)  NOT NULL,
    client_info  varchar(255)          DEFAULT NULL,
    last_seen_at timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_time  timestamp             DEFAULT CURRENT_TIMESTAMP,
    update_time  timestamp             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_vault_device UNIQUE (vault_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_device_user ON vault_device (user_id);
COMMENT ON TABLE vault_device IS 'Vault 设备绑定';

CREATE TABLE IF NOT EXISTS vault_file
(
    id           bigint        NOT NULL,
    vault_id     bigint        NOT NULL,
    path         varchar(1024) NOT NULL,
    identity_key varchar(1024) NOT NULL,
    file_type    varchar(16)   NOT NULL DEFAULT 'note',
    content_hash varchar(80)            DEFAULT NULL,
    size_bytes   bigint        NOT NULL DEFAULT 0,
    rev          bigint        NOT NULL DEFAULT 1,
    deleted      smallint      NOT NULL DEFAULT 0,
    create_time  timestamp              DEFAULT CURRENT_TIMESTAMP,
    update_time  timestamp              DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_vault_file_vault_identity ON vault_file (vault_id, identity_key);
CREATE INDEX IF NOT EXISTS idx_vault_file_vault_active ON vault_file (vault_id, deleted);
COMMENT ON TABLE vault_file IS 'Vault 文件元数据';

CREATE TABLE IF NOT EXISTS vault_file_blob
(
    content_hash varchar(80) NOT NULL,
    content      bytea       NOT NULL,
    size_bytes   bigint      NOT NULL DEFAULT 0,
    create_time  timestamp            DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (content_hash)
);

COMMENT ON TABLE vault_file_blob IS 'Vault 内容寻址 blob';

CREATE TABLE IF NOT EXISTS vault_change
(
    id           bigint        NOT NULL,
    vault_id     bigint        NOT NULL,
    file_id      bigint        NOT NULL,
    op           varchar(16)   NOT NULL,
    path         varchar(1024)          DEFAULT NULL,
    from_path    varchar(1024)          DEFAULT NULL,
    content_hash varchar(80)            DEFAULT NULL,
    size_bytes   bigint                 DEFAULT NULL,
    remote_rev   bigint        NOT NULL,
    create_time  timestamp              DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_vault_change_vault_cursor ON vault_change (vault_id, id);
COMMENT ON TABLE vault_change IS 'Vault 变更日志（manifest）';
