package org.dromara.generator.domain.bo;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 导入表业务对象 gen_table
 *
 * @author zyw
 */
@Data
public class ImportTableBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 表名称多个用逗号分隔
     */
    @NotBlank(message = "表名称不能为空")
    private String tableNames;
    /**
     * 数据源名称
     */
    @NotBlank(message = "数据源名称不能为空")
    private String dataName;
     /**
      * 后端类型
      */
    @NotBlank(message = "后端类型不能为空")
    private String beType;
    /**
     * 前端类型
     */
    @NotBlank(message = "前端类型不能为空")
    private String feType;
    /**
     * 包名
     */
    private String packageName;
    /**
     * 模块名
     */
    private String moduleName;
}
