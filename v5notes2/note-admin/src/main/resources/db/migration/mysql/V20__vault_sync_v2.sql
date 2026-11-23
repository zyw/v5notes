-- Vault 附件改走基础文件接口（设计 D4/D5/D6）
--
-- 执行顺序即依赖关系：
--   1) 笔记/config 正文先落到 vault_file.content，接住原本存在 vault_file_blob 的文本
--   2) 新建 vault_asset_ref（附件 → 基础文件对象引用 + 去重）
--   3) 才能删除 vault_file_blob

-- 1) 笔记/config 正文（asset 为 NULL）
ALTER TABLE vault_file
    ADD COLUMN content mediumtext NULL COMMENT 'note/config 正文（asset 为 NULL）';

-- 2) 附件对象引用：一个 asset 可被多条路径引用，file_id 唯一
CREATE TABLE IF NOT EXISTS vault_asset_ref
(
    file_id     bigint(20)    NOT NULL COMMENT 'vault_file.id',
    asset_id    bigint(20)    NOT NULL COMMENT 'basics_file.id',
    vault_id    bigint(20)    NOT NULL COMMENT '云端库 ID（冗余，便于按库清理与去重）',
    sha256      varchar(80)   NOT NULL COMMENT '内容哈希（= vault_file.content_hash）',
    size_bytes  bigint(20)    NOT NULL DEFAULT 0,
    mime_type   varchar(128)           DEFAULT NULL,
    storage_key varchar(512)           DEFAULT NULL COMMENT '底层对象 key：vault/{vaultId}/{sha256前2位}/{sha256}',
    config_id   bigint(20)             DEFAULT NULL COMMENT '写入该对象的文件配置；读取按此回原后端',
    backend     varchar(16)   NOT NULL DEFAULT 'proxy' COMMENT 's3(direct) / ftp / local / db / sftp(proxy)',
    create_time datetime               DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id),
    KEY idx_vault_asset_ref_asset (asset_id),
    KEY idx_vault_asset_ref_vault (vault_id),
    UNIQUE KEY uk_vault_asset_ref_hash (vault_id, sha256)
) ENGINE = InnoDB COMMENT = 'Vault 附件对象引用';

-- 3) 内容寻址 blob 表不再使用（开发阶段无历史数据，直接删）
DROP TABLE IF EXISTS vault_file_blob;
