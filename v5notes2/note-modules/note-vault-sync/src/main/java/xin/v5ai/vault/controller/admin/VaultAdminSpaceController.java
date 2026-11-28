package xin.v5ai.vault.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.annotation.SaMode;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
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
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.domain.vo.admin.VaultAdminAssetVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminChangeVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminFileContentVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminFileVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminSpaceVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.IVaultAdminService;

import java.io.OutputStream;
import java.util.Locale;

/**
 * 管理端 Vault 云端库、文件清单、附件引用与变更日志管理。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/admin/spaces")
public class VaultAdminSpaceController extends BaseController {

    private final IVaultAdminService adminService;

    @SaCheckPermission("vault:space:list")
    @GetMapping("/list")
    public R<PageResult<VaultAdminSpaceVo>> list(@RequestParam(required = false) String keyword,
                                                 @RequestParam(required = false) String name,
                                                 @RequestParam(required = false) String status,
                                                 PageQuery pageQuery) {
        return R.ok(adminService.listSpaces(keyword, name, status, pageQuery));
    }

    @SaCheckPermission("vault:space:query")
    @GetMapping("/{vaultId}")
    public R<VaultAdminSpaceVo> detail(@PathVariable String vaultId) {
        return R.ok(adminService.getSpace(parseId(vaultId, "vaultId")));
    }

    @SaCheckPermission("vault:space:remove")
    @Log(title = "Vault云端库", businessType = BusinessType.DELETE)
    @RepeatSubmit()
    @DeleteMapping("/{vaultId}")
    public R<Void> remove(@PathVariable String vaultId) {
        adminService.deleteSpace(parseId(vaultId, "vaultId"));
        return R.ok();
    }

    @SaCheckPermission("vault:file:list")
    @GetMapping("/{vaultId}/files")
    public R<PageResult<VaultAdminFileVo>> files(@PathVariable String vaultId,
                                                 @RequestParam(required = false) String keyword,
                                                 @RequestParam(required = false) String fileType,
                                                 @RequestParam(required = false, defaultValue = "false") Boolean includeDeleted,
                                                 PageQuery pageQuery) {
        return R.ok(adminService.listFiles(parseId(vaultId, "vaultId"), keyword, fileType, includeDeleted, pageQuery));
    }

    /**
     * 只读查看文件正文或附件元数据。强制记录审计日志。
     */
    @SaCheckPermission("vault:file:content")
    @Log(title = "Vault文件预览", businessType = BusinessType.OTHER, isSaveResponseData = false)
    @GetMapping("/{vaultId}/files/{fileId}/content")
    public R<VaultAdminFileContentVo> fileContent(@PathVariable String vaultId,
                                                  @PathVariable String fileId) {
        return R.ok(adminService.getFileContent(parseId(vaultId, "vaultId"), parseId(fileId, "fileId")));
    }

    /**
     * 管理员受控流式下载附件（不暴露免鉴权基础文件端点）。
     */
    @SaCheckPermission(value = {"vault:file:content", "vault:asset:content"}, mode = SaMode.OR)
    @Log(title = "Vault附件下载", businessType = BusinessType.OTHER, isSaveResponseData = false)
    @GetMapping("/{vaultId}/assets/{assetId}/content")
    public void assetContent(@PathVariable String vaultId,
                             @PathVariable String assetId,
                             HttpServletResponse response) throws Exception {
        VaultAssetRef ref = adminService.requireAssetForAdminRead(parseId(vaultId, "vaultId"), assetId);
        response.setHeader("X-Content-Hash", ref.getSha256());
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (ref.getMimeType() != null && !ref.getMimeType().isBlank()) {
            response.setContentType(ref.getMimeType());
            String lowerMime = ref.getMimeType().toLowerCase(Locale.ROOT);
            if (lowerMime.contains("html") || lowerMime.contains("svg") || lowerMime.contains("javascript")) {
                response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment");
            }
        }
        if (ref.getSizeBytes() != null) {
            response.setContentLengthLong(ref.getSizeBytes());
        }
        try (OutputStream out = response.getOutputStream()) {
            adminService.streamAssetContent(ref, out);
            out.flush();
        }
    }

    /**
     * 协议级墓碑删除，确保客户端增量同步正常收敛。
     */
    @SaCheckPermission("vault:file:remove")
    @Log(title = "Vault文件墓碑删除", businessType = BusinessType.DELETE)
    @RepeatSubmit()
    @DeleteMapping("/{vaultId}/files/{fileId}")
    public R<Void> removeFile(@PathVariable String vaultId, @PathVariable String fileId) {
        adminService.deleteFile(parseId(vaultId, "vaultId"), parseId(fileId, "fileId"));
        return R.ok();
    }

    @SaCheckPermission("vault:file:list")
    @GetMapping("/{vaultId}/assets")
    public R<PageResult<VaultAdminAssetVo>> assets(@PathVariable String vaultId,
                                                   @RequestParam(required = false) String keyword,
                                                   PageQuery pageQuery) {
        return R.ok(adminService.listAssets(parseId(vaultId, "vaultId"), keyword, pageQuery));
    }

    @SaCheckPermission("vault:space:query")
    @GetMapping("/{vaultId}/changes")
    public R<PageResult<VaultAdminChangeVo>> changes(@PathVariable String vaultId,
                                                     @RequestParam(required = false) String op,
                                                     @RequestParam(required = false) String keyword,
                                                     PageQuery pageQuery) {
        return R.ok(adminService.listChanges(parseId(vaultId, "vaultId"), op, keyword, pageQuery));
    }

    private static Long parseId(String raw, String label) {
        try {
            return Long.parseLong(raw.trim());
        } catch (Exception ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, label + " 无效");
        }
    }
}
