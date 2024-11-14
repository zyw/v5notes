package org.dromara.common.oss.exception;

import java.io.Serial;

/**
 * OSS异常类
 *
 * @author Lion Li
 */
public class FileException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    public FileException(String msg) {
        super(msg);
    }

}
