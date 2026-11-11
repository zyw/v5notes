-- =============================================================================
-- v5notes2 数据迁移脚本：旧库(v5notes-prod) -> 新库(v5notes2)
-- 适用：同一 MySQL 实例，旧库与新库同时存在（新库由 v5notes_vue.sql + notes2.sql 初始化）
-- 执行顺序：1) v5notes_vue.sql  2) notes2.sql  3) 本脚本
-- 注意：如库名不同，请全局替换 `v5notes-prod`(源) 与 v5notes2(目标)。
-- 本脚本不迁移旧 sys_menu（原因见文末说明），保留 6.1.0 种子菜单 + notes2.sql 的笔记/文件菜单。
-- =============================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

USE v5notes2;

-- 1) 部门（旧 tenant_id 丢弃）
REPLACE INTO sys_dept
(dept_id, parent_id, ancestors, dept_name, dept_category, order_num, leader, phone, email, status, del_flag, create_dept, create_by, create_time, update_by, update_time)
SELECT dept_id, parent_id, ancestors, dept_name, dept_category, order_num, leader, phone, email, status, del_flag, create_dept, create_by, create_time, update_by, update_time
FROM `v5notes-prod`.sys_dept;

-- 2) 岗位（旧无 del_flag，补 '0'）
REPLACE INTO sys_post
(dept_id, post_id, post_code, post_category, post_name, post_sort, status, del_flag, create_dept, create_by, create_time, update_by, update_time, remark)
SELECT dept_id, post_id, post_code, post_category, post_name, post_sort, status, '0', create_dept, create_by, create_time, update_by, update_time, remark
FROM `v5notes-prod`.sys_post;

-- 3) 用户（phonenumber->phone_number, sex->gender, 丢弃 tenant_id）
REPLACE INTO sys_user
(user_id, dept_id, user_name, nick_name, user_type, email, phone_number, gender, avatar, password, status, del_flag, login_ip, login_date, create_dept, create_by, create_time, update_by, update_time, remark)
SELECT user_id, dept_id, user_name, nick_name, user_type, email, phonenumber, sex, avatar, password, status, del_flag, login_ip, login_date, create_dept, create_by, create_time, update_by, update_time, remark
FROM `v5notes-prod`.sys_user;

-- 4) 角色（丢弃 tenant_id）
REPLACE INTO sys_role
(role_id, role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly, status, del_flag, create_dept, create_by, create_time, update_by, update_time, remark)
SELECT role_id, role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly, status, del_flag, create_dept, create_by, create_time, update_by, update_time, remark
FROM `v5notes-prod`.sys_role;

-- 5) 用户-角色、用户-岗位、角色-部门（数据权限）
REPLACE INTO sys_user_role (user_id, role_id)
SELECT user_id, role_id FROM `v5notes-prod`.sys_user_role;

REPLACE INTO sys_user_post (user_id, post_id)
SELECT user_id, post_id FROM `v5notes-prod`.sys_user_post;

-- 若旧库存在 sys_role_dept 则一并迁移（不存在会报错，可注释掉）
-- REPLACE INTO sys_role_dept (role_id, dept_id) SELECT role_id, dept_id FROM `v5notes-prod`.sys_role_dept;

-- 6) 字典类型/数据（丢弃 tenant_id；notes2.sql 已插入 user_type、basics_file_storage，REPLACE 不冲突）
REPLACE INTO sys_dict_type
(dict_id, dict_name, dict_type, create_dept, create_by, create_time, update_by, update_time, remark)
SELECT dict_id, dict_name, dict_type, create_dept, create_by, create_time, update_by, update_time, remark
FROM `v5notes-prod`.sys_dict_type;

REPLACE INTO sys_dict_data
(dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, update_by, update_time, remark)
SELECT dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, update_by, update_time, remark
FROM `v5notes-prod`.sys_dict_data;

-- 7) 客户端（补 access_path/ip_whitelist 为 NULL；保留 notes2.sql 的 clientPassword 行）
REPLACE INTO sys_client
(id, client_id, client_key, client_secret, grant_type, device_type, access_path, ip_whitelist, active_timeout, timeout, status, del_flag, create_dept, create_by, create_time, update_by, update_time)
SELECT id, client_id, client_key, client_secret, grant_type, device_type, NULL, NULL, active_timeout, timeout, status, del_flag, create_dept, create_by, create_time, update_by, update_time
FROM `v5notes-prod`.sys_client;

-- 8) 笔记业务数据（丢弃 tenant_id）
REPLACE INTO note_directory
(id, user_id, dept_id, name, pid, del_flag, descr, create_dept, create_by, create_time, update_by, update_time)
SELECT id, user_id, dept_id, name, pid, del_flag, descr, create_dept, create_by, create_time, update_by, update_time
FROM `v5notes-prod`.note_directory;

REPLACE INTO note_notes
(id, user_id, dept_id, name, dir_id, content, del_flag, create_dept, create_by, create_time, update_by, update_time)
SELECT id, user_id, dept_id, name, dir_id, content, del_flag, create_dept, create_by, create_time, update_by, update_time
FROM `v5notes-prod`.note_notes;

-- 9) 文件服务数据（basics_file 存储，弃用 OSS）
REPLACE INTO basics_file_config
(id, name, storage, remark, master, config, del_flag, create_dept, create_by, create_time, update_by, update_time)
SELECT id, name, storage, remark, master, config, del_flag, create_dept, create_by, create_time, update_by, update_time
FROM `v5notes-prod`.basics_file_config;

REPLACE INTO basics_file
(id, config_id, name, path, url, type, size, del_flag, create_dept, create_by, create_time, update_by, update_time)
SELECT id, config_id, name, path, url, type, size, del_flag, create_dept, create_by, create_time, update_by, update_time
FROM `v5notes-prod`.basics_file;

REPLACE INTO basics_file_content
(id, config_id, path, content, del_flag, create_dept, create_by, create_time, update_by, update_time)
SELECT id, config_id, path, content, del_flag, create_dept, create_by, create_time, update_by, update_time
FROM `v5notes-prod`.basics_file_content;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 校验（迁移后人工核对，预期目标行数 >= 源行数）
-- SELECT (SELECT COUNT(*) FROM note_notes) AS notes_new, (SELECT COUNT(*) FROM `v5notes-prod`.note_notes) AS notes_old;
-- SELECT (SELECT COUNT(*) FROM note_directory) AS dir_new, (SELECT COUNT(*) FROM `v5notes-prod`.note_directory) AS dir_old;
-- SELECT (SELECT COUNT(*) FROM sys_user) AS users_new, (SELECT COUNT(*) FROM `v5notes-prod`.sys_user) AS users_old;
-- SELECT (SELECT COUNT(*) FROM basics_file) AS files_new, (SELECT COUNT(*) FROM `v5notes-prod`.basics_file) AS files_old;
--
-- 说明：不迁移旧 sys_menu。因为 6.1.0 的管理后台组件路径、权限标识、菜单列（active_menu/ext）
-- 与 5.2.2 不同，旧菜单会导致新管理前端路由/页面 404。保留 target 的 v5notes_vue.sql 种子菜单，
-- 再由 notes2.sql 插入与 v6 兼容的笔记/文件菜单；超级管理员(role_id=1)默认拥有全部菜单。
-- 如需把笔记/文件菜单授权给特定非超级管理员角色，请在 notes2.sql 或此处追加 sys_role_menu。
-- =============================================================================
