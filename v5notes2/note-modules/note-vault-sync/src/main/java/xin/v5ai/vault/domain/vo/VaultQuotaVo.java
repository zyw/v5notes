package xin.v5ai.vault.domain.vo;

import lombok.Data;

@Data
public class VaultQuotaVo {

    /** Always true once Phase 4 API is live. */
    private boolean available = true;

    private long usedBytes;

    private long quotaBytes;

    private int deviceLimit;

    private int deviceUsed;

    private String planName;

    /** When true, push is rejected but pull remains allowed. */
    private boolean overQuota;

    private long maxFileBytes;
}
