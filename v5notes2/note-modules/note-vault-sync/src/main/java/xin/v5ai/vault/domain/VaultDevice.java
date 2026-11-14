package xin.v5ai.vault.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

@Data
@TableName("vault_device")
public class VaultDevice implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "id")
    private Long id;

    private Long vaultId;

    private Long userId;

    private String deviceId;

    private String clientInfo;

    private Date lastSeenAt;

    private Date createTime;

    private Date updateTime;
}
