package xin.v5ai.notes.domain.vo;

import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import xin.v5ai.notes.domain.NoteRevision;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 版本行的映射载体。列表查询不会选择 content。
 */
@Data
@AutoMapper(target = NoteRevision.class)
public class NoteRevisionVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private Long noteId;

    private String contentHash;

    private String content;

    private String excerpt;

    private Integer size;

    private LocalDateTime createTime;
}
