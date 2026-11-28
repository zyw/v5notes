package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.Date;

/**
 * 管理端绑定副本列表项。
 */
@Data
public class VaultAdminReplicaVo {

    private String id;

    private String vaultId;

    private String vaultName;

    private String userId;

    private String userName;

    private String nickName;

    private String replicaId;

    private String deviceId;

    private String clientInfo;

    private Date lastSeenAt;

    private Date boundAt;
}
