package xin.v5ai.vault.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

@Data
@TableName("vault_file_blob")
public class VaultFileBlob implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "content_hash")
    private String contentHash;

    private byte[] content;

    private Long sizeBytes;

    private Date createTime;
}
