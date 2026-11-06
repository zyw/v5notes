package xin.v5ai.basics.file.core.client;

import lombok.Builder;
import lombok.Data;

/**
 * 文件上传结果（本地化替代旧 common-oss 的 UploadResult）。
 *
 * @author ZYW
 */
@Data
@Builder
public class FileUploadResult {

    /**
     * 文件访问 URL
     */
    private String url;

    /**
     * 文件相对路径
     */
    private String path;
}
