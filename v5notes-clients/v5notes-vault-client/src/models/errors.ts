/**
 * Draft Vault Sync business error codes (design §8.2).
 * Keep in sync with `xin.v5ai.vault.VaultErrorCodes` on the backend.
 */

export const VaultErrorCode = {
  AUTH_UNAUTHORIZED: 'auth.unauthorized',
  QUOTA_EXCEEDED: 'vault.quota.exceeded',
  NOT_FOUND: 'vault.not.found',
  FILE_NOT_FOUND: 'vault.file.not.found',
  CONFLICT_REV: 'vault.conflict.rev',
  FILE_TOO_LARGE: 'vault.file.too.large',
  RATE_LIMITED: 'vault.rate.limited',
  PATH_INVALID: 'vault.path.invalid',
} as const

export type VaultErrorCode = (typeof VaultErrorCode)[keyof typeof VaultErrorCode]

/** Suggested HTTP status for each business code (draft). */
export const VaultErrorHttpStatus: Record<VaultErrorCode, number> = {
  [VaultErrorCode.AUTH_UNAUTHORIZED]: 401,
  [VaultErrorCode.QUOTA_EXCEEDED]: 402,
  [VaultErrorCode.NOT_FOUND]: 404,
  [VaultErrorCode.FILE_NOT_FOUND]: 404,
  [VaultErrorCode.CONFLICT_REV]: 409,
  [VaultErrorCode.FILE_TOO_LARGE]: 413,
  [VaultErrorCode.RATE_LIMITED]: 429,
  [VaultErrorCode.PATH_INVALID]: 400,
}
