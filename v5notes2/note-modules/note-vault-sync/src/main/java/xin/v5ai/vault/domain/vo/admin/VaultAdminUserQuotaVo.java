package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.Date;

/**
 * 管理端用户级配额覆盖列表项（P2）。
 */
@Data
public class VaultAdminUserQuotaVo {

    private String userId;

    private String userName;

    private String nickName;

    private Long quotaBytes;

    private Integer replicaLimit;

    private Long maxFileBytes;

    private long effectiveQuotaBytes;

    private int effectiveReplicaLimit;

    private long effectiveMaxFileBytes;

    private String planName;

    private long usedBytes;

    private long spaceCount;

    private long replicaCount;

    private Date expireTime;

    private boolean expired;

    private String remark;

    private Date updateTime;
}
