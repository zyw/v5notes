package xin.v5ai.basics.file.domain.bo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * @author ZYW
 */
@Schema(description = "管理后台 - 文件信息分页 Request VO")
@Data
@EqualsAndHashCode(callSuper = false)
@ToString(callSuper = true)
public class FileInfoSearchBo {

    /**
     * 文件路径
     */
    @Schema(description = "文件路径")
    private String path;

    /**
     * 文件名称
     */
    @Schema(description = "文件名称")
    private String name;
    /**
     * 文件类型
     */
    @Schema(description = "文件类型")
    private String type;

    /**
     * 文件大小
     */
    @Schema(description = "创建时间", example = "[2022-07-01 00:00:00, 2022-07-01 23:59:59]")
    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime[] createTime;
}
