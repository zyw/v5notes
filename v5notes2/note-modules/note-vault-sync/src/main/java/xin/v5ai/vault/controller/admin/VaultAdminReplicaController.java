package xin.v5ai.vault.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
import xin.v5ai.vault.domain.vo.admin.VaultAdminReplicaVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.IVaultAdminService;

import java.util.ArrayList;
import java.util.List;

/**
 * 管理端 Vault 副本全局查询与强制解绑。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/admin/replicas")
public class VaultAdminReplicaController extends BaseController {

    private final IVaultAdminService adminService;

    @SaCheckPermission("vault:replica:list")
    @GetMapping("/list")
    public R<PageResult<VaultAdminReplicaVo>> list(@RequestParam(required = false) String vaultId,
                                                   @RequestParam(required = false) String keyword,
                                                   @RequestParam(required = false) String deviceId,
                                                   @RequestParam(required = false) Integer inactiveDays,
                                                   PageQuery pageQuery) {
        Long parsedVaultId = (vaultId == null || vaultId.isBlank()) ? null : parseId(vaultId, "vaultId");
        return R.ok(adminService.listReplicas(parsedVaultId, keyword, deviceId, inactiveDays, pageQuery));
    }

    @SaCheckPermission("vault:replica:remove")
    @Log(title = "Vault副本解绑", businessType = BusinessType.DELETE)
    @RepeatSubmit()
    @DeleteMapping("/{id}")
    public R<Void> kick(@PathVariable String id) {
        adminService.kickReplica(parseId(id, "id"));
        return R.ok();
    }

    @SaCheckPermission("vault:replica:remove")
    @Log(title = "Vault副本批量解绑", businessType = BusinessType.DELETE)
    @RepeatSubmit()
    @DeleteMapping("/batch/{ids}")
    public R<Integer> kickBatch(@PathVariable String ids) {
        if (ids == null || ids.isBlank()) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "ids 不能为空");
        }
        String[] parts = ids.split(",");
        List<Long> parsed = new ArrayList<>(parts.length);
        for (String part : parts) {
            if (!part.isBlank()) {
                parsed.add(parseId(part, "id"));
            }
        }
        return R.ok(adminService.kickReplicas(parsed));
    }

    private static Long parseId(String raw, String label) {
        try {
            return Long.parseLong(raw.trim());
        } catch (Exception ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, label + " 无效");
        }
    }
}
