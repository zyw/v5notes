package xin.v5ai.basics.file.core.client.local;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import xin.v5ai.basics.file.core.client.FileClientConfig;
import org.hibernate.validator.constraints.URL;

import java.io.Serializable;

/**
 * 本地存储文件配置类
 * @author ZYW
 */
@Data
public class LocalFileClientConfig implements FileClientConfig, Serializable {

    /**
     * 基础路径
     */
    @NotEmpty(message = "{file.base.path.not.blank}")
    private String basePath;

    /**
     * 自定义域名
     */
    @NotEmpty(message = "{file.domain.not.blank}")
    @URL(message = "{file.domain.invalid}")
    private String domain;
}
