package org.dromara.ai.domain;

import org.dromara.common.tenant.core.TenantEntity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;

/**
 * 模型供应商对象 llm_model_suppliers
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("llm_model_suppliers")
public class LlmModelSuppliers extends TenantEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 编号
     */
    @TableId(value = "id")
    private Long id;

    /**
     * 供应商名称，如：deepseek,通义千问
     */
    private String name;

    /**
     * LLM供应商图标URL
     */
    private String icon;

    /**
     * API基础URL，如：https://api.openai.com
     */
    private String baseUrl;

    /**
     * API密钥
     */
    private String apiKey;

    /**
     * API版本，目前：Azure OpenAI Service Model使用
     */
    private String apiVersion;

    /**
     * 单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）
     */
    private String activeDuration;

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
