-- 客户端以邮箱作为登录账号，扩展 user_name 以容纳邮箱长度（与 email 列一致）。
ALTER TABLE sys_user
    MODIFY COLUMN user_name varchar(50) NOT NULL COMMENT '用户账号（客户端可为邮箱）';
