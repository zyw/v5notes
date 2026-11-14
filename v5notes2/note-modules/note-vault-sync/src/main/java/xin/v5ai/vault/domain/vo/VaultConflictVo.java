package xin.v5ai.vault.domain.vo;

import lombok.Data;

@Data
public class VaultConflictVo {

    private String code = "vault.conflict.rev";

    private String path;

    private String fileId;

    private Long remoteRev;

    private String contentHash;

    private Long size;
}
