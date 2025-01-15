package org.dromara.common.coze.exception;

public class CozeClientException extends RuntimeException {
    public CozeClientException(String message) {
        super(message);
    }
    public CozeClientException(String message, Throwable cause) {
        super(message, cause);
    }
    public CozeClientException(Throwable cause) {
        super(cause);
    }
}
