package xin.v5ai.vault.domain.bo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VaultFilePutBo {

    @NotBlank
    @Size(max = 1024)
    private String path;

    /** Existing fileId for update; null/blank for first upload. */
    private String fileId;

    /** Client base revision; 0 or null for create. */
    private Long baseRev;

    @NotBlank
    private String hash;

    /** note | asset | config */
    private String type;

    /**
     * UTF-8 text body (Phase 4). Binary assets may use base64Body instead.
     */
    private String body;

    /** Optional base64 for binary; ignored when body is set. */
    private String base64Body;
}
