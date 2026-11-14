package xin.v5ai.vault.service;

import xin.v5ai.vault.domain.bo.VaultBindBo;
import xin.v5ai.vault.domain.bo.VaultCreateBo;
import xin.v5ai.vault.domain.bo.VaultFileDeleteBo;
import xin.v5ai.vault.domain.bo.VaultFilePutBo;
import xin.v5ai.vault.domain.bo.VaultRenameBo;
import xin.v5ai.vault.domain.vo.VaultBindVo;
import xin.v5ai.vault.domain.vo.VaultFileContentVo;
import xin.v5ai.vault.domain.vo.VaultFileMetaVo;
import xin.v5ai.vault.domain.vo.VaultManifestVo;
import xin.v5ai.vault.domain.vo.VaultQuotaVo;
import xin.v5ai.vault.domain.vo.VaultSpaceVo;

import java.util.List;

public interface IVaultSyncService {

    VaultSpaceVo createVault(Long userId, VaultCreateBo bo);

    List<VaultSpaceVo> listVaults(Long userId);

    VaultBindVo bind(Long userId, Long vaultId, VaultBindBo bo);

    VaultManifestVo manifest(Long userId, Long vaultId, String sinceCursor);

    VaultFileMetaVo putFile(Long userId, Long vaultId, VaultFilePutBo bo);

    VaultFileContentVo getContent(Long userId, Long vaultId, String path, Long rev);

    VaultFileMetaVo deleteFile(Long userId, Long vaultId, VaultFileDeleteBo bo);

    VaultFileMetaVo rename(Long userId, Long vaultId, VaultRenameBo bo);

    VaultQuotaVo quota(Long userId);
}
