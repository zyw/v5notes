package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

/**
 * 全局默认 Vault 同步策略视图（P2）。
 */
@Data
public class VaultQuotaPolicyVo {

    private long defaultQuotaBytes;

    private int defaultReplicaLimit;

    private long defaultMaxFileBytes;

    private int tombstoneRetentionDays;

    private int orphanAssetGraceDays;

    /** 服务端 spring.servlet.multipart.max-file-size 上限（字节）。 */
    private long multipartMaxFileBytes;
}
