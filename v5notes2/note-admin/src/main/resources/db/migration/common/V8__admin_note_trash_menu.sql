-- 管理端回收站菜单。挂在「云笔记」(menu_id = 7) 下。
-- 默认只授予超级管理员角色 role_id = 1。其他角色在菜单管理里分配。
-- 幂等：先按 menu_id 清理再插入。

DELETE FROM sys_role_menu WHERE menu_id IN (1849657043265904650, 1849657043265904651, 1849657043265904652, 1849657043265904653);
DELETE FROM sys_menu WHERE menu_id IN (1849657043265904650, 1849657043265904651, 1849657043265904652, 1849657043265904653);

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904650, '回收站', 7, 3, 'trash', 'notes/trash/index', '', 'N', 'Y', 'C', '0', '0',
        'notes:trash:list', 'list', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '笔记回收站');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904651, '回收站恢复', 1849657043265904650, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:trash:restore', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265904652, '回收站删除', 1849657043265904650, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:trash:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265904653, '回收站清空', 1849657043265904650, 3, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:trash:clean', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, menu_id
FROM sys_menu
WHERE menu_id IN (1849657043265904650, 1849657043265904651, 1849657043265904652, 1849657043265904653)
  AND NOT EXISTS (SELECT 1
                  FROM sys_role_menu rm
                  WHERE rm.role_id = 1
                    AND rm.menu_id = sys_menu.menu_id);
