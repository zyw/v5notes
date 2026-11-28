package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.Date;

/**
 * 管理端库内附件引用聚合行。
 */
@Data
public class VaultAdminAssetVo {

    private String assetId;

    private String vaultId;

    private String sha256;

    private long sizeBytes;

    private String mimeType;

    private String storageKey;

    private String configId;

    private String backend;

    private long refCount;

    private Date createTime;
}
