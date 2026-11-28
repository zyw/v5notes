package xin.v5ai.vault.service.model;

/**
 * 解析后的用户生效配额（全局默认 + 未过期用户覆盖）。
 */
public record ResolvedVaultQuota(
    long quotaBytes,
    int replicaLimit,
    long maxFileBytes,
    String planName,
    boolean overridden
) {
}
