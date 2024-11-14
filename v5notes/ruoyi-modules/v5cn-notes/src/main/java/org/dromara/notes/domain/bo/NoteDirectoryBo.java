package org.dromara.notes.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.notes.domain.NoteDirectory;

import java.util.Date;

/**
 * 目录业务对象 note_directory
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = NoteDirectory.class, reverseConvertGenerate = false)
public class NoteDirectoryBo extends BaseEntity {

    /**
     * ID
     */
    @NotNull(message = "ID不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 目录名称
     */
    @NotBlank(message = "目录名称不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 父目录ID
     */
    @NotNull(message = "父目录ID不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long pid;

    /**
     * 描述
     */
    private String descr;
}
