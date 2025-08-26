package org.dromara.basics.file.domain.bo;

import io.github.linpeilie.annotations.AutoMapping;
import org.dromara.basics.file.domain.FileConfig;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import jakarta.validation.constraints.*;

import java.util.Map;

/**
 * 文件配置业务对象 infra_file_config
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = FileConfig.class, reverseConvertGenerate = false)
public class FileConfigBo extends BaseEntity {

    /**
     * 编号
     */
    @NotNull(message = "编号不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 配置名
     */
    @NotBlank(message = "配置名不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 存储器
     */
    @NotNull(message = "存储器不能为空", groups = { AddGroup.class, EditGroup.class })
    private Integer storage;

    /**
     * 备注
     */
    @NotBlank(message = "备注不能为空", groups = { AddGroup.class, EditGroup.class })
    private String remark;

    /**
     * 存储配置
     */
    @NotNull(message = "存储配置不能为空", groups = { AddGroup.class, EditGroup.class })
    @AutoMapping(target = "config", ignore = true)
    private Map<String, Object> config;


}
