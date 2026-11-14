package xin.v5ai.vault.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VaultFileDeleteBo {

    @NotBlank
    @Size(max = 1024)
    private String path;

    @NotNull
    private Long baseRev;
}
