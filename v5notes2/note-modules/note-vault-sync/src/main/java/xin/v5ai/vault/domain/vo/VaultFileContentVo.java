package xin.v5ai.vault.domain.vo;

import lombok.Data;
import xin.v5ai.vault.service.model.VaultAssetDownload;

@Data
public class VaultFileContentVo {

    private String fileId;

    private String path;

    private Long remoteRev;

    private String contentHash;

    private Long size;

    private String type;

    /** UTF-8 body for {@code note} / {@code config}; always null for assets (design §4.2.1). */
    private String body;

    /** Set for {@code type=asset}: where to fetch the bytes (direct presigned link or proxy path). */
    private VaultAssetDownload download;
}
