package xin.v5ai.vault.service;

import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.domain.vo.admin.VaultAdminAssetVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminChangeVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminFileContentVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminFileVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminOverviewVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminReplicaVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminSpaceVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminStorageRankVo;
import xin.v5ai.vault.domain.vo.admin.VaultCleanupResultVo;
import xin.v5ai.vault.domain.vo.admin.VaultMaintenanceStatsVo;

import java.io.OutputStream;
import java.util.List;

/**
 * 管理端 Vault 同步观测与运维服务（P1）。
 */
public interface IVaultAdminService {

    VaultAdminOverviewVo overview(int range);

    List<VaultAdminStorageRankVo> storageTop(int limit);

    PageResult<VaultAdminSpaceVo> listSpaces(String keyword, String name, String status, PageQuery pageQuery);

    VaultAdminSpaceVo getSpace(Long vaultId);

    void deleteSpace(Long vaultId);

    PageResult<VaultAdminFileVo> listFiles(Long vaultId, String keyword, String fileType,
                                           Boolean includeDeleted, PageQuery pageQuery);

    VaultAdminFileContentVo getFileContent(Long vaultId, Long fileId);

    VaultAssetRef requireAssetForAdminRead(Long vaultId, String assetId);

    void streamAssetContent(VaultAssetRef ref, OutputStream out) throws Exception;

    void deleteFile(Long vaultId, Long fileId);

    PageResult<VaultAdminAssetVo> listAssets(Long vaultId, String keyword, PageQuery pageQuery);

    PageResult<VaultAdminAssetVo> listAssets(Long vaultId, String keyword, String backend,
                                             String mimePrefix, PageQuery pageQuery);

    PageResult<VaultAdminChangeVo> listChanges(Long vaultId, String op, String keyword, PageQuery pageQuery);

    PageResult<VaultAdminReplicaVo> listReplicas(Long vaultId, String keyword, String deviceId,
                                                 Integer inactiveDays, PageQuery pageQuery);

    void kickReplica(Long id);

    int kickReplicas(List<Long> ids);

    VaultMaintenanceStatsVo getMaintenanceStats();

    VaultCleanupResultVo cleanupOrphanAssets();

    VaultCleanupResultVo cleanupExpiredTombstones();
}
