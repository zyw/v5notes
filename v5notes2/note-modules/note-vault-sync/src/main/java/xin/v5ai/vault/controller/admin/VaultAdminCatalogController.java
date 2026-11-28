package xin.v5ai.vault.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.bo.admin.VaultCatalogSaveBo;
import xin.v5ai.vault.domain.bo.admin.VaultCatalogStatusBo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminCatalogDetailVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminCatalogItemVo;
import xin.v5ai.vault.domain.vo.admin.VaultCatalogZipPreviewVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.IVaultAdminCatalogService;

import java.io.InputStream;

/**
 * 管理端 Vault 官方扩展与主题目录管理（P3）。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/admin/catalog")
public class VaultAdminCatalogController extends BaseController {

    private final IVaultAdminCatalogService catalogService;

    @SaCheckPermission("vault:catalog:list")
    @GetMapping("/list")
    public R<PageResult<VaultAdminCatalogItemVo>> list(@RequestParam(required = false) String kind,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String keyword,
                                                       PageQuery pageQuery) {
        return R.ok(catalogService.list(kind, status, keyword, pageQuery));
    }

    @SaCheckPermission("vault:catalog:query")
    @GetMapping("/{id}")
    public R<VaultAdminCatalogDetailVo> detail(@PathVariable String id) {
        return R.ok(catalogService.detail(id));
    }

    @SaCheckPermission("vault:catalog:add")
    @PostMapping(value = "/parse-zip", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public R<VaultCatalogZipPreviewVo> parseZip(@RequestParam("file") MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "请选择 zip 扩展包文件");
        }
        try (InputStream in = file.getInputStream()) {
            return R.ok(catalogService.parseZip(in));
        }
    }

    @SaCheckPermission("vault:catalog:add")
    @Log(title = "Vault扩展目录", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public R<VaultAdminCatalogDetailVo> create(@Valid @RequestBody VaultCatalogSaveBo bo) {
        return R.ok(catalogService.create(bo));
    }

    @SaCheckPermission("vault:catalog:edit")
    @Log(title = "Vault扩展目录", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/{id}")
    public R<VaultAdminCatalogDetailVo> update(@PathVariable String id, @Valid @RequestBody VaultCatalogSaveBo bo) {
        return R.ok(catalogService.update(id, bo));
    }

    @SaCheckPermission("vault:catalog:publish")
    @Log(title = "Vault扩展上下架", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/{id}/status")
    public R<Void> updateStatus(@PathVariable String id, @Valid @RequestBody VaultCatalogStatusBo bo) {
        catalogService.updateStatus(id, bo.getStatus());
        return R.ok();
    }

    @SaCheckPermission("vault:catalog:remove")
    @Log(title = "Vault扩展目录", businessType = BusinessType.DELETE)
    @RepeatSubmit()
    @DeleteMapping("/{id}")
    public R<Void> remove(@PathVariable String id) {
        catalogService.delete(id);
        return R.ok();
    }
}
