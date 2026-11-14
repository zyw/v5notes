package xin.v5ai.vault.domain.vo;

import lombok.Data;

@Data
public class VaultFileContentVo {

    private String fileId;

    private String path;

    private Long remoteRev;

    private String contentHash;

    private Long size;

    private String type;

    /** UTF-8 text when decodable; otherwise null and use base64Body. */
    private String body;

    private String base64Body;
}
