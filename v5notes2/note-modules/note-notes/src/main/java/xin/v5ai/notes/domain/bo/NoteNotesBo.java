package xin.v5ai.notes.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import io.github.linpeilie.annotations.AutoMapping;
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
    @NotNull(message = "{note.id.not.null}", groups = { EditGroup.class })
    private Long id;

    /**
     * 所属用户 ID；查询时精确筛选，新增时可指定归属客户端用户
     */
    private Long userId;

    /**
     * 所属用户账号；仅用于管理端模糊筛选，不入库
     */
    private String userName;

    /**
     * 笔记名
     */
    @NotBlank(message = "{note.name.not.blank}", groups = { AddGroup.class, EditGroup.class })
    private String name;

    /**
     * 所属目录ID
     */
    @NotNull(message = "{note.dir.not.null}", groups = { AddGroup.class, EditGroup.class })
    private Long dirId;

    /**
     * 笔记内容
     */
    private String content;

    /**
     * 服务端回写的正文哈希，不从请求映射到笔记列。
     */
    @AutoMapping(target = "contentHash", ignore = true)
    private String contentHash;

    /**
     * 客户端打开或上次保存时的正文哈希。
     */
    private String baseHash;

    /**
     * 为 true 时忽略哈希不一致，仍先补记库中正文。
     */
    private Boolean force;

    /**
     * 为 true 时只更新正文，不追加历史版本（预览勾选任务等）。
     */
    private Boolean skipHistory;

    /**
     * 搜索值（按笔记名/内容模糊匹配）
     */
    private String searchValue;

    /**
     * 请求参数（6.1.0 的 BaseEntity 不再提供 params，按需在 BO 中声明；用于 beginTime/endTime 查询）
     */
    private Map<String, Object> params = new HashMap<>();
}
