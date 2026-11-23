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
     * UTF-8 text body for {@code note} / {@code config}. Assets never travel inline any more
     * (design D5): they reference a previously uploaded object through {@link #asset}.
     */
    private String body;

    /**
     * Required when {@code type=asset} (design D5). Removed the former {@code base64Body}
     * transport entirely; a missing reference is a permanent 400.
     */
    private AssetRef asset;

    @Data
    public static class AssetRef {

        /** {@code basics_file.id} returned by {@code POST /vault/v1/vaults/{id}/assets}. */
        @NotBlank
        private String assetId;

        private Long sizeBytes;

        @Size(max = 128)
        private String mimeType;
    }
}
