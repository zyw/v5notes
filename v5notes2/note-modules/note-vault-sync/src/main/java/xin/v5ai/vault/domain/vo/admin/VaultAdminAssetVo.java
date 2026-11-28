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

    private String vaultName;

    private String userId;

    private String userName;

    private String nickName;

    private String sha256;

    private long sizeBytes;

    private String mimeType;

    private String storageKey;

    private String configId;

    private String configName;

    private String backend;

    private String fileName;

    private String samplePath;

    private long refCount;

    private Date createTime;
}
