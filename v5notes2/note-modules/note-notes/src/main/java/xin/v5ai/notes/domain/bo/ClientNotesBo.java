package xin.v5ai.notes.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import xin.v5ai.common.core.validate.QueryGroup;
import xin.v5ai.common.core.validate.SearchGroup;

import java.io.Serial;
import java.io.Serializable;

/**
 * 客户端查询笔记
 */
@Data
public class ClientNotesBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 目录ID，0：全部笔记，1: 最新笔记，其他表示正常的目录ID
     */
    @NotNull(message = "{note.client.dir.not.null}", groups = { QueryGroup.class })
    private Long dirId;

    /**
     * 搜索值
     */
    @NotBlank(message = "{note.search.not.blank}", groups = { SearchGroup.class })
    private String searchValue;
}
