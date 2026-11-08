package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 历史列表中的一条版本，不含全文。
 */
@Data
public class NoteRevisionItemVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private Long noteId;

    private String contentHash;

    private String excerpt;

    private Integer size;

    private LocalDateTime createTime;

    /**
     * 仅第一页第一条，且哈希等于笔记当前正文时为 true。
     */
    private boolean head;
}
