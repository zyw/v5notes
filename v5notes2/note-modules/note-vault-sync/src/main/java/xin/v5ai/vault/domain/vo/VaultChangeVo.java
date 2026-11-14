package xin.v5ai.vault.domain.vo;

import lombok.Data;

@Data
public class VaultChangeVo {

    /** upsert | delete | rename */
    private String op;

    private String path;

    private String from;

    private String fileId;

    private Long remoteRev;

    private String contentHash;

    private Long size;

    private String type;
}
