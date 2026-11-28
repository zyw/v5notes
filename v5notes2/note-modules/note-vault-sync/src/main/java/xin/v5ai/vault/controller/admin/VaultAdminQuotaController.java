package xin.v5ai.vault.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.bo.admin.VaultQuotaPolicyBo;
import xin.v5ai.vault.domain.bo.admin.VaultUserQuotaBo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminUserQuotaVo;
import xin.v5ai.vault.domain.vo.admin.VaultQuotaPolicyVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.IVaultQuotaService;

/**
 * 管理端 Vault 同步配额与全局策略管理（P2）。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/admin/quota")
public class VaultAdminQuotaController extends BaseController {

    private final IVaultQuotaService quotaService;

    @SaCheckPermission("vault:quota:list")
    @GetMapping("/policy")
    public R<VaultQuotaPolicyVo> policy() {
        return R.ok(quotaService.getPolicy());
    }

    @SaCheckPermission("vault:quota:edit")
    @Log(title = "Vault全局配额策略", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/policy")
    public R<VaultQuotaPolicyVo> updatePolicy(@Valid @RequestBody VaultQuotaPolicyBo bo) {
        return R.ok(quotaService.updatePolicy(bo));
    }

    @SaCheckPermission("vault:quota:list")
    @GetMapping("/users")
    public R<PageResult<VaultAdminUserQuotaVo>> users(@RequestParam(required = false) String keyword,
                                                      PageQuery pageQuery) {
        return R.ok(quotaService.listUserQuotas(keyword, pageQuery));
    }

    @SaCheckPermission("vault:quota:edit")
    @Log(title = "Vault用户配额覆盖", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/users/{userId}")
    public R<Void> upsertUser(@PathVariable String userId, @Valid @RequestBody VaultUserQuotaBo bo) {
        quotaService.upsertUserQuota(parseUserId(userId), bo);
        return R.ok();
    }

    @SaCheckPermission("vault:quota:edit")
    @Log(title = "Vault用户配额恢复默认", businessType = BusinessType.DELETE)
    @RepeatSubmit()
    @DeleteMapping("/users/{userId}")
    public R<Void> removeUser(@PathVariable String userId) {
        quotaService.deleteUserQuota(parseUserId(userId));
        return R.ok();
    }

    private static Long parseUserId(String raw) {
        try {
            return Long.parseLong(raw.trim());
        } catch (Exception ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "userId 无效");
        }
    }
}
