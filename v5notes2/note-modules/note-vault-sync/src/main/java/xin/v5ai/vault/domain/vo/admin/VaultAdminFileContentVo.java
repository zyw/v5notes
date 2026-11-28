package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

/**
 * 管理端文件只读详情（文本含正文，附件含对象引用元数据）。
 */
@Data
public class VaultAdminFileContentVo {

    private String fileId;

    private String vaultId;

    private String path;

    private String fileType;

    private String contentHash;

    private long sizeBytes;

    private long rev;

    private boolean deleted;

    /** 仅 note/config 返回。 */
    private String body;

    /** 仅 asset 返回。 */
    private String assetId;

    private String mimeType;

    private String storageKey;

    private String configId;

    private String backend;
}
