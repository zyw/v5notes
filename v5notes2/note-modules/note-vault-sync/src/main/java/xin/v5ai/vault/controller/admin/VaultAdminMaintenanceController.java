package xin.v5ai.vault.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.domain.vo.admin.VaultCleanupResultVo;
import xin.v5ai.vault.domain.vo.admin.VaultMaintenanceStatsVo;
import xin.v5ai.vault.service.IVaultAdminService;

/**
 * 管理端 Vault 存储维护（孤儿附件与过期墓碑清理，P2）。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/admin/maintenance")
public class VaultAdminMaintenanceController extends BaseController {

    private final IVaultAdminService adminService;

    @SaCheckPermission("vault:maintenance:run")
    @GetMapping("/stats")
    public R<VaultMaintenanceStatsVo> stats() {
        return R.ok(adminService.getMaintenanceStats());
    }

    @SaCheckPermission("vault:maintenance:run")
    @Log(title = "Vault孤儿附件回收", businessType = BusinessType.CLEAN)
    @RepeatSubmit()
    @PostMapping("/cleanup-orphan-assets")
    public R<VaultCleanupResultVo> cleanupOrphanAssets() {
        return R.ok(adminService.cleanupOrphanAssets());
    }

    @SaCheckPermission("vault:maintenance:run")
    @Log(title = "Vault过期墓碑清理", businessType = BusinessType.CLEAN)
    @RepeatSubmit()
    @PostMapping("/cleanup-tombstones")
    public R<VaultCleanupResultVo> cleanupTombstones() {
        return R.ok(adminService.cleanupExpiredTombstones());
    }
}
