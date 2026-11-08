package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 回收站列表中的一条删除记录。
 */
@Data
public class NoteTrashItemVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private String objectType;

    private Long objectId;

    private String name;

    private String originalPath;

    private Integer noteCount;

    private Integer dirCount;

    private LocalDateTime deletedTime;

    private LocalDateTime expireTime;

    private Integer daysLeft;
}
