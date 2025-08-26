package org.dromara.basics.file.domain.vo;

import com.alibaba.excel.annotation.ExcelIgnoreUnannotated;
import com.alibaba.excel.annotation.ExcelProperty;
import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import org.dromara.basics.file.core.client.FileClientConfig;
import org.dromara.basics.file.domain.FileConfig;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;


/**
 * 文件配置视图对象 infra_file_config
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = FileConfig.class)
public class FileConfigVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 编号
     */
    @ExcelProperty(value = "编号")
    private Long id;

    /**
     * 配置名
     */
    @ExcelProperty(value = "配置名")
    private String name;

    /**
     * 存储器
     */
    @ExcelProperty(value = "存储器")
    private Integer storage;

    /**
     * 备注
     */
    @ExcelProperty(value = "备注")
    private String remark;

    /**
     * 是否为主配置
     */
    @ExcelProperty(value = "是否为主配置")
    private Boolean master;

    @ExcelProperty(value = "创建时间")
    private LocalDateTime createTime;

    /**
     * 存储配置
     */
    @ExcelProperty(value = "存储配置")
    private FileClientConfig config;

}
