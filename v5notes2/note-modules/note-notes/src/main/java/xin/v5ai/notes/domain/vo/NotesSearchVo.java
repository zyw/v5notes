package xin.v5ai.notes.domain.vo;

import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;

/**
 * 笔记查询对象 NotesSearchVo
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Data
@ExcelIgnoreUnannotated
@EqualsAndHashCode(callSuper = true)
public class NotesSearchVo extends NewNotesVo {

    @Serial
    private static final long serialVersionUID = 1L;
    /**
     * 内容
     */
    @ExcelProperty(value = "文本内容")
    private String content;
}
