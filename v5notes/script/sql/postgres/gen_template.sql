DROP TABLE IF EXISTS gen_template;
CREATE TABLE gen_template(
     id INT8 NOT NULL,
     tenant_id VARCHAR(20) NOT NULL,
     be_type VARCHAR(20) NOT NULL,
     fe_type VARCHAR(20) NOT NULL,
     name VARCHAR(50) NOT NULL,
     content TEXT,
     file_name VARCHAR(100) NOT NULL,
     file_path VARCHAR(200),
     status CHAR(1) NOT NULL DEFAULT 0,
     del_flag CHAR(1) NOT NULL DEFAULT 0,
     create_by VARCHAR(64),
     create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     update_by VARCHAR(64),
     update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (id)
);
COMMENT ON COLUMN gen_template.id IS 'ID';
COMMENT ON COLUMN gen_template.tenant_id IS '租户ID';
COMMENT ON COLUMN gen_template.be_type IS '后端模版类型';
COMMENT ON COLUMN gen_template.fe_type IS '前端模版类型';
COMMENT ON COLUMN gen_template.name IS '模版名称';
COMMENT ON COLUMN gen_template.content IS '模版内容';
COMMENT ON COLUMN gen_template.file_name IS '模版名称，需要包含生成文件的扩展名';
COMMENT ON COLUMN gen_template.file_path IS '生成文件路径，如果为空生成文件在压缩包的跟目录下';
COMMENT ON COLUMN gen_template.status IS '状态:0正常,1停用';
COMMENT ON COLUMN gen_template.del_flag IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN gen_template.create_by IS '创建者';
COMMENT ON COLUMN gen_template.create_time IS '创建时间';
COMMENT ON COLUMN gen_template.update_by IS '更新者';
COMMENT ON COLUMN gen_template.update_time IS '更新时间';
COMMENT ON TABLE gen_template IS 'gen_template;代码模版表';
