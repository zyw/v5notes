package xin.v5ai.notes.domain.vo;

import lombok.Data;
import xin.v5ai.common.translation.annotation.Translation;
import xin.v5ai.common.translation.constant.TransConstant;

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

    /**
     * 笔记或目录的所属用户。
     */
    private Long userId;

    /**
     * 所属用户账号。
     */
    @Translation(type = TransConstant.USER_ID_TO_NAME, mapper = "userId")
    private String userName;

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
