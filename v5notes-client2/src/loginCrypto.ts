import CryptoJS from 'crypto-js'
import JSEncrypt from 'jsencrypt'

export function encryptLogin(body: string, publicKey: string): { body: string; key: string } {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const password = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
  const aes = CryptoJS.enc.Utf8.parse(password)
  const rsa = new JSEncrypt()
  rsa.setPublicKey(publicKey)
  const key = rsa.encrypt(CryptoJS.enc.Base64.stringify(aes))
  if (!key) throw new Error('登录加密失败：请检查服务器公钥')
  return {
    key,
    body: CryptoJS.AES.encrypt(body, aes, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }).toString(),
  }
}
