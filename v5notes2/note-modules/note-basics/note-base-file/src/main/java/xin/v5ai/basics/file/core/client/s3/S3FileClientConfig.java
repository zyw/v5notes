package xin.v5ai.basics.file.core.client.s3;

import cn.hutool.core.util.StrUtil;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import xin.v5ai.basics.file.core.client.FileClientConfig;
import org.hibernate.validator.constraints.URL;

/**
 * S3 文件客户端的配置类
 *
 * @author 芋道源码
 */
@Data
public class S3FileClientConfig implements FileClientConfig {

    /**
     * 七牛云的域名
     */
    public static final String ENDPOINT_QINIU = "qiniucs.com";
    /**
     * 阿里云的域名
     */
    public static final String ENDPOINT_ALIYUN = "aliyuncs.com";
    /**
     * 腾讯云的域名
     */
    public static final String ENDPOINT_TENCENT = "myqcloud.com";

    /**
     * 节点地址
     */
    @NotNull(message = "endpoint 不能为空")
    private String endpoint;

    /**
     * 自定义域名
     */
    @URL(message = "domain 必须是 URL 格式")
    private String domain;

    /**
     * 存储 Bucket
     */
    @NotNull(message = "bucket 不能为空")
    private String bucket;

    /**
     * 访问 Key
     */
    @NotNull(message = "accessKey 不能为空")
    private String accessKey;

    /**
     * 访问 Secret
     */
    @NotNull(message = "accessSecret 不能为空")
    private String accessSecret;

    /**
     * 是否https（Y=是,N=否）
     */
    private String isHttps;

    /**
     * 桶权限类型(0private 1public 2custom)
     */
    private String accessPolicy;

    public boolean isDomainValid() {
        // 如果是七牛，必须带有domain，否则无法上传
        if (StrUtil.contains(endpoint, ENDPOINT_QINIU) && StrUtil.isEmpty(domain)) {
            return false;
        }
        return true;
    }

}
