package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;
import xin.v5ai.vault.service.model.VaultAssetCapability;

/**
 * 存储维护可清理对象统计（P2）。
 */
@Data
public class VaultMaintenanceStatsVo {

    private long orphanAssetCount;

    private long orphanAssetBytes;

    private long expiredTombstoneCount;

    private int orphanAssetGraceDays;

    private int tombstoneRetentionDays;

    private VaultAssetCapability assetStorage;
}
