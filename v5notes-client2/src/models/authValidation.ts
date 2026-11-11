/** 与后端 RegexConstants.PASSWORD 保持一致 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$*@&])[A-Za-z\d#$*@&]{8,30}$/

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 后端邮件验证码为 6 位数字 */
export const EMAIL_CODE_PATTERN = /^\d{6}$/

export type AuthFieldErrorKey =
  | 'accountRequired'
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordInvalid'
  | 'emailCodeRequired'
  | 'emailCodeInvalid'

/** 登录账号：用户名或邮箱，非空即可；若含 @ 则按邮箱格式校验 */
export function validateLoginAccount(value: string): AuthFieldErrorKey | null {
  const trimmed = value.trim()
  if (!trimmed) return 'accountRequired'
  if (trimmed.includes('@') && (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 50)) return 'emailInvalid'
  return null
}

export function validateEmail(value: string): AuthFieldErrorKey | null {
  const trimmed = value.trim()
  if (!trimmed) return 'emailRequired'
  if (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 50) return 'emailInvalid'
  return null
}

export function validatePassword(value: string, mode: 'login' | 'register'): AuthFieldErrorKey | null {
  if (!value) return 'passwordRequired'
  if (mode === 'register' && !PASSWORD_PATTERN.test(value)) return 'passwordInvalid'
  return null
}

export function validateEmailCode(value: string): AuthFieldErrorKey | null {
  const trimmed = value.trim()
  if (!trimmed) return 'emailCodeRequired'
  if (!EMAIL_CODE_PATTERN.test(trimmed)) return 'emailCodeInvalid'
  return null
}
