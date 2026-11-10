package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 清空回收站的结果。failed 是未能清除的条数。
 */
@Data
public class NoteTrashEmptyVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Integer failed;
}
