import { describe, expect, it } from 'vitest'
import { validateEmail, validateEmailCode, validateLoginAccount, validatePassword } from './authValidation'

describe('authValidation', () => {
  it('accepts a valid register password', () => {
    expect(validatePassword('Abcd123#', 'register')).toBeNull()
    expect(validatePassword('Xy9$zzzz', 'register')).toBeNull()
  })

  it('rejects weak register passwords', () => {
    expect(validatePassword('abcdefgh', 'register')).toBe('passwordInvalid')
    expect(validatePassword('Abcdefgh', 'register')).toBe('passwordInvalid')
    expect(validatePassword('Abcd1234', 'register')).toBe('passwordInvalid')
    expect(validatePassword('Abcd123!', 'register')).toBe('passwordInvalid')
    expect(validatePassword('Ab1#', 'register')).toBe('passwordInvalid')
  })

  it('only requires non-empty password on login', () => {
    expect(validatePassword('weak', 'login')).toBeNull()
    expect(validatePassword('', 'login')).toBe('passwordRequired')
  })

  it('validates email and code', () => {
    expect(validateEmail('a@b.co')).toBeNull()
    expect(validateEmail('')).toBe('emailRequired')
    expect(validateEmail('not-an-email')).toBe('emailInvalid')
    expect(validateEmailCode('123456')).toBeNull()
    expect(validateEmailCode('1234')).toBe('emailCodeInvalid')
    expect(validateEmailCode('')).toBe('emailCodeRequired')
  })

  it('accepts username or email as login account', () => {
    expect(validateLoginAccount('zyw')).toBeNull()
    expect(validateLoginAccount('a@b.co')).toBeNull()
    expect(validateLoginAccount('')).toBe('accountRequired')
    expect(validateLoginAccount('bad@')).toBe('emailInvalid')
  })
})
