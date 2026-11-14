package xin.v5ai.vault.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.domain.vo.VaultQuotaVo;
import xin.v5ai.vault.service.IVaultSyncService;

@SaCheckLogin
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/v1")
public class VaultQuotaController extends BaseController {

    private final IVaultSyncService vaultSyncService;

    @GetMapping("/quota")
    public R<VaultQuotaVo> quota() {
        return R.ok(vaultSyncService.quota(LoginHelper.getUserId()));
    }
}
