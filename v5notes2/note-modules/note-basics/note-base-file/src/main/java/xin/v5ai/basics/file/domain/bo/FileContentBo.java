package xin.v5ai.basics.file.domain.bo;

import xin.v5ai.basics.file.domain.FileContent;
import xin.v5ai.common.mybatis.core.domain.BaseEntity;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import jakarta.validation.constraints.*;

/**
 * 文件内容业务对象 infra_file_content
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = FileContent.class, reverseConvertGenerate = false)
public class FileContentBo extends BaseEntity {

    /**
     * 编号
     */
    @NotNull(message = "{file.config.id.not.null}", groups = { EditGroup.class })
    private Long id;

    /**
     * 配置编号
     */
    @NotNull(message = "{file.content.config.not.null}", groups = { AddGroup.class, EditGroup.class })
    private Long configId;

    /**
     * 文件路径
     */
    @NotBlank(message = "{file.path.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String path;
}
