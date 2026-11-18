package xin.v5ai.vault.domain.bo;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Batch of file writes (design §8.2 recommended endpoint {@code POST /files/batch}).
 * The server applies the items sequentially inside one transaction — all succeed or none do.
 */
@Data
public class VaultFileBatchBo {

    @NotEmpty
    @Size(max = 200)
    @Valid
    private List<VaultFilePutBo> files;
}
