package xin.v5ai.vault.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.domain.vo.admin.VaultAdminOverviewVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminStorageRankVo;
import xin.v5ai.vault.service.IVaultAdminService;

import java.util.List;

/**
 * 管理端 Vault 同步概览统计。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/admin/overview")
public class VaultAdminOverviewController extends BaseController {

    private final IVaultAdminService adminService;

    @SaCheckPermission("vault:overview:query")
    @GetMapping
    public R<VaultAdminOverviewVo> overview(@RequestParam(defaultValue = "30") Integer range) {
        return R.ok(adminService.overview(range == null ? 30 : range));
    }

    @SaCheckPermission("vault:overview:query")
    @GetMapping("/storage-top")
    public R<List<VaultAdminStorageRankVo>> storageTop(@RequestParam(defaultValue = "10") Integer limit) {
        return R.ok(adminService.storageTop(limit == null ? 10 : limit));
    }
}
