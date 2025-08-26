package org.dromara.ai.domain;

import org.dromara.common.tenant.core.TenantEntity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;

/**
 * 模型对象 llm_models
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("llm_models")
public class LlmModels extends TenantEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 编号
     */
    @TableId(value = "id")
    private Long id;

    /**
     * 供应商ID，所属供应商
     */
    private Long supplierId;

    /**
     * 模型ID
     */
    private String modelId;

    /**
     * 模型展示名称
     */
    private String name;

    /**
     * 模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation
     */
    private Long type;

    /**
     * 模型上下文长度
     */
    private Long contextLen;

    /**
     * 最大token
     */
    private Long maxToken;

    /**
     * 函数调用方式：0：不支持，1：Function Call，2：Tool Call
     */
    private Long functionCalling;

    /**
     * 流式函数调用：0：不支持，1：支持
     */
    private String streamFunctionCalling;

    /**
     * 是否视觉支持：0：不支持，1：支持
     */
    private String vision;

    /**
     * 状态:0正常,1停用
     */
    private String status;

    /**
     * 删除标志（0代表存在 2代表删除）
     */
    @TableLogic
    private String delFlag;


}
