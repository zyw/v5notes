package org.dromara.basics.file.core.client.s3;

import cn.hutool.core.io.IoUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.http.HttpUtil;
import org.dromara.basics.file.core.client.AbstractFileClient;
import org.dromara.common.core.utils.MapstructUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.oss.core.FileOssClient;
import org.dromara.common.oss.entity.UploadResult;
import org.dromara.common.oss.enumd.AccessPolicyType;
import org.dromara.common.oss.exception.FileException;
import org.dromara.common.oss.properties.FileProperties;

/**
 * 基于 S3 协议的文件客户端，实现 MinIO、阿里云、腾讯云、七牛云、华为云等云服务
 * <p>
 * S3 协议的客户端，采用亚马逊提供的 software.amazon.awssdk.s3 库
 *
 * @author 芋道源码
 */
public class S3FileClient extends AbstractFileClient<S3FileClientConfig> {

    private FileOssClient client;

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
        // 补全 domain
//        if(StrUtil.isEmpty(config.getDomain())) {
//            config.setDomain(buildDomain());
//        }

        FileProperties fileProperties = MapstructUtils.convert(config, FileProperties.class);

        fileProperties.setEndpoint(buildEndpointURL());
        fileProperties.setRegion(buildRegion());
        fileProperties.setIsHttps(buildIsHttps());
        client = new FileOssClient(fileProperties);
    }

    /**
     * 基于 endpoint 构建调用云服务的 URL 地址
     *
     * @return URI 地址
     */
    private String buildEndpointURL() {
        // 如果已经是http或https开头，则不进行拼接，主要适配MinIO的endpoint

        if(HttpUtil.isHttp(config.getEndpoint()) || HttpUtil.isHttps(config.getEndpoint())) {
            return StrUtil.subAfter(config.getEndpoint(), "://", false);
        }

        throw new FileException("配置错误! 访问站点:必须已http://或者https://开头。");
    }
    /**
     * 基于 bucket + endpoint 构建访问的 Domain 地址
     *
     * @return Domain 地址
     */
    private String buildDomain() {
        // 如果已经是http或https开头，则不进行拼接，主要适配MinIO的endpoint
        if(HttpUtil.isHttp(config.getEndpoint()) || HttpUtil.isHttps(config.getEndpoint())) {
            return StrUtil.format("{}/{}", config.getEndpoint(), config.getBucket());
        }
        // 阿里云、腾讯云、华为云都合适，七牛云比较特殊，必须有自定义域名
        return StrUtil.format("https://{}.{}", config.getBucket(),config.getEndpoint());
    }

    /**
     * 基于 bucket 构建 region 地区
     *
     * @return region 地区
     */
    private String buildRegion() {
        // 阿里云必须有 region，否是会报错
        if(config.getEndpoint().contains(S3FileClientConfig.ENDPOINT_ALIYUN)) {
            return StrUtil.subBefore(config.getEndpoint(), ".", false)
                .replaceAll("-internal", "") // 去除内网Endpoint的后缀
                .replaceAll("https://", "");
        }
        // 腾讯云必须有 region，否是会报错
        if(config.getEndpoint().contains(S3FileClientConfig.ENDPOINT_TENCENT)) {
            return StrUtil.subAfter(config.getEndpoint(), "cos.", false)
                .replaceAll("." + S3FileClientConfig.ENDPOINT_TENCENT, ""); // 去除Endpoint的后缀
        }

        return "";
    }

    /**
     * 判断是否是https
     * @return （Y=是,N=否）
     */
    private String buildIsHttps() {
        if(HttpUtil.isHttp(config.getEndpoint())) {
            return "N";
        }
        if(HttpUtil.isHttps(config.getEndpoint())) {
            return "Y";
        }

        throw new FileException("配置错误! 访问站点:必须已http://或者https://开头。");
    }

    @Override
    public UploadResult upload(byte[] content, String path, String type) throws Exception {
        String suffix = StringUtils.substring(path, path.lastIndexOf("."), path.length());

        return client.uploadSuffix(content, suffix);
    }

    @Override
    public void delete(String path) throws Exception {
        client.delete(path);
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        return IoUtil.readBytes(client.getObjectContent(path));
    }

//    @Override
//    public FilePresignedUrlRespDTO getPresignedObjectUrl(String path) throws Exception {
////        String uploadUrl = client.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
////                .method(Method.PUT)
////                .bucket(config.getBucket())
////                .object(path)
////                .expiry(10, TimeUnit.MINUTES) // 过期时间（秒数）取值范围：1 秒 ~ 7 天
////                .build());
////
////        return new FilePresignedUrlRespDTO(uploadUrl, config.getDomain() + "/" + path);
//
//        return new FilePresignedUrlRespDTO(client.getUrl(), config.getDomain() + "/" + path);
//    }

    public AccessPolicyType getAccessPolicy() {
        return client.getAccessPolicy();
    }

    public String getPrivateUrl(String objectKey, Integer second) {
        return client.getPrivateUrl(objectKey, second);
    }
}
