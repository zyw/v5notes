package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class VaultManifestVo {

    /** Opaque next cursor (string). Empty cloud may return "0". */
    private String cursor;

    private List<VaultChangeVo> changes = new ArrayList<>();

    /**
     * True when more changes remain beyond this page (design §8.2 pagination).
     * Clients must keep requesting with the returned cursor until false.
     */
    private Boolean hasMore;

    private Boolean empty;
}
