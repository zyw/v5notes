package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 新建笔记后返回的主键和初始正文哈希。
 */
@Data
public class NoteCreatedVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long id;

    private String contentHash;
}
