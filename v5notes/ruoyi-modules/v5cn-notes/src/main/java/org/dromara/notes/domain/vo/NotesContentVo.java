package org.dromara.notes.domain.vo;

import com.alibaba.excel.annotation.ExcelIgnoreUnannotated;
import com.alibaba.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serial;
import java.time.LocalDateTime;

/**
 * 笔记内容视图对象
 *
 * @author chen
 * @date 2023-04-17
 */
@Data
@ExcelIgnoreUnannotated
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = NoteNotesVo.class)
public class NotesContentVo extends NewNotesVo {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 笔记所属用户
     */
    @ExcelProperty(value = "笔记所属用户")
    private Long userId;

    /**
     * 所属目录ID
     */
    @ExcelProperty(value = "所属目录ID")
    private Long dirId;

    /**
     * 内容
     */
    @ExcelProperty(value = "文件内容")
    private String content;

    /**
     * 修改时间
     */
    @ExcelProperty(value = "修改时间")
    private LocalDateTime updateTime;
}
