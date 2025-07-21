package org.dromara.ai.domain.bo;

import org.dromara.ai.domain.LlmModelSuppliers;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import jakarta.validation.constraints.*;

/**
 * 模型供应商业务对象 llm_model_suppliers
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = LlmModelSuppliers.class, reverseConvertGenerate = false)
public class LlmModelSuppliersBo extends BaseEntity {

    /**
     * 编号
     */
    @NotNull(message = "编号不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 供应商名称，如：deepseek,通义千问
     */
    @NotBlank(message = "供应商名称，如：deepseek,通义千问不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * LLM供应商图标URL
     */
    @NotBlank(message = "LLM供应商图标URL不能为空", groups = { AddGroup.class, EditGroup.class })
    private String icon;

    /**
     * API基础URL，如：https://api.openai.com
     */
    @NotBlank(message = "API基础URL，如：https://api.openai.com不能为空", groups = { AddGroup.class, EditGroup.class })
    private String baseUrl;

    /**
     * API密钥
     */
    @NotBlank(message = "API密钥不能为空", groups = { AddGroup.class, EditGroup.class })
    private String apiKey;

    /**
     * API版本，目前：Azure OpenAI Service Model使用
     */
    @NotBlank(message = "API版本，目前：Azure OpenAI Service Model使用不能为空", groups = { AddGroup.class, EditGroup.class })
    private String apiVersion;

    /**
     * 单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）
     */
    @NotBlank(message = "单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）不能为空", groups = { AddGroup.class, EditGroup.class })
    private String activeDuration;

    /**
     * 状态:0正常,1停用
     */
    @NotBlank(message = "状态:0正常,1停用不能为空", groups = { AddGroup.class, EditGroup.class })
    private String status;


}
