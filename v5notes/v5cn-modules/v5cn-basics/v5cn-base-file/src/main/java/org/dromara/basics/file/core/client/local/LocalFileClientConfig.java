package org.dromara.basics.file.core.client.local;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import org.dromara.basics.file.core.client.FileClientConfig;
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
    @NotEmpty(message = "基础路径不能为空")
    private String basePath;

    /**
     * 自定义域名
     */
    @NotEmpty(message = "domain 不能为空")
    @URL(message = "domain 必须是 URL 格式")
    private String domain;
}
