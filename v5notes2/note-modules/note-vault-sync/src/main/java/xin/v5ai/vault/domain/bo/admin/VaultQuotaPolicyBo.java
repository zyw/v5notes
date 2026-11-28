package xin.v5ai.vault.domain.bo.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 全局默认 Vault 同步策略更新请求（P2）。
 */
@Data
public class VaultQuotaPolicyBo {

    /** 默认单用户容量上限（字节，最低 10MB）。 */
    @NotNull(message = "默认容量上限不能为空")
    @Min(value = 10L * 1024 * 1024, message = "默认容量上限不能低于 10MB")
    private Long defaultQuotaBytes;

    /** 默认单库最大绑定副本数（1~50）。 */
    @NotNull(message = "默认副本上限不能为空")
    @Min(value = 1, message = "默认副本上限至少为 1")
    @Max(value = 50, message = "默认副本上限不能超过 50")
    private Integer defaultReplicaLimit;

    /** 默认单文件上限（字节，最低 1MB，且不超过 spring.servlet.multipart.max-file-size）。 */
    @NotNull(message = "默认单文件上限不能为空")
    @Min(value = 1024L * 1024, message = "默认单文件上限不能低于 1MB")
    private Long defaultMaxFileBytes;

    /** 墓碑保留天数（最低 30 天）。 */
    @NotNull(message = "墓碑保留天数不能为空")
    @Min(value = 30, message = "墓碑保留天数不能少于 30 天")
    @Max(value = 3650, message = "墓碑保留天数不能超过 3650 天")
    private Integer tombstoneRetentionDays;

    /** 孤儿附件宽限天数（最低 1 天）。 */
    @NotNull(message = "孤儿附件宽限天数不能为空")
    @Min(value = 1, message = "孤儿附件宽限天数不能少于 1 天")
    @Max(value = 365, message = "孤儿附件宽限天数不能超过 365 天")
    private Integer orphanAssetGraceDays;
}
