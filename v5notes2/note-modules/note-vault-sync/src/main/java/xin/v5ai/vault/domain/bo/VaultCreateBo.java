package xin.v5ai.vault.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VaultCreateBo {

    @NotBlank
    @Size(max = 100)
    private String name;
}
