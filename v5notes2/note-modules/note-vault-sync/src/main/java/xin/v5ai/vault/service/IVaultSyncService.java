package xin.v5ai.vault.service;

import xin.v5ai.vault.domain.bo.VaultBindBo;
import xin.v5ai.vault.domain.bo.VaultCreateBo;
import xin.v5ai.vault.domain.bo.VaultFileDeleteBo;
import xin.v5ai.vault.domain.bo.VaultFilePutBo;
import xin.v5ai.vault.domain.bo.VaultRenameBo;
import xin.v5ai.vault.domain.vo.VaultBindVo;
import xin.v5ai.vault.domain.vo.VaultDeviceVo;
import xin.v5ai.vault.domain.vo.VaultFileContentVo;
import xin.v5ai.vault.domain.vo.VaultFileMetaVo;
import xin.v5ai.vault.domain.vo.VaultFileVersionVo;
import xin.v5ai.vault.domain.vo.VaultManifestVo;
import xin.v5ai.vault.domain.vo.VaultQuotaVo;
import xin.v5ai.vault.domain.vo.VaultSpaceVo;

import java.util.List;

public interface IVaultSyncService {

    VaultSpaceVo createVault(Long userId, VaultCreateBo bo);

    List<VaultSpaceVo> listVaults(Long userId);

    VaultBindVo bind(Long userId, Long vaultId, VaultBindBo bo);

    List<VaultDeviceVo> listDevices(Long userId, Long vaultId);

    /**
     * Remove a bound device so a new bind slot frees up (design §8.3).
     * Does not wipe cloud file history; only the device binding row.
     */
    void kickDevice(Long userId, Long vaultId, String deviceId);

    VaultManifestVo manifest(Long userId, Long vaultId, String sinceCursor);

    VaultFileMetaVo putFile(Long userId, Long vaultId, VaultFilePutBo bo);

    /**
     * Sequential transactional apply of {@link #putFile} (design §8.2 batch endpoint).
     * Any item failure rolls the whole batch back; response lists items in request order.
     */
    List<VaultFileMetaVo> putBatch(Long userId, Long vaultId, List<VaultFilePutBo> files);

    VaultFileContentVo getContent(Long userId, Long vaultId, String path, Long rev);

    VaultFileMetaVo deleteFile(Long userId, Long vaultId, VaultFileDeleteBo bo);

    VaultFileMetaVo rename(Long userId, Long vaultId, VaultRenameBo bo);

    VaultQuotaVo quota(Long userId);

    /**
     * Phase 5 stub: version history not persisted yet; always empty.
     */
    List<VaultFileVersionVo> listFileVersions(Long userId, Long vaultId, String path);
}
