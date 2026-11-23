-- Vault 附件改走基础文件接口（设计 D4/D5/D6）
-- PostgreSQL 方言：mediumtext -> text，去掉 ENGINE，注释用 COMMENT ON。

-- 1) 笔记/config 正文（asset 为 NULL）
ALTER TABLE vault_file ADD COLUMN content text NULL;

COMMENT ON COLUMN vault_file.content IS 'note/config 正文（asset 为 NULL）';

-- 2) 附件对象引用
CREATE TABLE IF NOT EXISTS vault_asset_ref
(
    file_id     bigint      NOT NULL,
    asset_id    bigint      NOT NULL,
    vault_id    bigint      NOT NULL,
    sha256      varchar(80) NOT NULL,
    size_bytes  bigint      NOT NULL DEFAULT 0,
    mime_type   varchar(128)         DEFAULT NULL,
    storage_key varchar(512)         DEFAULT NULL,
    config_id   bigint               DEFAULT NULL,
    backend     varchar(16) NOT NULL DEFAULT 'proxy',
    create_time timestamp            DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_asset_ref_asset ON vault_asset_ref (asset_id);
CREATE INDEX IF NOT EXISTS idx_vault_asset_ref_vault ON vault_asset_ref (vault_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_vault_asset_ref_hash ON vault_asset_ref (vault_id, sha256);

COMMENT ON TABLE vault_asset_ref IS 'Vault 附件对象引用';
COMMENT ON COLUMN vault_asset_ref.file_id IS 'vault_file.id';
COMMENT ON COLUMN vault_asset_ref.asset_id IS 'basics_file.id';
COMMENT ON COLUMN vault_asset_ref.storage_key IS '底层对象 key';
COMMENT ON COLUMN vault_asset_ref.config_id IS '写入该对象的文件配置，读取按此回原后端';
COMMENT ON COLUMN vault_asset_ref.backend IS 's3(direct) / ftp / local / db / sftp(proxy)';

-- 3) 删除内容寻址 blob 表
DROP TABLE IF EXISTS vault_file_blob;
