package xin.v5ai.basics.file.core.client;

import cn.hutool.core.io.IoUtil;
import xin.v5ai.basics.file.core.client.s3.FilePresignedUrlRespDTO;
import xin.v5ai.basics.file.core.client.FileUploadResult;

import java.io.InputStream;
import java.io.OutputStream;

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
    FileUploadResult upload(byte[] content, String path, String type) throws Exception;

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

    /**
     * 流式上传。默认实现退化为一次性读入内存，保持既有实现的兼容性；
     * 大文件后端（ftp/local/s3）应覆写以避免整块 buffer。
     */
    default FileUploadResult uploadStream(InputStream in, long size, String path, String type) throws Exception {
        return upload(IoUtil.readBytes(in), path, type);
    }

    /**
     * 流式读取，支持 {@code Range}。
     *
     * @param offset 起始字节
     * @param length 读取长度；{@code < 0} 表示读到结尾
     */
    default void getContentStream(String path, long offset, long length, OutputStream out) throws Exception {
        byte[] all = getContent(path);
        int start = (int) Math.min(Math.max(0, offset), all.length);
        int end = length < 0 ? all.length : (int) Math.min(all.length, start + length);
        out.write(all, start, Math.max(0, end - start));
    }
}
