package org.dromara.basics.file.domain.bo;

import org.dromara.basics.file.domain.FileContent;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
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
    @NotNull(message = "编号不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 配置编号
     */
    @NotNull(message = "配置编号不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long configId;

    /**
     * 文件路径
     */
    @NotBlank(message = "文件路径不能为空", groups = { AddGroup.class, EditGroup.class })
    private String path;
}
