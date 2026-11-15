package xin.v5ai.vault.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.domain.bo.VaultBindBo;
import xin.v5ai.vault.domain.bo.VaultCreateBo;
import xin.v5ai.vault.domain.vo.VaultBindVo;
import xin.v5ai.vault.domain.vo.VaultDeviceVo;
import xin.v5ai.vault.domain.vo.VaultSpaceVo;
import xin.v5ai.vault.service.IVaultSyncService;

import java.util.List;

@SaCheckLogin
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/v1/vaults")
public class VaultSpaceController extends BaseController {

    private final IVaultSyncService vaultSyncService;

    @PostMapping
    public R<VaultSpaceVo> create(@Valid @RequestBody VaultCreateBo bo) {
        return R.ok(vaultSyncService.createVault(LoginHelper.getUserId(), bo));
    }

    @GetMapping
    public R<List<VaultSpaceVo>> list() {
        return R.ok(vaultSyncService.listVaults(LoginHelper.getUserId()));
    }

    @PostMapping("/{vaultId}/bind")
    public R<VaultBindVo> bind(@PathVariable String vaultId, @Valid @RequestBody VaultBindBo bo) {
        return R.ok(vaultSyncService.bind(LoginHelper.getUserId(), Long.parseLong(vaultId), bo));
    }

    @GetMapping("/{vaultId}/devices")
    public R<List<VaultDeviceVo>> listDevices(@PathVariable String vaultId) {
        return R.ok(vaultSyncService.listDevices(LoginHelper.getUserId(), Long.parseLong(vaultId)));
    }

    @DeleteMapping("/{vaultId}/devices/{deviceId}")
    public R<Void> kickDevice(@PathVariable String vaultId, @PathVariable String deviceId) {
        vaultSyncService.kickDevice(LoginHelper.getUserId(), Long.parseLong(vaultId), deviceId);
        return R.ok();
    }
}
