-- 客户端自助注册、用户来源，以及试用时长和试用空间。已有用户默认按管理端添加，不进入试用限制。

ALTER TABLE sys_user ADD COLUMN user_source varchar(32) NOT NULL DEFAULT 'sys_add';

INSERT INTO sys_config (config_id, config_name, config_key, config_value, config_type, create_dept, create_by, create_time, remark)
VALUES (1761700000000000101, '账号自助-是否开启客户端用户注册功能', 'client.account.registerUser', 'false', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '是否开启客户端自助注册（true开启，false关闭）');

INSERT INTO sys_config (config_id, config_name, config_key, config_value, config_type, create_dept, create_by, create_time, remark)
VALUES (1761700000000000102, '账号自助-客户端注册用户试用天数', 'client.account.trialDays', '30', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '仅客户端自助注册用户生效，超出后提示试用期已过');

INSERT INTO sys_config (config_id, config_name, config_key, config_value, config_type, create_dept, create_by, create_time, remark)
VALUES (1761700000000000103, '账号自助-客户端注册用户试用空间MB', 'client.account.trialStorageMb', '20', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, '仅客户端自助注册用户生效，笔记与上传文件合计超出后提示试用期已过');
