-- Phase 3：Vault 桌面客户端 sys_client（device_type=vault_client）
-- client_id 与 v5notes-vault-client 默认 VITE_CLIENT_ID / DEFAULT_CLIENT_ID 一致。

INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
SELECT 1761600000000000037, 3, 'Vault客户端', 'vault_client', 'sys_device_type', '', 'default', 'N',
       1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL,
       'V5Notes Vault 桌面端，只允许 cli_user 登录'
WHERE NOT EXISTS (
    SELECT 1 FROM sys_dict_data WHERE dict_type = 'sys_device_type' AND dict_value = 'vault_client'
);

UPDATE sys_dict_type
SET remark = '登录端类型：admin 管理端，client 云笔记客户端，vault_client Vault 客户端'
WHERE dict_type = 'sys_device_type';

INSERT INTO sys_client (id, client_id, client_key, client_secret, grant_type, device_type, access_path, ip_whitelist,
                        active_timeout, timeout, status, del_flag, create_dept, create_by, create_time, update_by, update_time)
SELECT 1851635079091687427, 'b8e4f02a5c3d7916f2a0b1d9e7c5f3a1', 'vault_client', 'vaultClient123',
       'clientPassword,social', 'vault_client',
       NULL, NULL, -1, 604800, '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM sys_client WHERE client_id = 'b8e4f02a5c3d7916f2a0b1d9e7c5f3a1'
);
