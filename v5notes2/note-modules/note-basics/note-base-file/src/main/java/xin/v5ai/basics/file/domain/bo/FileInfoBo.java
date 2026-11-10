package xin.v5ai.basics.file.domain.bo;

import xin.v5ai.basics.file.domain.FileInfo;
import xin.v5ai.common.mybatis.core.domain.BaseEntity;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import jakarta.validation.constraints.*;

/**
 * 文件路径业务对象 infra_file
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = FileInfo.class, reverseConvertGenerate = false)
public class FileInfoBo extends BaseEntity {

    /**
     * 文件编号
     */
    @NotNull(message = "{file.info.id.not.null}", groups = { EditGroup.class })
    private Long id;

    /**
     * 配置编号
     */
    @NotNull(message = "{file.content.config.not.null}", groups = { AddGroup.class, EditGroup.class })
    private Long configId;

    /**
     * 文件名
     */
    @NotBlank(message = "{file.name.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 文件路径
     */
    @NotBlank(message = "{file.path.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String path;

    /**
     * 文件 URL
     */
    @NotBlank(message = "{file.url.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String url;

    /**
     * 文件类型
     */
    @NotBlank(message = "{file.type.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String type;

    /**
     * 文件大小
     */
    @NotNull(message = "{file.size.not.null}", groups = { AddGroup.class, EditGroup.class })
    private Long size;


}
