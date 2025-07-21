DROP TABLE IF EXISTS llm_model_suppliers;
CREATE TABLE llm_model_suppliers(
    `id` bigint(32) NOT NULL  COMMENT '编号' ,
    `name` VARCHAR(100) NOT NULL  COMMENT '供应商名称，如：deepseek,通义千问' ,
    `icon` VARCHAR(150) NOT NULL DEFAULT "" COMMENT 'LLM供应商图标URL' ,
    `base_url` VARCHAR(150) NOT NULL  COMMENT 'API基础URL，如：https://api.openai.com' ,
    `api_key` VARCHAR(100) NOT NULL DEFAULT "" COMMENT 'API密钥' ,
    `api_version` VARCHAR(10)   COMMENT 'API版本，目前：Azure OpenAI Service Model使用' ,
    `active_duration` VARCHAR(20)  DEFAULT 5 COMMENT '单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）' ,
    `tenant_id` VARCHAR(32)   COMMENT '租户号' ,
    `status` char(1) NOT NULL DEFAULT 0 COMMENT '状态:0正常,1停用' ,
    `del_flag` char(1) NOT NULL DEFAULT 0 COMMENT '删除标志（0代表存在 2代表删除）' ,
    `create_dept` bigint   COMMENT '创建部门' ,
    `create_by` bigint(32)   COMMENT '创建人' ,
    `create_time` DATETIME   COMMENT '创建时间' ,
    `update_by` bigint(32)   COMMENT '更新人' ,
    `update_time` DATETIME   COMMENT '更新时间' ,
    PRIMARY KEY (id)
) ENGINE=InnoDB COMMENT = '模型供应商';

DROP TABLE IF EXISTS llm_models;
CREATE TABLE llm_models(
   `id` bigint(32) NOT NULL  COMMENT '编号' ,
   `supplier_id` bigint(32) NOT NULL  COMMENT '供应商ID，所属供应商' ,
   `model_id` VARCHAR(50) NOT NULL  COMMENT '模型ID' ,
   `name` VARCHAR(50)   COMMENT '模型展示名称' ,
   `type` INT(2)  DEFAULT 1 COMMENT '模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation' ,
   `context_len` INT  DEFAULT 0 COMMENT '模型上下文长度' ,
   `max_token` INT  DEFAULT 0 COMMENT '最大token' ,
   `function_calling` INT(1)  DEFAULT 0 COMMENT '函数调用方式：0：不支持，1：Function Call，2：Tool Call' ,
   `stream_function_calling` VARCHAR(1)  DEFAULT 0 COMMENT '流式函数调用：0：不支持，1：支持' ,
   `vision` VARCHAR(1)  DEFAULT 0 COMMENT '是否视觉支持：0：不支持，1：支持' ,
   `tenant_id` VARCHAR(32)   COMMENT '租户号' ,
   `status` char(1) NOT NULL DEFAULT 0 COMMENT '状态:0正常,1停用' ,
   `del_flag` char(1) NOT NULL DEFAULT 0 COMMENT '删除标志（0代表存在 2代表删除）' ,
   `create_dept` bigint   COMMENT '创建部门' ,
   `create_by` bigint(32)   COMMENT '创建人' ,
   `create_time` DATETIME   COMMENT '创建时间' ,
   `update_by` bigint(32)   COMMENT '更新人' ,
   `update_time` DATETIME   COMMENT '更新时间' ,
   PRIMARY KEY (id)
) ENGINE=InnoDB COMMENT = '模型表';


insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(9, 'AI大模型'  , '0',    '9', 'ai-llm','ai-llm/index',1, 0, 'M', '0', '0', '', 'log', '103', 1, sysdate(), NULL, NULL, 'AI大模型');

insert into sys_menu (menu_id, menu_name, parent_id, order_num, path, component, is_frame, is_cache, menu_type, visible, status, perms, icon, create_dept, create_by, create_time, update_by, update_time, remark)
values(190, '接入模型'  , '9',    '1', 'ai-llm','ai-llm/index',1, 0, 'C', '0', '0', '', 'log', '103', 1, sysdate(), NULL, NULL, '接入模型管理');
