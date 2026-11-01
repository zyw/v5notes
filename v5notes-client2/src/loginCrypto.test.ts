import { describe, expect, it } from 'vitest'
import CryptoJS from 'crypto-js'
import JSEncrypt from 'jsencrypt'
import { encryptLogin } from './loginCrypto'

describe('encrypted login protocol', () => {
  it('sends AES encrypted JSON and an RSA encrypted base64 AES key', () => {
    const rsa = new JSEncrypt({ default_key_size: '512' })
    const payload = JSON.stringify({ username: '测试', password: 'secret' })
    const result = encryptLogin(payload, rsa.getPublicKey())
    const encodedKey = rsa.decrypt(result.key)
    expect(encodedKey).toBeTruthy()
    const aesKey = CryptoJS.enc.Base64.parse(encodedKey as string)
    const decoded = CryptoJS.AES.decrypt(result.body, aesKey, {
      mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7,
    }).toString(CryptoJS.enc.Utf8)
    expect(decoded).toBe(payload)
    expect(result.body).not.toContain('secret')
  })
})
