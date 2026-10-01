/**
 * 加密服务
 * 使用 Web Crypto API（Electron/Chromium 内置，无需 native 依赖）
 * - 密钥派生：PBKDF2（Argon2id 在 Web Crypto 中无原生支持，用 PBKDF2 + 足够迭代次数）
 * - 加密：AES-256-GCM
 */

const PBKDF2_ITERATIONS = 210_000
const SALT_SIZE = 16   // bytes
const IV_SIZE = 12     // bytes

function bytesToBase64(bytes) {
  let binary = ''
  const arr = new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i)
  }
  return arr
}

async function deriveKey(password, salt) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * 加密内容
 * @param {string} plaintext
 * @param {string} password
 * @returns {Promise<{ salt: string, iv: string, ciphertext: string }>}
 */
export async function encryptContent(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE))
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE))
  const key = await deriveKey(password, salt)

  const encoder = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(encrypted),
  }
}

/**
 * 解密内容
 * @param {{ salt: string, iv: string, ciphertext: string }} data
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function decryptContent(data, password) {
  const salt = base64ToBytes(data.salt)
  const iv = base64ToBytes(data.iv)
  const ciphertext = base64ToBytes(data.ciphertext)
  const key = await deriveKey(password, salt)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return new TextDecoder().decode(decrypted)
}

/**
 * 验证密码是否匹配（用一段已知明文测试解密）
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(data, password) {
  try {
    await decryptContent(data, password)
    return true
  } catch {
    return false
  }
}
