/** Vault 登录设备类型；与 Cloud 的 `client` 区分，对应 sys_client.device_type。 */
export const DEVICE_TYPE = 'vault_client' as const

/**
 * Vault sys_client.client_id（与 Cloud `d9df3c…` 并列）。
 * 可通过 VITE_CLIENT_ID 覆盖；须与后端种子/迁移一致。
 */
export const DEFAULT_CLIENT_ID = 'b8e4f02a5c3d7916f2a0b1d9e7c5f3a1'

/** 双产品边界固定文案（设计 §7 / 计划 §2.2）。 */
export const DUAL_PRODUCT_LINE =
  '同一账号可登录两个客户端；Cloud 笔记与 Vault 库默认不是同一份数据。Cloud 在服务端目录树；Vault 在本机文件夹，可选同步。'

export const STORAGE_KEYS = {
  token: 'v5notes-vault-token',
  refreshToken: 'v5notes-vault-refresh-token',
  username: 'v5notes-vault-username',
  server: 'v5notes-vault-server',
  serverOfficial: 'v5notes-vault-server-official',
  socialIntent: 'v5notes-vault-social-intent',
  socialPending: 'v5notes-vault-social-pending',
  socialConsumed: 'v5notes-vault-social-consumed-codes',
} as const

export const OFFICIAL_SERVER = 'https://v5notes2.v5ai.xin'

export const SOCIAL_CALLBACK_PATH = '/social-callback'

/** 与 Cloud 共用同一登录公钥时可覆盖；缺省与 client2 一致。 */
export const DEFAULT_LOGIN_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu0QumTTAkPSiGQ75RZqpCvpJDWDspRoacrIHdWUbj5SGRcPfHh3QcGh7cQ1nm40sWwfb3jdO1g7yP/smEx4vXn4mjqpztrt5RbYoZlZ2AAAxI6Uxj522NUEWYVBpWqzqxnGw/w2wtfKTd/HSyZi/zXeRONF4G4aH4zCLxsFYKjeemz1y0eLKg8Cfx2dqUffU3yxNf4N7tilthgxw6XSKABjB488CpJMYelDWrtw6W+5c6HaBAYMQfJM2PJqjTnndGokJDS3mGp33Laba+lZeZtf8vt0bYW6rKuLtoqY0pQ0yLvmgty7JvhacInYUQzI7RleMXSGXhVKmK/MFA2dpvwIDAQAB'
