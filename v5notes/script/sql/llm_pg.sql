DROP TABLE IF EXISTS llm_model_suppliers;
CREATE TABLE llm_model_suppliers(
    id bigint(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(150) NOT NULL DEFAULT  "",
    base_url VARCHAR(150) NOT NULL,
    api_key VARCHAR(100) NOT NULL DEFAULT  "",
    api_version VARCHAR(10),
    active_duration VARCHAR(20) DEFAULT  5,
    tenant_id VARCHAR(32) DEFAULT "000000",
    status char(1) NOT NULL DEFAULT  0,
    del_flag char(1) NOT NULL DEFAULT  0,
    create_dept bigint,
    create_by bigint(32),
    create_time TIMESTAMP,
    update_by bigint(32),
    update_time TIMESTAMP,
    PRIMARY KEY (id)
);

COMMENT ON TABLE llm_model_suppliers IS '模型供应商';
COMMENT ON COLUMN llm_model_suppliers.id IS '编号';
COMMENT ON COLUMN llm_model_suppliers.name IS '供应商名称，如：deepseek,通义千问';
COMMENT ON COLUMN llm_model_suppliers.icon IS 'LLM供应商图标URL';
COMMENT ON COLUMN llm_model_suppliers.base_url IS 'API基础URL，如：https://api.openai.com';
COMMENT ON COLUMN llm_model_suppliers.api_key IS 'API密钥';
COMMENT ON COLUMN llm_model_suppliers.api_version IS 'API版本，目前：Azure OpenAI Service Model使用';
COMMENT ON COLUMN llm_model_suppliers.active_duration IS '单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）';
COMMENT ON COLUMN llm_model_suppliers.tenant_id IS '租户号';
COMMENT ON COLUMN llm_model_suppliers.status IS '状态:0正常,1停用';
COMMENT ON COLUMN llm_model_suppliers.del_flag IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN llm_model_suppliers.create_dept IS '创建部门';
COMMENT ON COLUMN llm_model_suppliers.create_by IS '创建人';
COMMENT ON COLUMN llm_model_suppliers.create_time IS '创建时间';
COMMENT ON COLUMN llm_model_suppliers.update_by IS '更新人';
COMMENT ON COLUMN llm_model_suppliers.update_time IS '更新时间';

DROP TABLE IF EXISTS llm_models;
CREATE TABLE llm_models(
   id bigint(32) NOT NULL,
   supplier_id bigint(32) NOT NULL,
   model_id VARCHAR(50) NOT NULL,
   name VARCHAR(50),
   type INTEGER(2) DEFAULT  1,
   context_len INTEGER DEFAULT  0,
   max_token INTEGER DEFAULT  0,
   function_calling INTEGER(1) DEFAULT  0,
   stream_function_calling VARCHAR(1) DEFAULT  0,
   vision VARCHAR(1) DEFAULT  0,
   tenant_id VARCHAR(32) DEFAULT "000000",
   status char(1) NOT NULL DEFAULT  0,
   del_flag char(1) NOT NULL DEFAULT  0,
   create_dept bigint,
   create_by bigint(32),
   create_time TIMESTAMP,
   update_by bigint(32),
   update_time TIMESTAMP,
   PRIMARY KEY (id)
);

COMMENT ON TABLE llm_models IS '模型表';
COMMENT ON COLUMN llm_models.id IS '编号';
COMMENT ON COLUMN llm_models.supplier_id IS '供应商ID，所属供应商';
COMMENT ON COLUMN llm_models.model_id IS '模型ID';
COMMENT ON COLUMN llm_models.name IS '模型展示名称';
COMMENT ON COLUMN llm_models.type IS '模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation';
COMMENT ON COLUMN llm_models.context_len IS '模型上下文长度';
COMMENT ON COLUMN llm_models.max_token IS '最大token';
COMMENT ON COLUMN llm_models.function_calling IS '函数调用方式：0：不支持，1：Function Call，2：Tool Call';
COMMENT ON COLUMN llm_models.stream_function_calling IS '流式函数调用：0：不支持，1：支持';
COMMENT ON COLUMN llm_models.vision IS '是否视觉支持：0：不支持，1：支持';
COMMENT ON COLUMN llm_models.tenant_id IS '租户号';
COMMENT ON COLUMN llm_models.status IS '状态:0正常,1停用';
COMMENT ON COLUMN llm_models.del_flag IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN llm_models.create_dept IS '创建部门';
COMMENT ON COLUMN llm_models.create_by IS '创建人';
COMMENT ON COLUMN llm_models.create_time IS '创建时间';
COMMENT ON COLUMN llm_models.update_by IS '更新人';
COMMENT ON COLUMN llm_models.update_time IS '更新时间';
