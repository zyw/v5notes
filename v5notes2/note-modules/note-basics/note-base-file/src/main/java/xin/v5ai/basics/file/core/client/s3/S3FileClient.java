package xin.v5ai.basics.file.core.client.s3;

import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpUtil;
import xin.v5ai.basics.file.core.client.AbstractFileClient;
import xin.v5ai.basics.file.core.client.FileUploadResult;
import xin.v5ai.common.oss.client.DefaultOssClientImpl;
import xin.v5ai.common.oss.client.OssClient;
import xin.v5ai.common.oss.config.AccessControlPolicyConfig;
import xin.v5ai.common.oss.config.OssClientConfig;
import xin.v5ai.common.oss.enums.AccessPolicy;
import xin.v5ai.common.oss.model.PutObjectResult;
import software.amazon.awssdk.regions.Region;

import java.io.ByteArrayOutputStream;
import java.time.Duration;

/**
 * 基于 S3 协议的文件客户端，实现 MinIO、阿里云、腾讯云、七牛云、华为云等云服务。
 *
 * <p>6.1.0 的 common-oss 已重构为 xin.v5ai.common.oss.client.OssClient 异步客户端，
 * 这里按新 API 重建 S3 客户端实现，保持 basics 文件模块的 upload/delete/getContent 语义。</p>
 *
 * @author 芋道源码
 */
public class S3FileClient extends AbstractFileClient<S3FileClientConfig> {

    private OssClient client;

    /**
     * 构造方法
     *
     * @param id     配置ID
     * @param config 配置信息
     */
    public S3FileClient(Long id, S3FileClientConfig config) {
        super(id, config);
    }

    @Override
    protected void doInit() {
        OssClientConfig clientConfig = OssClientConfig.builder()
            .endpoint(config.getEndpoint())
            .domain(config.getDomain())
            .accessKey(config.getAccessKey())
            .secretKey(config.getAccessSecret())
            .bucket(config.getBucket())
            .region(buildRegion())
            .useHttps("Y".equals(config.getIsHttps()))
            .usePathStyleAccess(!isCloudEndpoint(config.getEndpoint()))
            .accessControlPolicyConfig(resolveAccessControlPolicy(config.getAccessPolicy()))
            .build();
        this.client = new DefaultOssClientImpl("basics-s3-" + getId(), clientConfig);
        this.client.initialize();
    }

    @Override
    public FileUploadResult upload(byte[] content, String path, String type) throws Exception {
        PutObjectResult result = client.upload(path, content);
        return FileUploadResult.builder()
            .url(result.url())
            .path(path)
            .build();
    }

    @Override
    public void delete(String path) throws Exception {
        client.delete(path);
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        client.download(path, out);
        return out.toByteArray();
    }

    /**
     * 获取当前访问策略。
     *
     * @return 访问策略
     */
    public AccessPolicy getAccessPolicy() {
        return client.config().accessControlPolicyConfig().accessPolicy();
    }

    /**
     * 生成私有桶的临时访问 URL。
     *
     * @param objectKey 对象键
     * @param second    过期秒数
     * @return 预签名 URL
     */
    public String getPrivateUrl(String objectKey, Integer second) {
        return client.presignGetUrl(objectKey, Duration.ofSeconds(second));
    }

    private static boolean isCloudEndpoint(String endpoint) {
        return StrUtil.containsAny(endpoint, S3FileClientConfig.ENDPOINT_ALIYUN,
            S3FileClientConfig.ENDPOINT_TENCENT, S3FileClientConfig.ENDPOINT_QINIU);
    }

    private Region buildRegion() {
        String endpoint = config.getEndpoint();
        if (endpoint != null && endpoint.contains(S3FileClientConfig.ENDPOINT_ALIYUN)) {
            String region = StrUtil.subBefore(endpoint, ".", false).replaceAll("-internal", "").replaceAll("https://", "");
            return Region.of(region);
        }
        if (endpoint != null && endpoint.contains(S3FileClientConfig.ENDPOINT_TENCENT)) {
            String region = StrUtil.subAfter(endpoint, "cos.", false).replaceAll("." + S3FileClientConfig.ENDPOINT_TENCENT, "");
            return Region.of(region);
        }
        return Region.US_EAST_1;
    }

    private static AccessControlPolicyConfig resolveAccessControlPolicy(String accessPolicy) {
        if (StrUtil.isBlank(accessPolicy)) {
            return AccessControlPolicyConfig.DEFAULT;
        }
        return AccessControlPolicyConfig.builder()
            .enabled(true)
            .accessPolicy(AccessPolicy.formType(accessPolicy))
            .build();
    }
}
