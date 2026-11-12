package xin.v5ai.notes.domain.vo;

import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import xin.v5ai.common.translation.annotation.Translation;
import xin.v5ai.common.translation.constant.TransConstant;
import xin.v5ai.notes.domain.NoteDirectory;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;



/**
 * 目录视图对象 note_directory
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = NoteDirectory.class)
public class NoteDirectoryVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * ID
     */
    @ExcelProperty(value = "ID")
    private Long id;

    /**
     * 目录所属用户ID
     */
    @ExcelProperty(value = "目录所属用户ID")
    private Long userId;

    /**
     * 所属用户账号
     */
    @ExcelProperty(value = "所属账号")
    @Translation(type = TransConstant.USER_ID_TO_NAME, mapper = "userId")
    private String userName;

    /**
     * 目录名称
     */
    @ExcelProperty(value = "目录名称")
    private String name;

    /**
     * 父目录ID
     */
    @ExcelProperty(value = "父目录ID")
    private Long pid;

    /**
     * 描述
     */
    @ExcelProperty(value = "描述")
    private String descr;

    /**
     * 创建时间
     */
    @ExcelProperty(value = "创建时间")
    private Date createTime;
}
