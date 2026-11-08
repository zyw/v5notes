package xin.v5ai.notes.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 一次删除动作对应的回收站记录。恢复或彻底删除后物理删除，不做逻辑删除。
 */
@Data
@TableName("note_trash")
public class NoteTrash implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "id")
    private Long id;

    /**
     * 笔记或目录的所属用户。
     */
    private Long userId;

    /**
     * 1 笔记，2 目录。
     */
    private String objectType;

    private Long objectId;

    private String name;

    private Long originalParentId;

    private String originalPath;

    private Integer noteCount;

    private Integer dirCount;

    /**
     * 执行删除的人。用户自己删除时等于 userId。
     */
    private Long createBy;

    private LocalDateTime deletedTime;

    private LocalDateTime expireTime;
}
