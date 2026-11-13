package xin.v5ai.basics.file.domain.bo;

import xin.v5ai.common.mybatis.core.domain.BaseEntity;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
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
public class FileConfigBo extends BaseEntity {

    /**
     * 编号
     */
    @NotNull(message = "{file.config.id.not.null}", groups = { EditGroup.class })
    private Long id;

    /**
     * 配置名
     */
    @NotBlank(message = "{file.config.name.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 存储器
     */
    @NotNull(message = "{file.config.storage.not.null}", groups = { AddGroup.class, EditGroup.class })
    private Integer storage;

    /**
     * 备注
     */
    @NotBlank(message = "{file.config.remark.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String remark;

    /**
     * 存储配置
     */
    @NotNull(message = "{file.config.body.not.null}", groups = { AddGroup.class, EditGroup.class })
    private Map<String, Object> config;


}
