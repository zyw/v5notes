package xin.v5ai.basics.file.core.client.ftp;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import xin.v5ai.basics.file.core.client.FileClientConfig;
import org.hibernate.validator.constraints.URL;

/**
 * FTP / FTPS 文件客户端的配置类
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

    /**
     * 是否启用 FTPS（FTP over TLS，显式模式 AUTH TLS）。
     * <p>飞牛 NAS 的 ftps://host:21 属于此类，与 SFTP（SSH/22）不是同一协议。</p>
     */
    private Boolean sslEnable = Boolean.FALSE;

    /**
     * 控制连接字符集。路径含中文时必须与 NAS 一致，常见 UTF-8 / GBK。
     * <p>注意：必须在连接前生效，错误编码会出现 550 且路径变成 ????</p>
     */
    private String charset = "UTF-8";

}
