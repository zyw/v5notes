-- Vault 同步管理端 P1 菜单（同步概览 / 云端库管理 / 副本管理）。
-- 一级目录与「云笔记」(menu_id = 7, order_num = 6) 并列，数据与权限独立。
-- 默认只授予超级管理员角色 role_id = 1，其他角色在菜单管理里分配。
-- 幂等：先按 menu_id 清理再插入。

DELETE FROM sys_role_menu
WHERE menu_id IN (
    1849657043265905000,
    1849657043265905001,
    1849657043265905002,
    1849657043265905003,
    1849657043265905010,
    1849657043265905011,
    1849657043265905012,
    1849657043265905013,
    1849657043265905014,
    1849657043265905020
);

DELETE FROM sys_menu
WHERE menu_id IN (
    1849657043265905000,
    1849657043265905001,
    1849657043265905002,
    1849657043265905003,
    1849657043265905010,
    1849657043265905011,
    1849657043265905012,
    1849657043265905013,
    1849657043265905014,
    1849657043265905020
);

-- 一级目录：Vault 同步
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905000, 'Vault 同步', 0, 7, 'vault', NULL, '', 'N', 'Y', 'M', '0', '0',
        '', 'server', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'Vault 本地优先同步管理');

-- 二级菜单：同步概览 / 云端库管理 / 副本管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905001, '同步概览', 1849657043265905000, 1, 'overview', 'vault/overview/index', '', 'N', 'Y', 'C', '0', '0',
        'vault:overview:query', 'chart', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'Vault 同步全局指标与趋势'),
       (1849657043265905002, '云端库管理', 1849657043265905000, 2, 'spaces', 'vault/spaces/index', '', 'N', 'Y', 'C', '0', '0',
        'vault:space:list', 'nested', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'Vault 云端同步库管理'),
       (1849657043265905003, '副本管理', 1849657043265905000, 3, 'replicas', 'vault/replicas/index', '', 'N', 'Y', 'C', '0', '0',
        'vault:replica:list', 'monitor', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'Vault 已绑定副本管理');

-- 按钮权限：云端库管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905010, '库详情查询', 1849657043265905002, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:space:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905011, '强制删除库', 1849657043265905002, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:space:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905012, '文件清单查询', 1849657043265905002, 3, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:file:list', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905013, '文件正文预览', 1849657043265905002, 4, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:file:content', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905014, '文件墓碑删除', 1849657043265905002, 5, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:file:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

-- 按钮权限：副本管理
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905020, '副本强制解绑', 1849657043265905003, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:replica:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

-- 授予超级管理员角色
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, menu_id
FROM sys_menu
WHERE menu_id IN (
    1849657043265905000,
    1849657043265905001,
    1849657043265905002,
    1849657043265905003,
    1849657043265905010,
    1849657043265905011,
    1849657043265905012,
    1849657043265905013,
    1849657043265905014,
    1849657043265905020
)
  AND NOT EXISTS (SELECT 1
                  FROM sys_role_menu rm
                  WHERE rm.role_id = 1
                    AND rm.menu_id = sys_menu.menu_id);
