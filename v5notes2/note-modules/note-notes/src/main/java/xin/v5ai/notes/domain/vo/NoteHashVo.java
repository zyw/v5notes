package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 保存成功后返回的正文哈希。
 */
@Data
public class NoteHashVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private String contentHash;
}
