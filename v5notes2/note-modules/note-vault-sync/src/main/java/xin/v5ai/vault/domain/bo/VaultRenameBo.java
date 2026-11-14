package xin.v5ai.vault.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VaultRenameBo {

    @NotBlank
    @Size(max = 1024)
    private String from;

    @NotBlank
    @Size(max = 1024)
    private String to;

    @NotNull
    private Long baseRev;
}
