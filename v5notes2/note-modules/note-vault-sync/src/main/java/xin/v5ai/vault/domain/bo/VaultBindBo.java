package xin.v5ai.vault.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VaultBindBo {

    /** Copy identity of the calling vault directory (vault.json binding.replicaId). */
    @NotBlank
    @Size(max = 64)
    private String replicaId;

    /** Machine identity of the caller; shared by every copy on that machine. */
    @NotBlank
    @Size(max = 64)
    private String deviceId;

    @Size(max = 255)
    private String clientInfo;
}
