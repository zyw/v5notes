package xin.v5ai.vault.service;

import org.junit.jupiter.api.Test;
import xin.v5ai.vault.catalog.CatalogProtocol;
import xin.v5ai.vault.domain.vo.VaultCatalogListVo;
import xin.v5ai.vault.domain.vo.VaultCatalogPackageVo;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VaultCatalogServiceTest {

    private final VaultCatalogService service = new VaultCatalogService();

    @Test
    void listIsNonFileSyncAndIndependentVersion() {
        VaultCatalogListVo list = service.list(null);
        assertEquals(CatalogProtocol.PROTOCOL_VERSION, list.getCatalogProtocolVersion());
        assertFalse(list.isFileSyncResource());
        assertTrue(list.getItems().stream().anyMatch(i -> "plugin".equals(i.getKind())));
        assertTrue(list.getItems().stream().anyMatch(i -> "theme".equals(i.getKind())));
    }

    @Test
    void filterByKind() {
        assertEquals(1, service.list("plugin").getItems().size());
        assertEquals(1, service.list("theme").getItems().size());
    }

    @Test
    void packageContainsInstallFiles() {
        VaultCatalogPackageVo pkg = service.packageOf("safe-fetch-demo");
        assertFalse(pkg.isFileSyncResource());
        assertTrue(pkg.getFiles().containsKey("manifest.json"));
        assertTrue(pkg.getFiles().containsKey("main.js"));
    }

    @Test
    void rejectsPublishingTags() {
        assertTrue(VaultCatalogService.hasForbiddenTag(List.of("publishing")));
        assertTrue(VaultCatalogService.hasForbiddenTag(List.of("Publish")));
        assertFalse(VaultCatalogService.hasForbiddenTag(List.of("demo", "network")));
    }
}
