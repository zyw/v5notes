DROP TABLE IF EXISTS gen_template;
CREATE TABLE gen_template(
     `id` BIGINT NOT NULL COMMENT 'ID',
     `tenant_id` VARCHAR(20) NOT NULL COMMENT '租户ID',
     `be_type` VARCHAR(20) NOT NULL COMMENT '后端模版类型',
     `fe_type` VARCHAR(20) NOT NULL COMMENT '前端模版类型',
     `name` VARCHAR(50) NOT NULL COMMENT '模版名称',
     `content` LONGTEXT COMMENT '模版内容',
     `file_name` VARCHAR(100) NOT NULL COMMENT '模版名称，需要包含生成文件的扩展名',
     `file_path` VARCHAR(200) COMMENT '生成文件路径，如果为空生成文件在压缩包的跟目录下',
     `status` CHAR(1) NOT NULL DEFAULT 0 COMMENT '状态:0正常,1停用',
     `del_flag` CHAR(1) NOT NULL DEFAULT 0 COMMENT '删除标志（0代表存在 2代表删除）',
     `create_by` VARCHAR(64) COMMENT '创建者',
     `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
     `update_by` VARCHAR(64) COMMENT '更新者',
     `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
     PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT '代码模版表';


-- 菜单 SQL
insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1976174802947248130, '代码模版', '3', '1', 'template', 'tool/template/index', 1, 0, 'C', '0', '0', 'gen:template:list', 'skill', 103, 1, sysdate(), null, null, '代码模版菜单');

-- 按钮 SQL
insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1976174802947248131, '代码模版查询', 1976174802947248130, '1',  '#', '', 1, 0, 'F', '0', '0', 'gen:template:query',        '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1976174802947248132, '代码模版新增', 1976174802947248130, '2',  '#', '', 1, 0, 'F', '0', '0', 'gen:template:add',          '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1976174802947248133, '代码模版修改', 1976174802947248130, '3',  '#', '', 1, 0, 'F', '0', '0', 'gen:template:edit',         '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(1976174802947248134, '代码模版删除', 1976174802947248130, '4',  '#', '', 1, 0, 'F', '0', '0', 'gen:template:remove',       '#', 103, 1, sysdate(), null, null, '');
