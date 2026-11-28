package xin.v5ai.vault.controller;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.VaultHttpStatus;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.exception.VaultConflictException;

import java.util.Map;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(basePackages = "xin.v5ai.vault")
public class VaultExceptionHandler {

    @ExceptionHandler(VaultBusinessException.class)
    public R<Map<String, String>> handleBusiness(VaultBusinessException ex) {
        return R.fail(ex.getHttpStatus(), ex.getMessage(), Map.of("code", ex.getBusinessCode()));
    }

    @ExceptionHandler(VaultConflictException.class)
    public R<?> handleConflict(VaultConflictException ex) {
        return R.fail(409, ex.getMessage(), ex.getConflict());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public R<Map<String, String>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return R.fail(VaultHttpStatus.PAYLOAD_TOO_LARGE, "单文件超过上限",
            Map.of("code", VaultErrorCodes.FILE_TOO_LARGE));
    }
}
