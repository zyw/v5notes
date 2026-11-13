package xin.v5ai.basics.file.domain.vo;

import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import lombok.Data;
import xin.v5ai.basics.file.core.client.FileClientConfig;

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
