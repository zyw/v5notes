package xin.v5ai.notes.domain;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 回收站要处理的笔记或目录行。parentId 对笔记是 dir_id，对目录是 pid。
 */
@Data
public class NoteTrashSubject implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private Long userId;

    private String name;

    private Long parentId;

    private String delFlag;
}
