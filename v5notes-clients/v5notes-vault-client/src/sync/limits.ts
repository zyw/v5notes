/** Client mirror of backend VaultQuotaRules defaults. */

export const VaultQuotaRules = {
  DEFAULT_QUOTA_BYTES: 1 * 1024 * 1024 * 1024,
  DEFAULT_REPLICA_LIMIT: 3,
  DEFAULT_MAX_FILE_BYTES: 25 * 1024 * 1024,
} as const
