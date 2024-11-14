package org.dromara.notes.domain.vo;

import com.alibaba.excel.annotation.ExcelIgnoreUnannotated;
import com.alibaba.excel.annotation.ExcelProperty;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.notes.domain.NoteNotes;

import java.io.Serial;
import java.time.LocalDateTime;

/**
 * 笔记视图对象 NoteNotesVo
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Data
@ExcelIgnoreUnannotated
@EqualsAndHashCode(callSuper = true)
@AutoMapper(target = NoteNotes.class)
public class NoteNotesVo extends NewNotesVo {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 笔记所属用户
     */
    @ExcelProperty(value = "笔记所属用户")
    private Long userId;

    /**
     * 内容
     */
    @JsonIgnore
    private String content;

    /**
     * 修改时间
     */
    @ExcelProperty(value = "修改时间")
    private LocalDateTime updateTime;

    /**
     * 文件大小
     */
    @ExcelProperty(value = "文件大小")
    private String fileSize;
}
