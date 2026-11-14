package xin.v5ai.vault.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VaultBindBo {

    @NotBlank
    @Size(max = 64)
    private String deviceId;

    @Size(max = 255)
    private String clientInfo;
}
