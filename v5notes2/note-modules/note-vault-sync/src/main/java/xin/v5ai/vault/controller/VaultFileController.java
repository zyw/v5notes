package xin.v5ai.vault.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.bo.VaultFileBatchBo;
import xin.v5ai.vault.domain.bo.VaultFileDeleteBo;
import xin.v5ai.vault.domain.bo.VaultFilePutBo;
import xin.v5ai.vault.domain.bo.VaultRenameBo;
import xin.v5ai.vault.domain.vo.VaultFileContentVo;
import xin.v5ai.vault.domain.vo.VaultFileMetaVo;
import xin.v5ai.vault.domain.vo.VaultFileVersionVo;
import xin.v5ai.vault.domain.vo.VaultManifestVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.exception.VaultConflictException;
import xin.v5ai.vault.service.IVaultSyncService;

import java.util.List;

@SaCheckLogin
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/v1/vaults/{vaultId}")
public class VaultFileController extends BaseController {

    private final IVaultSyncService vaultSyncService;

    @GetMapping("/manifest")
    public R<VaultManifestVo> manifest(@PathVariable String vaultId,
                                       @RequestParam(value = "since", required = false) String since) {
        return R.ok(vaultSyncService.manifest(LoginHelper.getUserId(), parseVaultId(vaultId), since));
    }

    @PutMapping("/files")
    public R<?> putFile(@PathVariable String vaultId, @Valid @RequestBody VaultFilePutBo bo) {
        try {
            return R.ok(vaultSyncService.putFile(LoginHelper.getUserId(), parseVaultId(vaultId), bo));
        } catch (VaultConflictException ex) {
            return R.fail(HttpStatus.CONFLICT, ex.getMessage(), ex.getConflict());
        }
    }

    /** Sequential transactional batch (design §8.2); same 409 envelope as single PUT. */
    @PostMapping("/files/batch")
    public R<?> putBatch(@PathVariable String vaultId, @Valid @RequestBody VaultFileBatchBo bo) {
        try {
            return R.ok(vaultSyncService.putBatch(LoginHelper.getUserId(), parseVaultId(vaultId), bo.getFiles()));
        } catch (VaultConflictException ex) {
            return R.fail(HttpStatus.CONFLICT, ex.getMessage(), ex.getConflict());
        }
    }

    @GetMapping("/files/content")
    public R<VaultFileContentVo> content(@PathVariable String vaultId,
                                         @RequestParam("path") String path,
                                         @RequestParam(value = "rev", required = false) Long rev) {
        return R.ok(vaultSyncService.getContent(LoginHelper.getUserId(), parseVaultId(vaultId), path, rev));
    }

    /** Phase 5 stub — returns empty until version retention is persisted. */
    @GetMapping("/files/versions")
    public R<List<VaultFileVersionVo>> versions(@PathVariable String vaultId,
                                                @RequestParam("path") String path) {
        return R.ok(vaultSyncService.listFileVersions(LoginHelper.getUserId(), parseVaultId(vaultId), path));
    }

    @DeleteMapping("/files")
    public R<?> deleteFile(@PathVariable String vaultId, @Valid @RequestBody VaultFileDeleteBo bo) {
        try {
            return R.ok(vaultSyncService.deleteFile(LoginHelper.getUserId(), parseVaultId(vaultId), bo));
        } catch (VaultConflictException ex) {
            return R.fail(HttpStatus.CONFLICT, ex.getMessage(), ex.getConflict());
        }
    }

    @PostMapping("/renames")
    public R<?> rename(@PathVariable String vaultId, @Valid @RequestBody VaultRenameBo bo) {
        try {
            return R.ok(vaultSyncService.rename(LoginHelper.getUserId(), parseVaultId(vaultId), bo));
        } catch (VaultConflictException ex) {
            return R.fail(HttpStatus.CONFLICT, ex.getMessage(), ex.getConflict());
        }
    }

    private static Long parseVaultId(String vaultId) {
        try {
            return Long.parseLong(vaultId);
        } catch (NumberFormatException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "vaultId 无效");
        }
    }
}
