package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.Date;

/**
 * 管理端云端库列表与详情项。
 */
@Data
public class VaultAdminSpaceVo {

    private String vaultId;

    private String userId;

    private String userName;

    private String nickName;

    private String name;

    private long usedBytes;

    private long userUsedBytes;

    private long quotaBytes;

    private boolean overQuota;

    private long fileCount;

    private long replicaCount;

    private int replicaLimit;

    private Date lastSyncAt;

    private Date createTime;

    private Date updateTime;
}
