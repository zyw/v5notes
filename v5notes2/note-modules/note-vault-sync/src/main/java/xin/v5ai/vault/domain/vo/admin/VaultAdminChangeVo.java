package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.Date;

/**
 * 管理端变更日志（manifest）审计行。
 */
@Data
public class VaultAdminChangeVo {

    private String cursor;

    private String vaultId;

    private String fileId;

    private String op;

    private String path;

    private String fromPath;

    private String contentHash;

    private Long sizeBytes;

    private long remoteRev;

    private Date createTime;
}
