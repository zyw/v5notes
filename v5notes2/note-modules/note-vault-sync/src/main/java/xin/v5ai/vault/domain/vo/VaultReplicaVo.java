package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.util.Date;

@Data
public class VaultReplicaVo {

    /** Binding row id (snowflake string). */
    private String id;

    private String vaultId;

    /** Copy identity, from vault.json binding.replicaId. */
    private String replicaId;

    /** Machine this copy syncs from. */
    private String deviceId;

    private String clientInfo;

    private Date lastSeenAt;

    private Date boundAt;
}
