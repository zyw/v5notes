-- 客户端自助注册成功后邮件通知管理员。参数设置可改，默认关闭。

INSERT INTO sys_config (config_id, config_name, config_key, config_value, config_type, create_dept, create_by, create_time, remark)
VALUES (1761700000000000106, '账号自助-客户端注册成功是否邮件通知管理员', 'client.account.registerNotifyAdmin', 'false', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '仅客户端自助注册成功后发送（true开启，false关闭）');

INSERT INTO sys_config (config_id, config_name, config_key, config_value, config_type, create_dept, create_by, create_time, remark)
VALUES (1761700000000000107, '账号自助-客户端注册成功管理员通知邮箱', 'client.account.registerNotifyAdminEmail', '', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '通知收件邮箱，多个用逗号或分号分隔；开关开启且邮箱非空时才会发送');
