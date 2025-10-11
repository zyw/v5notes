package org.dromara.generator.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.mybatis.core.domain.BaseEntity;
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
     * 模版类型
     */
    @NotBlank(message = "模版类型不能为空", groups = { AddGroup.class, EditGroup.class })
    private String tpType;

    /**
     * 模版类别(前端用于区分页面是CRUD还是tree形布局，sql用于区分mysql,pgsql等)
     */
    private String tpCategory;

    /**
     * 模版名称
     */
    @NotBlank(message = "模版名称不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 生成文件路径（包括名称文件后缀），支持模板语法
     */
    @NotBlank(message = "文件路径不能为空", groups = { AddGroup.class, EditGroup.class })
    private String filePath;

    /**
     * 状态:0正常,1停用
     */
    @NotBlank(message = "状态:0正常,1停用不能为空", groups = { AddGroup.class, EditGroup.class })
    private String status;


}
