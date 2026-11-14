package xin.v5ai.vault.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

@Data
@TableName("vault_change")
public class VaultChange implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** Opaque monotonic cursor (= snowflake id). */
    @TableId(value = "id")
    private Long id;

    private Long vaultId;

    private Long fileId;

    /** upsert | delete | rename */
    private String op;

    private String path;

    private String fromPath;

    private String contentHash;

    private Long sizeBytes;

    private Long remoteRev;

    private Date createTime;
}
