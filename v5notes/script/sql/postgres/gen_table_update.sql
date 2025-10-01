-- 添加后端模板类型字段
ALTER TABLE gen_table ADD COLUMN be_type VARCHAR(10) DEFAULT 'java' NOT NULL;
COMMENT ON COLUMN gen_table.be_type IS '后端模版类型';

-- 添加前端模板类型字段
ALTER TABLE gen_table ADD COLUMN fe_type VARCHAR(10) DEFAULT 'default' NOT NULL;
COMMENT ON COLUMN gen_table.fe_type IS '前端模版类型';

-- 重命名 java_type 到 field_type
ALTER TABLE gen_table_column RENAME COLUMN java_type TO field_type;

-- 重命名 java_field 到 field_name
ALTER TABLE gen_table_column RENAME COLUMN java_field TO field_name;

-- 修改 field_type 字段类型和注释
ALTER TABLE gen_table_column ALTER COLUMN field_type TYPE VARCHAR(500);
COMMENT ON COLUMN gen_table_column.field_type IS '字段类型';

-- 修改 field_name 字段类型和注释
ALTER TABLE gen_table_column ALTER COLUMN field_name TYPE VARCHAR(200);
COMMENT ON COLUMN gen_table_column.field_name IS '字段名称';

-- 添加默认值字段
ALTER TABLE gen_table_column ADD COLUMN default_val VARCHAR(50);
COMMENT ON COLUMN gen_table_column.default_val IS '默认值';

-- 添加字段长度字段
ALTER TABLE gen_table_column ADD COLUMN size VARCHAR(20);
COMMENT ON COLUMN gen_table_column.size IS '字段长度';


-- 添加后端代码类型字典表
INSERT INTO sys_dict_type (dict_id, tenant_id, dict_name, dict_type, create_dept, create_by, create_time, update_by, update_time, remark)
                   VALUES (114, '000000', '后端代码类型', 'gen_be_type', 100, 1, '2025-09-28 15:18:28', 1, '2025-09-28 15:18:28', '生成的后端代码类型，例如：java,golang');
INSERT INTO sys_dict_type (dict_id, tenant_id, dict_name, dict_type, create_dept, create_by, create_time, update_by, update_time, remark)
                   VALUES (115, '000000', '前端模版名称', 'gen_fe_type', 100, 1, '2025-09-28 15:20:47', 1, '2025-09-28 15:20:47', '要生成的前端模版目录名称');

-- 添加后端代码类型数据
INSERT INTO sys_dict_data (dict_code, tenant_id, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, update_by, update_time, remark)
                   VALUES (144, '000000', 2, 'Golang', 'golang', 'gen_be_type', '', 'default', 'N', 100, 1, '2025-09-28 15:19:15', 1, '2025-09-28 15:19:15', 'golang语言');
INSERT INTO sys_dict_data (dict_code, tenant_id, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, update_by, update_time, remark)
                   VALUES (145, '000000', 1, 'Java', 'java', 'gen_be_type', '', 'default', 'N', 100, 1, '2025-09-28 15:19:38', 1, '2025-09-28 15:19:38', 'Java语言');
INSERT INTO sys_dict_data (dict_code, tenant_id, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, update_by, update_time, remark)
                   VALUES (146, '000000', 0, '默认', 'default', 'gen_fe_type', '', 'default', 'N', 100, 1, '2025-09-28 15:21:38', 1, '2025-09-28 15:21:38', '默认模版');
INSERT INTO sys_dict_data (dict_code, tenant_id, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, update_by, update_time, remark)
                   VALUES (147, '000000', 2, 'Soybean Naive UI', 'soy-naive', 'gen_fe_type', '', 'default', 'N', 100, 1, '2025-09-28 15:22:36', 1, '2025-09-28 15:22:36', 'Soybean Naive UI');
INSERT INTO sys_dict_data (dict_code, tenant_id, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, update_by, update_time, remark)
                   VALUES (148, '000000', 1, 'Soybean Antd', 'soy-antd', 'gen_fe_type', '', 'default', 'N', 100, 1, '2025-09-28 15:25:06', 1, '2025-09-28 15:25:06', 'Soybean Ant Design Vue');
