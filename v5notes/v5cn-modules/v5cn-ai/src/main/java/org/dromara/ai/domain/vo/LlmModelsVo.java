package org.dromara.ai.domain.vo;

import com.alibaba.excel.annotation.ExcelIgnoreUnannotated;
import com.alibaba.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import org.dromara.ai.domain.LlmModels;

import java.io.Serial;
import java.io.Serializable;



/**
 * 模型视图对象 llm_models
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = LlmModels.class)
public class LlmModelsVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 编号
     */
    @ExcelProperty(value = "编号")
    private Long id;

    /**
     * 供应商ID，所属供应商
     */
    @ExcelProperty(value = "供应商ID，所属供应商")
    private Long supplierId;

    /**
     * 模型ID
     */
    @ExcelProperty(value = "模型ID")
    private String modelId;

    /**
     * 模型展示名称
     */
    @ExcelProperty(value = "模型展示名称")
    private String name;

    /**
     * 模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation
     */
    @ExcelProperty(value = "模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation")
    private Long type;

    /**
     * 模型上下文长度
     */
    @ExcelProperty(value = "模型上下文长度")
    private Long contextLen;

    /**
     * 最大token
     */
    @ExcelProperty(value = "最大token")
    private Long maxToken;

    /**
     * 函数调用方式：0：不支持，1：Function Call，2：Tool Call
     */
    @ExcelProperty(value = "函数调用方式：0：不支持，1：Function Call，2：Tool Call")
    private Long functionCalling;

    /**
     * 流式函数调用：0：不支持，1：支持
     */
    @ExcelProperty(value = "流式函数调用：0：不支持，1：支持")
    private String streamFunctionCalling;

    /**
     * 是否视觉支持：0：不支持，1：支持
     */
    @ExcelProperty(value = "是否视觉支持：0：不支持，1：支持")
    private String vision;

    /**
     * 状态:0正常,1停用
     */
    @ExcelProperty(value = "状态:0正常,1停用")
    private String status;


}
