-- P2：Vault 用户级同步配额覆盖表（PostgreSQL 方言）

CREATE TABLE IF NOT EXISTS vault_user_quota
(
    user_id        bigint       NOT NULL,
    quota_bytes    bigint                DEFAULT NULL,
    replica_limit  integer               DEFAULT NULL,
    max_file_bytes bigint                DEFAULT NULL,
    plan_name      varchar(64)           DEFAULT NULL,
    expire_time    timestamp             DEFAULT NULL,
    remark         varchar(255)          DEFAULT NULL,
    create_by      bigint                DEFAULT NULL,
    create_time    timestamp             DEFAULT CURRENT_TIMESTAMP,
    update_by      bigint                DEFAULT NULL,
    update_time    timestamp             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_user_quota_expire ON vault_user_quota (expire_time);

COMMENT ON TABLE vault_user_quota IS 'Vault 用户级同步配额覆盖';
COMMENT ON COLUMN vault_user_quota.user_id IS '所属用户 ID（主键）';
COMMENT ON COLUMN vault_user_quota.quota_bytes IS '同步容量上限（字节，NULL 继承全局默认）';
COMMENT ON COLUMN vault_user_quota.replica_limit IS '单库副本数上限（NULL 继承全局默认）';
COMMENT ON COLUMN vault_user_quota.max_file_bytes IS '单文件上限（字节，NULL 继承全局默认）';
COMMENT ON COLUMN vault_user_quota.plan_name IS '展示用套餐标识（如 vault-pro）';
COMMENT ON COLUMN vault_user_quota.expire_time IS '生效截止时间（NULL 长期有效）';
