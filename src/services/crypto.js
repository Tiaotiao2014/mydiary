/**
 * 加密服务（Web Crypto API，Electron/Chromium 内置，无需 native 依赖）
 *
 * 设计：
 *  1) PBKDF2-SHA256（21 万次迭代）+ 随机盐 → 派生 AES-256-GCM **主密钥**
 *  2) 主密钥本身**不可导出**、只存在于内存中，应用退出即失效
 *  3) 磁盘上只保存「盐」与「校验块」，**绝不保存密码本身**
 *  4) 校验块 = 用主密钥加密一段固定明文；验证密码时尝试解开它即可判断对错
 *
 * 为什么用「一次派生、全程复用」而不是每篇日记各配一个盐：
 *  每篇各配盐会导致无法在不解密具体内容的前提下校验密码，
 *  也无法用同一把钥匙解开整库内容，解锁流程会变得支离破碎。
 */

const PBKDF2_ITERATIONS = 210_000
const SALT_SIZE = 16   // bytes
const IV_SIZE = 12     // bytes
const KEY_LENGTH = 256

/** 校验块用的固定明文。内容不重要，关键是"能解开它"即证明密码正确。 */
export const VERIFY_TEXT = 'mydiary-password-check-v1'

// ── base64 转换 ─────────────────────────────────────────────
export function bytesToBase64(bytes) {
  const arr = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

export function base64ToBytes(base64) {
  const binary = atob(base64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return arr
}

/** 生成随机盐（base64） */
export function generateSalt() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(SALT_SIZE)))
}

/**
 * 由密码 + 盐派生主密钥
 * @param {string} password
 * @param {string} saltBase64
 * @param {number} iterations
 * @returns {Promise<CryptoKey>} 不可导出的 AES-GCM 密钥
 */
export async function deriveMasterKey(password, saltBase64, iterations = PBKDF2_ITERATIONS) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,                       // 不可导出：密钥无法被读出，降低泄露面
    ['encrypt', 'decrypt']
  )
}

/**
 * 用指定密钥加密文本
 * @returns {Promise<{ iv: string, ciphertext: string }>}
 */
export async function encryptWithKey(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(encrypted) }
}

/**
 * 用指定密钥解密
 * @param {{ iv: string, ciphertext: string }} payload
 * @returns {Promise<string>}
 */
export async function decryptWithKey(key, payload) {
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext)
  )
  return new TextDecoder().decode(plainBuf)
}

/** 生成校验块 */
export async function makeVerifier(key) {
  return encryptWithKey(key, VERIFY_TEXT)
}

/**
 * 校验密码是否正确：能解开校验块即为正确
 * @returns {Promise<boolean>}
 */
export async function verifyMasterKey(key, verifier) {
  try {
    const text = await decryptWithKey(key, verifier)
    return text === VERIFY_TEXT
  } catch {
    return false
  }
}

/** 用主密钥加密任意对象（转成 JSON 再加密） */
export async function encryptObject(key, obj) {
  return encryptWithKey(key, JSON.stringify(obj))
}

/** 解密并解析回对象 */
export async function decryptObject(key, payload) {
  return JSON.parse(await decryptWithKey(key, payload))
}
