package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 恢复版本后的最新正文。
 */
@Data
public class NoteRestoreVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String content;

    private String contentHash;

    private LocalDateTime updateTime;
}
