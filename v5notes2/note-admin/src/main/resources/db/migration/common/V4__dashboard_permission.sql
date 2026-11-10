-- =============================================================================
-- 首页聚合统计接口权限（notes:dashboard:query）
-- -----------------------------------------------------------------------------
-- 背景：GET /notes/dashboard/overview 是首页（/index）的数据源，接口上带
--       @SaCheckPermission("notes:dashboard:query")。没有对应的 sys_menu 记录时，
--       除超级管理员外所有角色打开首页都会 403（数据设计.md 待确认 #9）。
--
-- 做法：在「云笔记」目录（menu_id = 7）下补一条 F 类型（按钮）权限记录，
--       并默认授予所有现存角色，避免升级后普通用户直接打不开首页。
--       需要收紧权限时，删掉 sys_role_menu 里对应的行即可，不需要改代码。
--
-- 幂等：先按 menu_id 清理再插入，重复执行安全。
-- =============================================================================

DELETE FROM sys_role_menu WHERE menu_id = 1849657043265904648;
DELETE FROM sys_menu WHERE menu_id = 1849657043265904648;

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904648, '首页统计', 7, 0, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:dashboard:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL,
        '首页聚合统计接口权限');

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT role_id, 1849657043265904648 FROM sys_role WHERE del_flag = '0';
