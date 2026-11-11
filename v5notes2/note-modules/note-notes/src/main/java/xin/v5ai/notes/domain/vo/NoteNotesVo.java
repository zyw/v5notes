package xin.v5ai.notes.domain.vo;

import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import lombok.EqualsAndHashCode;
import xin.v5ai.common.translation.annotation.Translation;
import xin.v5ai.common.translation.constant.TransConstant;
import xin.v5ai.notes.domain.NoteNotes;

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
     * 所属用户账号
     */
    @ExcelProperty(value = "所属账号")
    @Translation(type = TransConstant.USER_ID_TO_NAME, mapper = "userId")
    private String userName;

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
