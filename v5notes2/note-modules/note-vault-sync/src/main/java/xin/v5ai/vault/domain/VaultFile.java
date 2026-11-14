package xin.v5ai.vault.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

@Data
@TableName("vault_file")
public class VaultFile implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "id")
    private Long id;

    private Long vaultId;

    /** Display path (NFC, original case). */
    private String path;

    /** Identity key (NFC + case-fold). */
    private String identityKey;

    private String fileType;

    private String contentHash;

    private Long sizeBytes;

    private Long rev;

    /** 0 = live, 1 = tombstone. */
    private Integer deleted;

    private Date createTime;

    private Date updateTime;
}
