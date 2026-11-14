package xin.v5ai.vault.exception;

import lombok.Getter;

@Getter
public class VaultBusinessException extends RuntimeException {

    private final int httpStatus;
    private final String businessCode;

    public VaultBusinessException(int httpStatus, String businessCode, String message) {
        super(message);
        this.httpStatus = httpStatus;
        this.businessCode = businessCode;
    }
}
