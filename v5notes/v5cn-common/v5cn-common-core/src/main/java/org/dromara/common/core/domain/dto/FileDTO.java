package org.dromara.common.core.domain.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

/**
 * OSS对象
 *
 * @author Lion Li
 */
@Data
@NoArgsConstructor
public class FileDTO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 对象存储主键
     */
    private Long id;

    /**
     * 原名
     */
    private String name;

    /**
     * 文件名+路径
     */
    private String path;

    /**
     * 文件后缀名
     */
    private String suffix;

    /**
     * URL地址
     */
    private String url;

}
