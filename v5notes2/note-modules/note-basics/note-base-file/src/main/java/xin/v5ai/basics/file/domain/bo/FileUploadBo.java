package xin.v5ai.basics.file.domain.bo;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import xin.v5ai.common.log.annotation.Log;
import org.springframework.web.multipart.MultipartFile;

/**
 * @author ZYW-PC
 */
@Schema(description = "管理后台 - 上传文件 Request VO")
@Data
public class FileUploadBo {

    @Schema(description = "文件附件", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "{file.upload.not.null}")
    private MultipartFile file;

    @Schema(description = "文件附件", example = "v5cn.png")
    private String path;
}
