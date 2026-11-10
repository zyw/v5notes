package xin.v5ai.notes.domain.vo;

import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
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
