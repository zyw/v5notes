-- 文件配置增加用途维度（设计 D2）。
ALTER TABLE basics_file_config
    ADD COLUMN purpose varchar(32) NOT NULL DEFAULT 'GENERIC';

COMMENT ON COLUMN basics_file_config.purpose IS '用途：GENERIC(图片库/头像) / VAULT_ASSET(同步附件)';

CREATE INDEX IF NOT EXISTS idx_basics_file_config_purpose ON basics_file_config (purpose);
