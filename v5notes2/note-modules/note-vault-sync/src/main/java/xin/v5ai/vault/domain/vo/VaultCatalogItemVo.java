package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Catalog entry for plugin or theme. Not a file-sync manifest row.
 */
@Data
public class VaultCatalogItemVo {

    private String id;
    private String name;
    /** plugin | theme */
    private String kind;
    private String version;
    private String description;
    private String author;
    private String minAppVersion;
    private List<String> permissions = new ArrayList<>();
    private List<String> tags = new ArrayList<>();
    private List<String> networkAllowlist = new ArrayList<>();
    /** Relative package path under /vault/v1/catalog/... */
    private String packagePath;
}
