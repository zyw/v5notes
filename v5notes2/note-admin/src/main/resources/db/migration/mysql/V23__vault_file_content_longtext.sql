-- 将 vault_file.content 从 mediumtext (16MB) 升级为 longtext，与 25MB 单文件上限及 PostgreSQL text 对齐
ALTER TABLE vault_file
    MODIFY COLUMN content longtext NULL COMMENT 'note/config 正文（asset 为 NULL）';
