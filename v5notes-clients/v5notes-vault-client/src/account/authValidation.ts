export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$*@&])[A-Za-z\d#$*@&]{8,30}$/
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthFieldErrorKey =
  | 'accountRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordInvalid'

const MESSAGES: Record<AuthFieldErrorKey, string> = {
  accountRequired: '请输入账号',
  emailInvalid: '邮箱格式不正确',
  passwordRequired: '请输入密码',
  passwordInvalid: '密码须含大小写字母、数字与特殊字符 #$*@&，长度 8–30',
}

export function fieldErrorText(key: AuthFieldErrorKey | null | undefined): string {
  return key ? MESSAGES[key] : ''
}

export function validateLoginAccount(value: string): AuthFieldErrorKey | null {
  const trimmed = value.trim()
  if (!trimmed) return 'accountRequired'
  if (trimmed.includes('@') && (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 50)) return 'emailInvalid'
  return null
}

export function validatePassword(value: string, mode: 'login' | 'register'): AuthFieldErrorKey | null {
  if (!value) return 'passwordRequired'
  if (mode === 'register' && !PASSWORD_PATTERN.test(value)) return 'passwordInvalid'
  return null
}
