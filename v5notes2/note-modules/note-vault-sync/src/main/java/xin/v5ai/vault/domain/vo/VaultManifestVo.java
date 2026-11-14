package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class VaultManifestVo {

    /** Opaque next cursor (string). Empty cloud may return "0". */
    private String cursor;

    private List<VaultChangeVo> changes = new ArrayList<>();

    private Boolean empty;
}
