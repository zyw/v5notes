package xin.v5ai.vault.domain.vo;

import lombok.Data;

@Data
public class VaultBindVo {

    private String vaultId;

    private String replicaId;

    /** True when cloud has at least one non-deleted file. */
    private Boolean cloudHasContent;

    private VaultQuotaVo quota;
}
