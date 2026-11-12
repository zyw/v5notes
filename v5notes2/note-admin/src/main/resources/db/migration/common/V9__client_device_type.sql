-- 设备类型只保留 admin / client，客户端只保留管理端与笔记客户端两条。
-- 登录时用 client_id 找到设备类型，再与用户类型匹配：
--   admin  -> sys_user
--   client -> cli_user

DELETE FROM sys_dict_data WHERE dict_type = 'sys_device_type';

INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1761600000000000035, 1, '管理端', 'admin', 'sys_device_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '管理端，只允许 sys_user 登录'),
       (1761600000000000036, 2, '客户端', 'client', 'sys_device_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, 'PC客户端、APP客户端、小程序客户端等，只允许 cli_user 登录');

UPDATE sys_dict_type
SET remark = '登录端类型：admin 管理端，client 客户端'
WHERE dict_type = 'sys_device_type';

UPDATE sys_client
SET device_type = 'admin'
WHERE client_id = 'e5cd7e4891bf95d1d19206ce24a7b32e';

UPDATE sys_client
SET device_type = 'client'
WHERE client_id = 'd9df3c0228c05e5c61db46348bcadf6e';

DELETE FROM sys_client
WHERE client_id NOT IN ('e5cd7e4891bf95d1d19206ce24a7b32e', 'd9df3c0228c05e5c61db46348bcadf6e');
