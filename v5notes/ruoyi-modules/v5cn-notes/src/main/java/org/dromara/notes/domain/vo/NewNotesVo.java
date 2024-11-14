package org.dromara.notes.domain.vo;

import com.alibaba.excel.annotation.ExcelIgnoreUnannotated;
import com.alibaba.excel.annotation.ExcelProperty;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

@Data
@ExcelIgnoreUnannotated
public class NewNotesVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 笔记ID编号
     */
    @ExcelProperty(value = "笔记ID编号")
    private Long id;

    /**
     * 所属目录ID
     */
    @ExcelProperty(value = "所属目录ID")
    private Long dirId;

    /**
     * 笔记名
     */
    @ExcelProperty(value = "笔记名")
    private String name;
}
