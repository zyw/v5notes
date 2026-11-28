package xin.v5ai.vault.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.annotation.SaMode;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.vo.admin.VaultAdminAssetVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.IVaultAdminService;

/**
 * 管理端 Vault 附件跨库同步列表查询。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/admin/assets")
public class VaultAdminAssetController extends BaseController {

    private final IVaultAdminService adminService;

    @SaCheckPermission(value = {"vault:asset:list", "vault:file:list"}, mode = SaMode.OR)
    @GetMapping("/list")
    public R<PageResult<VaultAdminAssetVo>> list(@RequestParam(required = false) String vaultId,
                                                 @RequestParam(required = false) String keyword,
                                                 @RequestParam(required = false) String backend,
                                                 @RequestParam(required = false) String mimePrefix,
                                                 PageQuery pageQuery) {
        Long parsedVaultId = (vaultId == null || vaultId.isBlank()) ? null : parseId(vaultId, "vaultId");
        return R.ok(adminService.listAssets(parsedVaultId, keyword, backend, mimePrefix, pageQuery));
    }

    private static Long parseId(String raw, String label) {
        try {
            return Long.parseLong(raw.trim());
        } catch (Exception ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, label + " 无效");
        }
    }
}
