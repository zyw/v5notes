package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.Date;

/**
 * 管理端库内文件元数据行（不含正文）。
 */
@Data
public class VaultAdminFileVo {

    private String fileId;

    private String vaultId;

    private String path;

    private String fileType;

    private String contentHash;

    private long sizeBytes;

    private long rev;

    private boolean deleted;

    private Date createTime;

    private Date updateTime;
}
