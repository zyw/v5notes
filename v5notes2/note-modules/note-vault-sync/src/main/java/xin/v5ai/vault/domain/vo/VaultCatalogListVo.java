package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class VaultCatalogListVo {

    /**
     * Catalog protocol version — independent of file-sync protocol.
     * Clients must not treat this as SyncEngine rev / manifest version.
     */
    private String catalogProtocolVersion;

    /** Always true for this resource class. */
    private boolean fileSyncResource = false;

    private List<VaultCatalogItemVo> items = new ArrayList<>();
}
