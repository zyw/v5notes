-- 客户端第三方登录开关（参数设置可改）。默认关闭。

INSERT INTO sys_config (config_id, config_name, config_key, config_value, config_type, create_dept, create_by, create_time, remark)
VALUES (1761700000000000104, '账号自助-是否开启客户端第三方登录', 'client.thirdPartyLogin.enable', 'false', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '是否开启客户端第三方登录（true开启，false关闭）');
