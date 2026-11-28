-- Vault 同步管理端 P3 菜单（扩展市场）。
-- 挂在「Vault 同步」(menu_id = 1849657043265905000) 下。

DELETE FROM sys_role_menu
WHERE menu_id IN (
    1849657043265905005,
    1849657043265905040,
    1849657043265905041,
    1849657043265905042,
    1849657043265905043,
    1849657043265905044
);

DELETE FROM sys_menu
WHERE menu_id IN (
    1849657043265905005,
    1849657043265905040,
    1849657043265905041,
    1849657043265905042,
    1849657043265905043,
    1849657043265905044
);

-- 二级菜单：扩展市场
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905005, '扩展市场', 1849657043265905000, 5, 'catalog', 'vault/catalog/index', '', 'N', 'Y', 'C', '0', '0',
        'vault:catalog:list', 'component', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'Vault 官方扩展与主题目录');

-- 按钮权限
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905040, '扩展详情查询', 1849657043265905005, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:catalog:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905041, '扩展新增', 1849657043265905005, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:catalog:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905042, '扩展编辑', 1849657043265905005, 3, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:catalog:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905043, '扩展上下架', 1849657043265905005, 4, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:catalog:publish', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905044, '扩展删除', 1849657043265905005, 5, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:catalog:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, menu_id
FROM sys_menu
WHERE menu_id IN (
    1849657043265905005,
    1849657043265905040,
    1849657043265905041,
    1849657043265905042,
    1849657043265905043,
    1849657043265905044
)
  AND NOT EXISTS (SELECT 1
                  FROM sys_role_menu rm
                  WHERE rm.role_id = 1
                    AND rm.menu_id = sys_menu.menu_id);
