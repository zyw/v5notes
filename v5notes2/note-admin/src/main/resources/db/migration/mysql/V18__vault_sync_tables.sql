-- Phase 4：Vault 文件级增量同步元数据表（设计 §8.2）

CREATE TABLE IF NOT EXISTS vault_space
(
    id          bigint(20)   NOT NULL COMMENT '云端库 ID（雪花）',
    user_id     bigint(20)   NOT NULL COMMENT '所属用户',
    name        varchar(100) NOT NULL COMMENT '库显示名',
    used_bytes  bigint(20)   NOT NULL DEFAULT 0 COMMENT '已用同步容量字节',
    del_flag    char(1)      NOT NULL DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
    create_dept bigint(20)            DEFAULT NULL,
    create_by   bigint(20)            DEFAULT NULL,
    create_time datetime              DEFAULT CURRENT_TIMESTAMP,
    update_by   bigint(20)            DEFAULT NULL,
    update_time datetime              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_vault_space_user (user_id)
) ENGINE = InnoDB COMMENT = 'Vault 云端库';

CREATE TABLE IF NOT EXISTS vault_device
(
    id           bigint(20)    NOT NULL COMMENT '绑定记录 ID',
    vault_id     bigint(20)    NOT NULL COMMENT '云端库 ID',
    user_id      bigint(20)    NOT NULL COMMENT '所属用户',
    device_id    varchar(64)   NOT NULL COMMENT '客户端设备 ID',
    client_info  varchar(255)           DEFAULT NULL COMMENT '客户端信息摘要',
    last_seen_at datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近同步时间',
    create_time  datetime               DEFAULT CURRENT_TIMESTAMP,
    update_time  datetime               DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_vault_device (vault_id, device_id),
    KEY idx_vault_device_user (user_id)
) ENGINE = InnoDB COMMENT = 'Vault 设备绑定';

CREATE TABLE IF NOT EXISTS vault_file
(
    id            bigint(20)    NOT NULL COMMENT 'fileId（雪花字符串对外）',
    vault_id      bigint(20)    NOT NULL COMMENT '云端库 ID',
    path          varchar(1024) NOT NULL COMMENT '展示 path（NFC，保留大小写）',
    identity_key  varchar(1024) NOT NULL COMMENT '身份键（NFC + case-fold）',
    file_type     varchar(16)   NOT NULL DEFAULT 'note' COMMENT 'note/asset/config',
    content_hash  varchar(80)            DEFAULT NULL COMMENT 'sha256:hex 或 hex',
    size_bytes    bigint(20)    NOT NULL DEFAULT 0,
    rev           bigint(20)    NOT NULL DEFAULT 1 COMMENT '每文件单调 revision',
    deleted       tinyint(1)    NOT NULL DEFAULT 0 COMMENT '墓碑标记',
    create_time   datetime               DEFAULT CURRENT_TIMESTAMP,
    update_time   datetime               DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_vault_file_vault_identity (vault_id, identity_key(766)),
    KEY idx_vault_file_vault_active (vault_id, deleted)
) ENGINE = InnoDB COMMENT = 'Vault 文件元数据';

CREATE TABLE IF NOT EXISTS vault_file_blob
(
    content_hash varchar(80) NOT NULL COMMENT '内容哈希（主键）',
    content      mediumblob  NOT NULL COMMENT '正文/附件字节（Phase 4 先存 DB）',
    size_bytes   bigint(20)  NOT NULL DEFAULT 0,
    create_time  datetime             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (content_hash)
) ENGINE = InnoDB COMMENT = 'Vault 内容寻址 blob';

CREATE TABLE IF NOT EXISTS vault_change
(
    id          bigint(20)    NOT NULL COMMENT '变更 ID（= opaque cursor）',
    vault_id    bigint(20)    NOT NULL,
    file_id     bigint(20)    NOT NULL,
    op          varchar(16)   NOT NULL COMMENT 'upsert/delete/rename',
    path        varchar(1024)          DEFAULT NULL COMMENT '目标展示 path',
    from_path   varchar(1024)          DEFAULT NULL COMMENT 'rename 源 path',
    content_hash varchar(80)           DEFAULT NULL,
    size_bytes  bigint(20)             DEFAULT NULL,
    remote_rev  bigint(20)    NOT NULL,
    create_time datetime               DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_vault_change_vault_cursor (vault_id, id)
) ENGINE = InnoDB COMMENT = 'Vault 变更日志（manifest）';
