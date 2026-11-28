package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

/**
 * 用户 Vault 同步存储占用排行行。
 */
@Data
public class VaultAdminStorageRankVo {

    private String userId;

    private String userName;

    private String nickName;

    private long spaceCount;

    private long replicaCount;

    private long usedBytes;

    private long quotaBytes;

    private boolean overQuota;
}
