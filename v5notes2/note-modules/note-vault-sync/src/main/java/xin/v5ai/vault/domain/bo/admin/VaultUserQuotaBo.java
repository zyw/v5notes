package xin.v5ai.vault.domain.bo.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Date;

/**
 * 用户级 Vault 配额覆盖更新请求（P2）。字段为 null 时表示继承全局默认。
 */
@Data
public class VaultUserQuotaBo {

    @Min(value = 10L * 1024 * 1024, message = "容量上限不能低于 10MB")
    private Long quotaBytes;

    @Min(value = 1, message = "副本上限至少为 1")
    @Max(value = 50, message = "副本上限不能超过 50")
    private Integer replicaLimit;

    @Min(value = 1024L * 1024, message = "单文件上限不能低于 1MB")
    private Long maxFileBytes;

    @Size(max = 64, message = "套餐标识长度不能超过 64")
    private String planName;

    private Date expireTime;

    @Size(max = 255, message = "备注长度不能超过 255")
    private String remark;
}
