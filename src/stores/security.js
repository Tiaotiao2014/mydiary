import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import {
  generateSalt, deriveMasterKey, makeVerifier, verifyMasterKey,
  encryptObject, decryptObject,
} from '@/services/crypto'

const DEFAULT_ITERATIONS = 210_000

/**
 * 安全状态（主密码 / 会话密钥）
 *
 * 关键点：**主密钥只存在于内存**。
 * 磁盘（库的 config.json）里只保留三样东西：盐、迭代次数、校验块 —— 都由密码派生，
 * 无法反推出密码本身。应用退出后密钥即失效，必须重新输入密码。
 */
export const useSecurityStore = defineStore('security', () => {
  const masterKey = shallowRef(null)        // CryptoKey，只存内存，用 shallowRef 避免被代理
  const hasMasterPassword = ref(false)
  const kdfSalt = ref(null)
  const kdfIterations = ref(DEFAULT_ITERATIONS)
  const verifier = ref(null)
  const configLoaded = ref(false)

  const isUnlocked = computed(() => !!masterKey.value)

  /** 从库配置读取主密码相关信息（不含密码本身） */
  async function loadConfig() {
    if (configLoaded.value) return
    if (typeof window !== 'undefined' && window.electronAPI) {
      const c = (await window.electronAPI.getConfig()) || {}
      hasMasterPassword.value = !!c.masterPasswordSet
      kdfSalt.value = c.kdfSalt || null
      kdfIterations.value = c.kdfIterations || DEFAULT_ITERATIONS
      verifier.value = c.verifier || null
    }
    configLoaded.value = true
  }

  /** 强制重新读取并锁定（例如切换日记库后） */
  async function reloadConfig() {
    configLoaded.value = false
    masterKey.value = null
    await loadConfig()
  }

  async function persist(patch) {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // set-config 是整体覆盖写盘，必须先读出旧配置再合并，否则会抹掉主题等其它设置
      const old = (await window.electronAPI.getConfig()) || {}
      await window.electronAPI.setConfig({ ...old, ...patch })
    }
  }

  /**
   * 设置（或修改）主密码
   * 会生成新的盐与校验块，设置完成后即处于解锁状态
   */
  async function setMasterPassword(password) {
    if (!password || String(password).length < 6) throw new Error('密码至少 6 位')
    const salt = generateSalt()
    const key = await deriveMasterKey(password, salt, kdfIterations.value)
    const v = await makeVerifier(key)

    await persist({
      masterPasswordSet: true,
      kdfSalt: salt,
      kdfIterations: kdfIterations.value,
      verifier: v,
    })

    kdfSalt.value = salt
    verifier.value = v
    hasMasterPassword.value = true
    masterKey.value = key
    configLoaded.value = true
  }

  /** 用密码解锁；密码错误返回 false */
  async function unlock(password) {
    if (!hasMasterPassword.value || !kdfSalt.value || !verifier.value) return false
    const key = await deriveMasterKey(password, kdfSalt.value, kdfIterations.value)
    if (!(await verifyMasterKey(key, verifier.value))) return false
    masterKey.value = key
    return true
  }

  /** 立即锁定：丢弃内存中的密钥 */
  function lock() {
    masterKey.value = null
  }

  /** 用会话密钥加密对象（未解锁时抛错，避免"以为加密了其实没加"） */
  async function encrypt(obj) {
    if (!masterKey.value) throw new Error('尚未解锁，无法加密')
    return encryptObject(masterKey.value, obj)
  }

  /** 用会话密钥解密对象 */
  async function decrypt(payload) {
    if (!masterKey.value) throw new Error('尚未解锁，无法解密')
    return decryptObject(masterKey.value, payload)
  }

  /**
   * 移除主密码
   * 只要还有日记处于加密状态就拒绝 —— 否则那些日记将永久无法打开。
   */
  async function removeMasterPassword(encryptedCount = 0) {
    if (encryptedCount > 0) {
      throw new Error(`还有 ${encryptedCount} 篇日记处于加密状态。请先打开它们并取消加密，再移除主密码。`)
    }
    const old = (await window.electronAPI?.getConfig()) || {}
    const next = { ...old }
    delete next.masterPasswordSet
    delete next.kdfSalt
    delete next.kdfIterations
    delete next.verifier
    if (window.electronAPI) await window.electronAPI.setConfig(next)

    hasMasterPassword.value = false
    kdfSalt.value = null
    verifier.value = null
    masterKey.value = null
  }

  return {
    masterKey, isUnlocked, hasMasterPassword, kdfSalt, kdfIterations, verifier, configLoaded,
    loadConfig, reloadConfig, setMasterPassword, unlock, lock, encrypt, decrypt, removeMasterPassword,
  }
})
