package org.dromara.basics.file.domain.bo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import org.dromara.common.core.utils.DateUtils;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * 查询参数对象封装
 * @author ZYW
 */
@Schema(description = "管理后台 - 文件配置分页 Request VO")
@Data
@EqualsAndHashCode(callSuper = false)
@ToString(callSuper = true)
public class FileConfigSearchBo {
    @Schema(description = "配置名", example = "S3 - 阿里云")
    private String name;

    @Schema(description = "存储器", example = "1")
    private Integer storage;

    @Schema(description = "创建时间", example = "[2022-07-01 00:00:00, 2022-07-01 23:59:59]")
    @DateTimeFormat(pattern = DateUtils.YYYY_MM_DD_HH_MM_SS)
    private LocalDateTime[] createTime;
}
