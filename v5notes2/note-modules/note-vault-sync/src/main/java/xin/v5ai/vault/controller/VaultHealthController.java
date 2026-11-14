package xin.v5ai.vault.controller;

import cn.dev33.satoken.annotation.SaIgnore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.web.core.BaseController;

import java.util.Map;

/**
 * Phase 0 placeholder for Vault Sync API health.
 * Real vault CRUD arrives in Phase 4 under {@code /vault/v1/...}.
 */
@RestController
@RequestMapping("/vault/v1")
public class VaultHealthController extends BaseController {

    @SaIgnore
    @GetMapping("/health")
    public R<Map<String, Object>> health() {
        return R.ok(Map.of(
            "module", "note-vault-sync",
            "status", "up",
            "apiPrefix", "/vault/v1"
        ));
    }
}
