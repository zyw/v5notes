package xin.v5ai.vault.domain.vo;

import lombok.Data;

@Data
public class VaultFileMetaVo {

    private String fileId;

    private String path;

    private Long remoteRev;

    private String contentHash;

    private Long size;

    private String type;

    private String cursor;
}
