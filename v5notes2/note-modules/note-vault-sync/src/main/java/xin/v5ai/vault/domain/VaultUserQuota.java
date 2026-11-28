package xin.v5ai.vault.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * Vault 用户级同步配额覆盖（P2，设计 §3.4.2）。
 */
@Data
@TableName("vault_user_quota")
public class VaultUserQuota implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "user_id", type = IdType.INPUT)
    private Long userId;

    private Long quotaBytes;

    private Integer replicaLimit;

    private Long maxFileBytes;

    private String planName;

    private Date expireTime;

    private String remark;

    private Long createBy;

    private Date createTime;

    private Long updateBy;

    private Date updateTime;
}
