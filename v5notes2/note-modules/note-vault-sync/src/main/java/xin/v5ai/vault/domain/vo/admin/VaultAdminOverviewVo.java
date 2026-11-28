package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;
import xin.v5ai.vault.service.model.VaultAssetCapability;

import java.util.List;

/**
 * 管理端 Vault 同步全局概览统计。
 */
@Data
public class VaultAdminOverviewVo {

    private long totalSpaces;

    private long activeUsers;

    private long totalReplicas;

    private long uniqueDevices;

    private long totalFiles;

    private long noteFiles;

    private long assetFiles;

    private long configFiles;

    private long totalUsedBytes;

    private long assetBytes;

    private long overQuotaUsers;

    private long defaultQuotaBytes;

    private int defaultReplicaLimit;

    private long defaultMaxFileBytes;

    private VaultAssetCapability assetStorage;

    private List<VaultAdminTrendPointVo> trend;
}
