package org.dromara.basics.file.domain.bo;

import org.dromara.basics.file.domain.FileInfo;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
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
    @NotNull(message = "文件编号不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 配置编号
     */
    @NotNull(message = "配置编号不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long configId;

    /**
     * 文件名
     */
    @NotBlank(message = "文件名不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 文件路径
     */
    @NotBlank(message = "文件路径不能为空", groups = { AddGroup.class, EditGroup.class })
    private String path;

    /**
     * 文件 URL
     */
    @NotBlank(message = "文件 URL不能为空", groups = { AddGroup.class, EditGroup.class })
    private String url;

    /**
     * 文件类型
     */
    @NotBlank(message = "文件类型不能为空", groups = { AddGroup.class, EditGroup.class })
    private String type;

    /**
     * 文件大小
     */
    @NotNull(message = "文件大小不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long size;


}
