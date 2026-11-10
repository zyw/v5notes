-- =============================================================================
-- 移除旧 OSS 对象存储（sys_oss / sys_oss_config）· PostgreSQL 方言
-- -----------------------------------------------------------------------------
-- 与 mysql/V5__remove_oss_tables.sql 等价：先把 sys_user.avatar 的 oss_id 回填成 url，
-- 再把列改成 varchar(500)，最后删表并清理残留菜单。
-- =============================================================================

-- 1) 头像列改成 URL 字符串
ALTER TABLE sys_user ALTER COLUMN avatar TYPE varchar(500) USING avatar::text;

-- 2) 老数据：oss_id → url（只处理纯数字）
UPDATE sys_user u
SET avatar = o.url
FROM sys_oss o
WHERE u.avatar IS NOT NULL
  AND u.avatar <> ''
  AND u.avatar ~ '^[0-9]+$'
  AND o.oss_id::text = u.avatar;

-- 3) 清理可能残留的 OSS 菜单与按钮
DELETE FROM sys_role_menu WHERE menu_id IN (SELECT menu_id FROM sys_menu WHERE perms LIKE 'system:oss:%' OR path = 'oss');
DELETE FROM sys_menu WHERE perms LIKE 'system:oss:%' OR path = 'oss';

-- 4) 删表
DROP TABLE IF EXISTS sys_oss;
DROP TABLE IF EXISTS sys_oss_config;
