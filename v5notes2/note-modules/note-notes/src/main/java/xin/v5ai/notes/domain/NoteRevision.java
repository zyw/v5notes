package xin.v5ai.notes.domain;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 笔记正文快照。行只追加，不更新，也不做逻辑删除。
 */
@Data
@TableName("note_revision")
public class NoteRevision implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "id")
    private Long id;

    private Long noteId;

    private Long userId;

    private String contentHash;

    private String content;

    private String excerpt;

    private Integer size;

    @TableField(fill = FieldFill.INSERT)
    private Long createDept;

    @TableField(fill = FieldFill.INSERT)
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
