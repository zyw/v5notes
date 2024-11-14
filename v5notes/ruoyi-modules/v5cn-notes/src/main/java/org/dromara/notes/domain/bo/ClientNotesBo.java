package org.dromara.notes.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.dromara.common.core.validate.QueryGroup;
import org.dromara.common.core.validate.SearchGroup;

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
    @NotNull(message = "目录ID不能为空", groups = { QueryGroup.class })
    private Long dirId;

    /**
     * 搜索值
     */
    @NotBlank(message = "搜索值不能为空", groups = { SearchGroup.class })
    private String searchValue;
}
