package org.dromara.generator.domain.bo;

import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import jakarta.validation.constraints.*;
import org.dromara.generator.domain.GenTemplate;

/**
 * gen_template;代码模版业务对象 gen_template
 *
 * @author zyw
 * @date 2025-10-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = GenTemplate.class, reverseConvertGenerate = false)
public class GenTemplateBo extends BaseEntity {

    /**
     * ID
     */
    @NotNull(message = "ID不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 后端模版类型
     */
    @NotBlank(message = "后端模版类型不能为空", groups = { AddGroup.class, EditGroup.class })
    private String beType;

    /**
     * 前端模版类型
     */
    @NotBlank(message = "前端模版类型不能为空", groups = { AddGroup.class, EditGroup.class })
    private String feType;

    /**
     * 模版名称
     */
    @NotBlank(message = "模版名称不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 模版名称，需要包含生成文件的扩展名
     */
    @NotBlank(message = "模版名称，需要包含生成文件的扩展名不能为空", groups = { AddGroup.class, EditGroup.class })
    private String fileName;

    /**
     * 生成文件路径，如果为空生成文件在压缩包的跟目录下
     */
    private String filePath;

    /**
     * 状态:0正常,1停用
     */
    @NotBlank(message = "状态:0正常,1停用不能为空", groups = { AddGroup.class, EditGroup.class })
    private String status;


}
