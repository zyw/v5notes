package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 整条回收站记录恢复后的位置。
 */
@Data
public class NoteTrashRestoreVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String objectType;

    private Long objectId;

    private Long parentId;

    private Boolean relocated;
}
