package xin.v5ai.notes.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import xin.v5ai.common.mybatis.core.domain.BaseEntity;
import xin.v5ai.notes.domain.NoteNotes;

import java.util.HashMap;
import java.util.Map;

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

    /**
     * 搜索值（按笔记名/内容模糊匹配）
     */
    private String searchValue;

    /**
     * 请求参数（6.1.0 的 BaseEntity 不再提供 params，按需在 BO 中声明；用于 beginTime/endTime 查询）
     */
    private Map<String, Object> params = new HashMap<>();
}
