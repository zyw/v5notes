-- Vault 同步管理端：跨库「附件同步」菜单与预览下载权限。
-- 挂在「Vault 同步」(menu_id = 1849657043265905000) 下，排在「副本管理」(3) 之后。
-- 幂等：先按 menu_id 清理再插入。

DELETE FROM sys_role_menu
WHERE menu_id IN (
    1849657043265905006,
    1849657043265905050
);

DELETE FROM sys_menu
WHERE menu_id IN (
    1849657043265905006,
    1849657043265905050
);

-- 调整后续二级菜单排序，保持侧边栏顺序清晰
UPDATE sys_menu SET order_num = 5 WHERE menu_id = 1849657043265905004;
UPDATE sys_menu SET order_num = 6 WHERE menu_id = 1849657043265905005;

-- 二级菜单：附件同步
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905006, '附件同步', 1849657043265905000, 4, 'assets', 'vault/assets/index', '', 'N', 'Y', 'C', '0', '0',
        'vault:asset:list', 'upload', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'Vault 跨库同步附件列表');

-- 按钮权限：附件预览下载
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905050, '附件预览下载', 1849657043265905006, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:asset:content', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

-- 授予超级管理员角色
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, menu_id
FROM sys_menu
WHERE menu_id IN (
    1849657043265905006,
    1849657043265905050
)
  AND NOT EXISTS (SELECT 1
                  FROM sys_role_menu rm
                  WHERE rm.role_id = 1
                    AND rm.menu_id = sys_menu.menu_id);
