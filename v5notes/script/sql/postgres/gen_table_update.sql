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
