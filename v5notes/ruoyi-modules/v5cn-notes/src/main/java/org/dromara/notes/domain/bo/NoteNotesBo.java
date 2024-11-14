package org.dromara.notes.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.dromara.notes.domain.NoteNotes;

import java.util.Date;

/**
 * 笔记业务对象 note_notes
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Data
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = NoteNotes.class, reverseConvertGenerate = false)
public class NoteNotesBo extends BaseEntity {

    /**
     * 笔记ID编号
     */
    @NotNull(message = "笔记ID编号不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 笔记名
     */
    @NotBlank(message = "笔记名不能为空", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 所属目录ID
     */
    @NotNull(message = "所属目录ID不能为空", groups = { AddGroup.class, EditGroup.class })
    private Long dirId;

    /**
     * 笔记内容
     */
    private String content;
}
