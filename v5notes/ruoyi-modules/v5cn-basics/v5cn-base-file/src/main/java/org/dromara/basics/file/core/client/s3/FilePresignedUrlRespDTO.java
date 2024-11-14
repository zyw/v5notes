package org.dromara.basics.file.core.client.s3;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 文件预签名地址 Response DTO
 *
 * @author owen
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class FilePresignedUrlRespDTO {
    /**
     * 文件上传URL(用于上传文件)
     */
    private String uploadUrl;

    /**
     * 文件URL(用于读取和下载文件)
     */
    private String url;
}
