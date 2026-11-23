package xin.v5ai.vault.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.util.Date;

/**
 * Link between a vault file (metadata + revision) and the basic-file object holding its bytes.
 *
 * <p>One asset can back several paths (same content, several names), so this table is the
 * reference count that decides when the stored object may be deleted (design §6.1).</p>
 */
@Data
@TableName("vault_asset_ref")
public class VaultAssetRef implements Serializable {

    private static final long serialVersionUID = 1L;

    /** {@code vault_file.id}; at most one storage reference per file. */
    @TableId
    private Long fileId;

    /** {@code basics_file.id}, stringified on the wire. */
    private Long assetId;

    private Long vaultId;

    /** Normalized {@code sha256:<hex>}; unique per vault so identical bytes store once. */
    private String sha256;

    private Long sizeBytes;

    private String mimeType;

    /** Key inside the backend: {@code vault/{vaultId}/{sha256[:2]}/{sha256}}. */
    private String storageKey;

    /** File config id holding the bytes; reads follow this, never the current master config. */
    private Long configId;

    private String backend;

    private Date createTime;
}
