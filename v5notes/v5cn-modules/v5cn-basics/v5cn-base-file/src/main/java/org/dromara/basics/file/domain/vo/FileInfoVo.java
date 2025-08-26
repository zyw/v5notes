package org.dromara.basics.file.domain.vo;

import org.dromara.basics.file.domain.FileInfo;
import com.alibaba.excel.annotation.ExcelIgnoreUnannotated;
import com.alibaba.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;


/**
 * 文件路径视图对象 infra_file
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = FileInfo.class)
public class FileInfoVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 文件编号
     */
    @ExcelProperty(value = "文件编号")
    private Long id;

    /**
     * 配置编号
     */
    @ExcelProperty(value = "配置编号")
    private Long configId;

    /**
     * 文件名
     */
    @ExcelProperty(value = "文件名")
    private String name;

    /**
     * 文件路径
     */
    @ExcelProperty(value = "文件路径")
    private String path;

    /**
     * 文件后缀
     */
    @ExcelProperty(value = "文件后缀")
    private String suffix;

    /**
     * 文件 URL
     */
    @ExcelProperty(value = "文件 URL")
    private String url;

    /**
     * 文件类型
     */
    @ExcelProperty(value = "文件类型")
    private String type;

    /**
     * 文件大小
     */
    @ExcelProperty(value = "文件大小")
    private Long size;

    @ExcelProperty(value = "创建时间")
    private LocalDateTime createTime;

    @ExcelProperty(value = "更新时间")
    private LocalDateTime updateTime;
}
