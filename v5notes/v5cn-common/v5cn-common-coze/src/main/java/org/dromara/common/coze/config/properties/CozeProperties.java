package org.dromara.common.coze.config.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 扣子API接口配置
 *
 * @author ZYW
 */
@Data
@ConfigurationProperties("coze")
public class CozeProperties {

    /**
     * 是否开启扣子API对接
     */
    private Boolean enabled;
    /**
     * 扣子API的clientId
     */
    private String clientId;
    /**
     * 扣子API的私钥Key（私钥个私钥路径配置一个就可以了）
     */
    private String privateKey;
    /**
     * 扣子API的私钥文件路径
     */
    private String privateKeyFilePath;
    /**
     * 扣子API的公钥ID
     */
    private String publicKey;
}
