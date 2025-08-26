package org.dromara.ai.domain.bo;

import org.dromara.ai.domain.LlmModels;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import jakarta.validation.constraints.*;

/**
 * 模型业务对象 llm_models
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = LlmModels.class, reverseConvertGenerate = false)
public class LlmModelsBo extends BaseEntity {

    /**
     * 编号
     */
    @NotNull(message = "编号不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 供应商ID，所属供应商
     */
    @NotNull(message = "供应商ID，所属供应商不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long supplierId;

    /**
     * 模型ID
     */
    @NotBlank(message = "模型ID不能为空", groups = { AddGroup.class, EditGroup.class })
    private String modelId;

    /**
     * 模型展示名称
     */
    @NotBlank(message = "模型展示名称不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation
     */
    @NotNull(message = "模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long type;

    /**
     * 模型上下文长度
     */
    @NotNull(message = "模型上下文长度不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long contextLen;

    /**
     * 最大token
     */
    @NotNull(message = "最大token不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long maxToken;

    /**
     * 函数调用方式：0：不支持，1：Function Call，2：Tool Call
     */
    @NotNull(message = "函数调用方式：0：不支持，1：Function Call，2：Tool Call不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long functionCalling;

    /**
     * 流式函数调用：0：不支持，1：支持
     */
    @NotBlank(message = "流式函数调用：0：不支持，1：支持不能为空", groups = { AddGroup.class, EditGroup.class })
    private String streamFunctionCalling;

    /**
     * 是否视觉支持：0：不支持，1：支持
     */
    @NotBlank(message = "是否视觉支持：0：不支持，1：支持不能为空", groups = { AddGroup.class, EditGroup.class })
    private String vision;

    /**
     * 状态:0正常,1停用
     */
    @NotBlank(message = "状态:0正常,1停用不能为空", groups = { AddGroup.class, EditGroup.class })
    private String status;


}
