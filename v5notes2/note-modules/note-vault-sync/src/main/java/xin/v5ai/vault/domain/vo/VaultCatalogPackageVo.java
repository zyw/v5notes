package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Installable package payload for catalog install (vertical slice: JSON files map, not zip).
 */
@Data
public class VaultCatalogPackageVo {

    private String catalogProtocolVersion;
    private boolean fileSyncResource = false;
    private String id;
    private String kind;
    private String version;
    /** filename -> text content (manifest.json, main.js, theme.css, …) */
    private Map<String, String> files = new LinkedHashMap<>();
}
