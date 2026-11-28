package xin.v5ai.basics.file.core.client.s3;

import cn.hutool.core.util.StrUtil;
import xin.v5ai.basics.file.core.client.AbstractFileClient;
import xin.v5ai.basics.file.core.client.FileUploadResult;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.oss.client.DefaultOssClientImpl;
import xin.v5ai.common.oss.client.OssClient;
import xin.v5ai.common.oss.config.AccessControlPolicyConfig;
import xin.v5ai.common.oss.config.OssClientConfig;
import xin.v5ai.common.oss.enums.AccessPolicy;
import xin.v5ai.common.oss.exception.S3StorageException;
import xin.v5ai.common.oss.model.PutObjectResult;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.S3Exception;

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

    S3FileClient(Long id, S3FileClientConfig config, OssClient client) {
        super(id, config);
        this.client = client;
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
        try {
            PutObjectResult result = client.upload(path, content);
            return FileUploadResult.builder()
                .url(result.url())
                .path(path)
                .build();
        } catch (S3StorageException ex) {
            throw translateException(ex);
        }
    }

    @Override
    public void delete(String path) throws Exception {
        try {
            client.delete(path);
        } catch (S3StorageException ex) {
            throw translateException(ex);
        }
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            client.download(path, out);
            return out.toByteArray();
        } catch (S3StorageException ex) {
            throw translateException(ex);
        }
    }

    private RuntimeException translateException(S3StorageException ex) {
        for (Throwable cur = ex; cur != null; cur = cur.getCause() == cur ? null : cur.getCause()) {
            boolean isNoSuchBucket = cur instanceof NoSuchBucketException
                || (cur instanceof S3Exception s3Ex
                    && s3Ex.awsErrorDetails() != null
                    && "NoSuchBucket".equalsIgnoreCase(s3Ex.awsErrorDetails().errorCode()));
            if (isNoSuchBucket) {
                String bucket = config != null ? config.getBucket() : null;
                String message = StrUtil.isNotBlank(bucket)
                    ? "存储桶 [" + bucket + "] 不存在，请先在对象存储服务中创建该存储桶或检查文件存储配置"
                    : "存储桶不存在，请先在对象存储服务中创建该存储桶或检查文件存储配置";
                return new ServiceException(message);
            }
        }
        return ex;
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
