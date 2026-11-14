package xin.v5ai.vault.exception;

import lombok.Getter;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.vo.VaultConflictVo;

@Getter
public class VaultConflictException extends RuntimeException {

    private final VaultConflictVo conflict;

    public VaultConflictException(VaultConflictVo conflict) {
        super("revision conflict: " + (conflict.getPath() == null ? "" : conflict.getPath()));
        this.conflict = conflict;
        if (this.conflict.getCode() == null) {
            this.conflict.setCode(VaultErrorCodes.CONFLICT_REV);
        }
    }
}
