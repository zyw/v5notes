package xin.v5ai.basics.file.core.client.ftp;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import xin.v5ai.basics.file.core.client.FileClientConfig;
import org.hibernate.validator.constraints.URL;

/**
 * FTP 文件客户端的配置类
 *
 * @author 芋道源码
 */
@Data
public class FTPFileClientConfig implements FileClientConfig {

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

    /**
     * 主机地址
     */
    @NotEmpty(message = "{file.host.not.blank}")
    private String host;

    /**
     * 主机端口
     */
    @NotNull(message = "{file.port.not.null}")
    private Integer port;

    /**
     * 用户名
     */
    @NotEmpty(message = "{file.username.not.blank}")
    private String username;

    /**
     * 密码
     */
    @NotEmpty(message = "{file.password.not.blank}")
    private String password;

    /**
     * 连接模式
     *
     * 使用 {@link  cn.hutool.extra.ftp.FtpMode} 对应的字符串
     */
    @NotEmpty(message = "{file.mode.not.blank}")
    private String mode;

}
