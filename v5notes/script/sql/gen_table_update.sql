alter table `gen_table` add column `be_type` varchar(10) default "java" comment "后端模版类型" after `gen_path`;
alter table `gen_table` add column `fe_type` varchar(10) default "default" comment "前端模版类型" after `be_type`;


alter table `gen_table_column` rename column `java_type` to `field_type`;
alter table `gen_table_column` rename column `java_field` to `field_name`;

alter table `gen_table_column` modify column `field_type` varchar(500) comment "字段类型";
alter table `gen_table_column` modify column `field_name` varchar(200) comment "字段名称";


alter table `gen_table_column` add column `default_val` varchar(50) comment "默认值" after `field_name`;
alter table `gen_table_column` add column `size` varchar(20) comment "字段长度" after `default_val`;


INSERT INTO `sys_dict_type` (`dict_id`, `tenant_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
                     VALUES (114, '000000', '后端代码类型', 'gen_be_type', 100, 1, '2025-09-28 15:18:28', 1, '2025-09-28 15:18:28', '生成的后端代码类型，例如：java,golang');
INSERT INTO `sys_dict_type` (`dict_id`, `tenant_id`, `dict_name`, `dict_type`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
                     VALUES (115, '000000', '前端模版名称', 'gen_fe_type', 100, 1, '2025-09-28 15:20:47', 1, '2025-09-28 15:20:47', '要生成的前端模版目录名称');


INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
                     VALUES (144, '000000', 2, 'Golang', 'golang', 'gen_be_type', '', 'default', 'N', 100, 1, '2025-09-28 15:19:15', 1, '2025-09-28 15:19:15', 'golang语言');
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
                     VALUES (145, '000000', 1, 'Java', 'java', 'gen_be_type', '', 'default', 'N', 100, 1, '2025-09-28 15:19:38', 1, '2025-09-28 15:19:38', 'Java语言');
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
                     VALUES (146, '000000', 0, '默认', 'default', 'gen_fe_type', '', 'default', 'N', 100, 1, '2025-09-28 15:21:38', 1, '2025-09-28 15:21:38', '默认模版');
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
                     VALUES (147, '000000', 2, 'Soybean Naive UI', 'soy-naive', 'gen_fe_type', '', 'default', 'N', 100, 1, '2025-09-28 15:22:36', 1, '2025-09-28 15:22:36', 'Soybean Naive UI');
INSERT INTO `sys_dict_data` (`dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark`)
                     VALUES (148, '000000', 1, 'Soybean Antd', 'soy-antd', 'gen_fe_type', '', 'default', 'N', 100, 1, '2025-09-28 15:25:06', 1, '2025-09-28 15:25:06', 'Soybean Ant Design Vue');


