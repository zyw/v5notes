package xin.v5ai.vault.controller;

import cn.dev33.satoken.annotation.SaIgnore;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.catalog.CatalogProtocol;
import xin.v5ai.vault.domain.vo.VaultCatalogItemVo;
import xin.v5ai.vault.domain.vo.VaultCatalogListVo;
import xin.v5ai.vault.domain.vo.VaultCatalogPackageVo;
import xin.v5ai.vault.service.VaultCatalogService;

/**
 * Plugin/theme catalog (Phase 7).
 * <p>
 * Route prefix {@code /vault/v1/catalog/...} is <strong>not</strong> a file-sync resource.
 * Catalog protocol version is independent of SyncEngine manifest/rev protocol (plan default A).
 */
@SaIgnore
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/v1/catalog")
public class VaultCatalogController extends BaseController {

    private final VaultCatalogService catalogService;

    @GetMapping("/plugins")
    public R<VaultCatalogListVo> list(
        @RequestParam(value = "kind", required = false) String kind,
        HttpServletResponse response
    ) {
        stampCatalogHeaders(response);
        return R.ok(catalogService.list(kind));
    }

    @GetMapping("/plugins/{id}")
    public R<VaultCatalogItemVo> get(@PathVariable("id") String id, HttpServletResponse response) {
        stampCatalogHeaders(response);
        return R.ok(catalogService.get(id));
    }

    @GetMapping("/plugins/{id}/package")
    public R<VaultCatalogPackageVo> packageOf(
        @PathVariable("id") String id,
        HttpServletResponse response
    ) {
        stampCatalogHeaders(response);
        return R.ok(catalogService.packageOf(id));
    }

    private static void stampCatalogHeaders(HttpServletResponse response) {
        response.setHeader(CatalogProtocol.HEADER_VERSION, CatalogProtocol.PROTOCOL_VERSION);
        response.setHeader(CatalogProtocol.HEADER_KIND, CatalogProtocol.RESOURCE_KIND);
    }
}
