SET NAMES utf8mb4;
DROP TABLE IF EXISTS note_directory;
CREATE TABLE note_directory(
   `id` bigint(20) NOT NULL  COMMENT 'ID',
   `user_id` bigint(20) NOT NULL  COMMENT '目录所属用户ID',
   `dept_id` bigint(20) NOT NULL DEFAULT 0 COMMENT '所属部门ID',
   `name` VARCHAR(100) NOT NULL  COMMENT '目录名称',
   `pid` bigint(20) NOT NULL DEFAULT 0 COMMENT '父目录ID',
   `del_flag` char(1) NOT NULL DEFAULT 0 COMMENT '删除标志（0代表存在 2代表删除）',
   `tenant_id` VARCHAR(20) NOT NULL DEFAULT '000000' COMMENT '租户编号',
   `descr` VARCHAR(255)   COMMENT '描述',
   `create_dept` bigint(20)   COMMENT '创建部门' ,
   `create_by` varchar(64)   COMMENT '创建者' ,
   `create_time` DATETIME  DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间' ,
   `update_by` VARCHAR(64)   COMMENT '更新者' ,
   `update_time` DATETIME  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' ,
   PRIMARY KEY (id)
) engine=innodb COMMENT = '目录表';

DROP TABLE IF EXISTS note_notes;
CREATE TABLE note_notes(
    `id` bigint(20) NOT NULL  COMMENT '笔记ID编号' ,
    `user_id` bigint(20) NOT NULL  COMMENT '笔记所属用户' ,
    `dept_id` bigint(20) NOT NULL DEFAULT 0 COMMENT '所属部门ID',
    `name` VARCHAR(100) NOT NULL  COMMENT '笔记名' ,
    `dir_id` bigint(20) NOT NULL DEFAULT 0 COMMENT '所属目录ID' ,
    `content` MEDIUMTEXT   COMMENT '笔记内容' ,
    `tenant_id` VARCHAR(20)  DEFAULT '000000' COMMENT '租户编号' ,
    `del_flag` char(1)  DEFAULT 0 COMMENT '删除标志（0代表存在 2代表删除）' ,
    `create_dept` bigint(20)   COMMENT '创建部门' ,
    `create_by` varchar(64)   COMMENT '创建者' ,
    `create_time` DATETIME  DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间' ,
    `update_by` VARCHAR(64)   COMMENT '更新者' ,
    `update_time` DATETIME  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' ,
    PRIMARY KEY (id)
) engine=innodb COMMENT = '笔记表';

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(7, '云笔记'  , '0',    '6', 'notes','',1, 0, 'M', '0', '0', '', 'log', '103', 1, sysdate(), NULL, NULL, '云笔记');


-- 菜单 SQL
insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657039948210177, '目录管理', '7', '1', 'directory', 'notes/directory/index', 1, 0, 'C', '0', '0', 'notes:directory:list', 'tab', 103, 1, sysdate(), null, null, '目录菜单');

-- 按钮 SQL
insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657039948210178, '目录查询', 1849657039948210177, '1',  '#', '', 1, 0, 'F', '0', '0', 'notes:directory:query',        '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657039948210179, '目录新增', 1849657039948210177, '2',  '#', '', 1, 0, 'F', '0', '0', 'notes:directory:add',          '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657039948210180, '目录修改', 1849657039948210177, '3',  '#', '', 1, 0, 'F', '0', '0', 'notes:directory:edit',         '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657039948210181, '目录删除', 1849657039948210177, '4',  '#', '', 1, 0, 'F', '0', '0', 'notes:directory:remove',       '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657039948210182, '目录导出', 1849657039948210177, '5',  '#', '', 1, 0, 'F', '0', '0', 'notes:directory:export',       '#', 103, 1, sysdate(), null, null, '');



-- 菜单 SQL
insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657043265904642, '笔记管理', '7', '1', 'notes', 'notes/notes/index', 1, 0, 'C', '0', '0', 'notes:notes:list', 'finish', 103, 1, sysdate(), null, null, '笔记菜单');

-- 按钮 SQL
insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657043265904643, '笔记查询', 1849657043265904642, '1',  '#', '', 1, 0, 'F', '0', '0', 'notes:notes:query',        '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657043265904644, '笔记新增', 1849657043265904642, '2',  '#', '', 1, 0, 'F', '0', '0', 'notes:notes:add',          '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657043265904645, '笔记修改', 1849657043265904642, '3',  '#', '', 1, 0, 'F', '0', '0', 'notes:notes:edit',         '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657043265904646, '笔记删除', 1849657043265904642, '4',  '#', '', 1, 0, 'F', '0', '0', 'notes:notes:remove',       '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1849657043265904647, '笔记导出', 1849657043265904642, '5',  '#', '', 1, 0, 'F', '0', '0', 'notes:notes:export',       '#', 103, 1, sysdate(), null, null, '');


-- 客户端表
INSERT INTO `sys_client` (`id`, `client_id`, `client_key`, `client_secret`, `grant_type`, `device_type`, `active_timeout`, `timeout`, `status`, `del_flag`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`) VALUES (1851635079091687426, 'd9df3c0228c05e5c61db46348bcadf6e', 'client', 'client123', 'clientPassword', 'pc_client', -1, 604800, '0', '0', 103, 1, '2024-10-30 22:39:39', 1, '2024-11-10 16:32:44');

-- 字典类型表
INSERT INTO `sys_dict_type` (`dict_id`, `tenant_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1851976902360236033, '000000', '用户类型', 'user_type', 103, 1, '2024-10-31 21:17:56', 1, '2024-10-31 21:17:56', 'pc管理端用戶、客戶端用戶');

-- 字典数据表
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1851635425633472514, '000000', 0, 'PC客户端', 'pc_client', 'sys_device_type', '', 'default', 'N', 103, 1, '2024-10-30 22:41:02', 1, '2024-10-30 22:41:02', 'PC客户端');
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1851901153796288514, '000000', 0, '客户端密码认证', 'clientPassword', 'sys_grant_type', 'el-check-tag', 'default', 'N', 103, 1, '2024-10-31 16:16:56', 1, '2024-10-31 16:17:36', '客户端密码认证');
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1851977152646938626, '000000', 0, 'PC管理端用戶', 'sys_user', 'user_type', '', 'default', 'N', 103, 1, '2024-10-31 21:18:56', 1, '2024-10-31 21:18:56', 'PC管理端用戶');
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`) VALUES (1851977265763123201, '000000', 0, '客戶端用戶', 'cli_user', 'user_type', '', 'default', 'N', 103, 1, '2024-10-31 21:19:23', 1, '2024-10-31 21:19:23', '此用户可以是PC客户端、APP客户端、小程序客户端等');
