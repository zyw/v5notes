-- Vault 同步管理端 P2 菜单（配额与策略）及全局默认策略参数。
-- 挂在「Vault 同步」(menu_id = 1849657043265905000) 下。
-- 幂等：先按 menu_id / config_key 清理再插入。

DELETE FROM sys_role_menu
WHERE menu_id IN (
    1849657043265905004,
    1849657043265905030,
    1849657043265905031
);

DELETE FROM sys_menu
WHERE menu_id IN (
    1849657043265905004,
    1849657043265905030,
    1849657043265905031
);

-- 二级菜单：配额与策略
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905004, '配额与策略', 1849657043265905000, 4, 'quota', 'vault/quota/index', '', 'N', 'Y', 'C', '0', '0',
        'vault:quota:list', 'tool', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'Vault 同步配额策略与存储维护');

-- 按钮权限：配额策略编辑 / 存储维护执行
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265905030, '配额策略编辑', 1849657043265905004, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:quota:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, ''),
       (1849657043265905031, '存储维护执行', 1849657043265905004, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'vault:maintenance:run', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, menu_id
FROM sys_menu
WHERE menu_id IN (
    1849657043265905004,
    1849657043265905030,
    1849657043265905031
)
  AND NOT EXISTS (SELECT 1
                  FROM sys_role_menu rm
                  WHERE rm.role_id = 1
                    AND rm.menu_id = sys_menu.menu_id);

-- 全局默认 Vault 同步策略（sys_config）
DELETE FROM sys_config
WHERE config_key IN (
    'vault.sync.defaultQuotaBytes',
    'vault.sync.defaultReplicaLimit',
    'vault.sync.defaultMaxFileBytes',
    'vault.sync.tombstoneRetentionDays',
    'vault.sync.orphanAssetGraceDays'
);

INSERT INTO sys_config (config_id, config_name, config_key, config_value, config_type, create_dept, create_by, create_time, remark)
VALUES (1761700000000000201, 'Vault同步-默认单用户容量上限（字节）', 'vault.sync.defaultQuotaBytes', '1073741824', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '默认 1GB，用户级未覆盖时生效'),
       (1761700000000000202, 'Vault同步-默认单库绑定副本上限', 'vault.sync.defaultReplicaLimit', '3', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '默认 3 个副本'),
       (1761700000000000203, 'Vault同步-默认单文件大小上限（字节）', 'vault.sync.defaultMaxFileBytes', '26214400', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '默认 25MB，不超过 spring.servlet.multipart.max-file-size'),
       (1761700000000000204, 'Vault同步-墓碑保留天数', 'vault.sync.tombstoneRetentionDays', '90', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '已删除文件元数据最短保留天数（>=30）'),
       (1761700000000000205, 'Vault同步-孤儿附件清理宽限天数', 'vault.sync.orphanAssetGraceDays', '7', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '未引用附件对象的最短宽限天数（>=1）');
