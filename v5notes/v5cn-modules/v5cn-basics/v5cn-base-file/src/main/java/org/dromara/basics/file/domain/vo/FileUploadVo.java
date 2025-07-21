package org.dromara.basics.file.domain.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;

/**
 * 上传对象信息
 *
 * @author ZYW
 */
@Data
@SuperBuilder
@EqualsAndHashCode(callSuper = false)
public class FileUploadVo {

    /**
     * URL地址
     */
    private String url;

    /**
     * 文件名
     */
    private String path;

    /**
     * 对象存储主键
     */
    private Long id;

}
