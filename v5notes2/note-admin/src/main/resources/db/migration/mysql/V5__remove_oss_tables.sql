-- =============================================================================
-- 移除旧 OSS 对象存储（sys_oss / sys_oss_config）
-- -----------------------------------------------------------------------------
-- 背景：文件存储已迁移到 basics_file / basics_file_config（note-base-file 模块），
--       旧的 RuoYi OSS 两张表与整套 CRUD 不再使用（后端代码同步删除）。
--
--       注意 sys_user.avatar 原来是 bigint 存 sys_oss.oss_id，删表前必须先把 id
--       回填成 sys_oss.url，否则所有头像会永久丢失；回填完再把列改成 varchar(500)。
-- =============================================================================

-- 1) 头像列改成 URL 字符串
ALTER TABLE sys_user MODIFY COLUMN avatar varchar(500) NULL COMMENT '头像地址';

-- 2) 老数据：oss_id → url（只处理纯数字，避免误伤已经是 URL 的值）
UPDATE sys_user u
    JOIN sys_oss o ON o.oss_id = CAST(u.avatar AS UNSIGNED)
SET u.avatar = o.url
WHERE u.avatar IS NOT NULL
  AND u.avatar <> ''
  AND u.avatar REGEXP '^[0-9]+$';

-- 3) 清理可能残留的 OSS 菜单与按钮（V3 已删过一批，这里按权限字符串兜底）
DELETE FROM sys_role_menu
WHERE menu_id IN (SELECT menu_id FROM (SELECT menu_id FROM sys_menu WHERE perms LIKE 'system:oss:%' OR path = 'oss') t);

DELETE FROM sys_menu WHERE perms LIKE 'system:oss:%' OR path = 'oss';

-- 4) 删表
DROP TABLE IF EXISTS sys_oss;
DROP TABLE IF EXISTS sys_oss_config;
