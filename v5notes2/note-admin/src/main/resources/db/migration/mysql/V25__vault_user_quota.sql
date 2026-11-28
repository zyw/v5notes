-- P2：Vault 用户级同步配额覆盖表（设计 §3.4.2 / §4.1）

CREATE TABLE IF NOT EXISTS vault_user_quota
(
    user_id        bigint(20) NOT NULL COMMENT '所属用户 ID（主键）',
    quota_bytes    bigint(20)          DEFAULT NULL COMMENT '同步容量上限（字节，NULL 继承全局默认）',
    replica_limit  int                 DEFAULT NULL COMMENT '单库副本数上限（NULL 继承全局默认）',
    max_file_bytes bigint(20)          DEFAULT NULL COMMENT '单文件上限（字节，NULL 继承全局默认）',
    plan_name      varchar(64)         DEFAULT NULL COMMENT '展示用套餐标识（如 vault-pro）',
    expire_time    datetime            DEFAULT NULL COMMENT '生效截止时间（NULL 长期有效）',
    remark         varchar(255)        DEFAULT NULL COMMENT '备注',
    create_by      bigint(20)          DEFAULT NULL,
    create_time    datetime            DEFAULT CURRENT_TIMESTAMP,
    update_by      bigint(20)          DEFAULT NULL,
    update_time    datetime            DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    KEY idx_vault_user_quota_expire (expire_time)
) ENGINE = InnoDB COMMENT = 'Vault 用户级同步配额覆盖';
