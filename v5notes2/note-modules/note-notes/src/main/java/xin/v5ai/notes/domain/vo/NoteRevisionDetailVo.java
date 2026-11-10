package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 单个版本的全文。
 */
@Data
public class NoteRevisionDetailVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private Long noteId;

    private String content;

    private String contentHash;

    private String excerpt;

    private Integer size;

    private LocalDateTime createTime;
}
