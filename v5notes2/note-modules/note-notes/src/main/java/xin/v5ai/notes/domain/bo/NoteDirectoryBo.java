package xin.v5ai.notes.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import xin.v5ai.common.mybatis.core.domain.BaseEntity;
import xin.v5ai.notes.domain.NoteDirectory;

import java.util.HashMap;
import java.util.Map;

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
    @NotNull(message = "{note.dir.id.not.null}", groups = { EditGroup.class })
    private Long id;

    /**
     * 目录名称
     */
    @NotBlank(message = "{note.dir.name.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 父目录ID
     */
    @NotNull(message = "{note.dir.parent.not.null}", groups = { AddGroup.class, EditGroup.class })
    private Long pid;

    /**
     * 描述
     */
    private String descr;

    /**
     * 请求参数（6.1.0 的 BaseEntity 不再提供 params，按需在 BO 中声明；用于 beginTime/endTime 查询）
     */
    private Map<String, Object> params = new HashMap<>();
}
