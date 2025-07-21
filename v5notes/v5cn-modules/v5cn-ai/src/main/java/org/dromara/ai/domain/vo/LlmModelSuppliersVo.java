package org.dromara.ai.domain.vo;

import com.alibaba.excel.annotation.ExcelIgnoreUnannotated;
import com.alibaba.excel.annotation.ExcelProperty;
import org.dromara.ai.domain.LlmModelSuppliers;
import org.dromara.common.excel.annotation.ExcelDictFormat;
import org.dromara.common.excel.convert.ExcelDictConvert;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;



/**
 * 模型供应商视图对象 llm_model_suppliers
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = LlmModelSuppliers.class)
public class LlmModelSuppliersVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 编号
     */
    @ExcelProperty(value = "编号")
    private Long id;

    /**
     * 供应商名称，如：deepseek,通义千问
     */
    @ExcelProperty(value = "供应商名称，如：deepseek,通义千问")
    private String name;

    /**
     * LLM供应商图标URL
     */
    @ExcelProperty(value = "LLM供应商图标URL")
    private String icon;

    /**
     * API基础URL，如：https://api.openai.com
     */
    @ExcelProperty(value = "API基础URL，如：https://api.openai.com")
    private String baseUrl;

    /**
     * API密钥
     */
    @ExcelProperty(value = "API密钥")
    private String apiKey;

    /**
     * API版本，目前：Azure OpenAI Service Model使用
     */
    @ExcelProperty(value = "API版本，目前：Azure OpenAI Service Model使用")
    private String apiVersion;

    /**
     * 单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）
     */
    @ExcelProperty(value = "单位：分钟；Ollama对话后模型在内存中保持的时间", converter = ExcelDictConvert.class)
    @ExcelDictFormat(readConverterExp = "默=认：5分钟")
    private String activeDuration;

    /**
     * 状态:0正常,1停用
     */
    @ExcelProperty(value = "状态:0正常,1停用")
    private String status;


}
