package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 正文保存冲突时带回库中的当前哈希。
 */
@Data
public class NoteConflictVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String contentHash;

    private LocalDateTime updateTime;
}
