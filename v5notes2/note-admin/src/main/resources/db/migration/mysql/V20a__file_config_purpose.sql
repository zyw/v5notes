-- 文件配置增加用途维度（设计 D2）：附件与图片库各自独立配置，互不牵连。
ALTER TABLE basics_file_config
    ADD COLUMN purpose varchar(32) NOT NULL DEFAULT 'GENERIC'
        COMMENT '用途：GENERIC(图片库/头像) / VAULT_ASSET(同步附件)';

CREATE INDEX idx_basics_file_config_purpose ON basics_file_config (purpose);
