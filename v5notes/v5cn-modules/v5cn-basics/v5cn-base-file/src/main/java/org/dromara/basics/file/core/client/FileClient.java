package org.dromara.basics.file.core.client;

import org.dromara.basics.file.core.client.s3.FilePresignedUrlRespDTO;
import org.dromara.common.oss.entity.UploadResult;

/**
 * 文件客户端接口
 * @author 芋道源码,ZYW
 */
public interface FileClient {

    /**
     * 获取客户端ID编号
     * @return 返回客户端ID编号
     */
    Long getId();

    /**
     * 上传文件
     * @param content 文件内容
     * @param path 相对路径
     * @param type 文件类型
     * @return 完整路径，即 HTTP 访问地址
     * @throws Exception 上传异常
     */
    UploadResult upload(byte[] content, String path, String type) throws Exception;

    /**
     * 删除文件
     * @param path 相对路径
     * @throws Exception 上传异常
     */
    void delete(String path) throws Exception;

    /**
     * 获取文件内容
     * @param path 相对路径
     * @return 文件内容
     * @throws Exception 上传异常
     */
    byte[] getContent(String path) throws Exception;

    /**
     * 获取文件预签名地址
     * @param path 相对路径
     * @return 文件 URL
     * @throws Exception 上传异常
     */
    default FilePresignedUrlRespDTO getPresignedObjectUrl(String path) throws Exception {
        throw new UnsupportedOperationException("不支持的操作");
    }
}
