/**
 * crypto.js 的行为测试
 * 运行：node tests/crypto.test.mjs （或 npm test）
 *
 * 做法：读取 src/services/crypto.js 的**真实源码**，去掉 export 后在当前运行时执行。
 * 这样测的是真正会上线的代码，而不是复制出来的一份副本。
 * Node 18+ 自带 WebCrypto（crypto.subtle）与 btoa/atob，可直接跑。
 */
import fs from 'node:fs'

const srcPath = new URL('../src/services/crypto.js', import.meta.url)
const src = fs.readFileSync(srcPath, 'utf8')
const code = src.replace(/^export /gm, '')

const mod = new Function(`
  ${code}
  return { deriveMasterKey, encryptWithKey, decryptWithKey, makeVerifier, verifyMasterKey,
           generateSalt, encryptObject, decryptObject, VERIFY_TEXT, bytesToBase64, base64ToBytes }
`)()

const {
  deriveMasterKey, encryptWithKey, decryptWithKey, makeVerifier, verifyMasterKey,
  generateSalt, encryptObject, decryptObject, VERIFY_TEXT,
} = mod

let pass = 0
const fails = []
const eq = (a, b, label) => { if (a === b) pass++; else fails.push(`${label}\n     期望: ${b}\n     实际: ${a}`) }
const ok = (cond, label) => { if (cond) pass++; else fails.push(label) }

async function main() {
  // 依赖可用性
  ok(typeof crypto?.subtle?.deriveKey === 'function', '当前运行时支持 WebCrypto（crypto.subtle）')

  const salt = generateSalt()
  const salt2 = generateSalt()
  ok(salt !== salt2, '每次生成的盐都不同')
  ok(typeof salt === 'string' && salt.length > 10, '盐以 base64 字符串返回')

  const key = await deriveMasterKey('my-secret-123', salt)

  // ── 加解密回环 ─────────────────────────────────────────
  const text = '这是一段需要加密的日记正文 Hello 123'
  const enc = await encryptWithKey(key, text)
  ok(typeof enc.iv === 'string' && typeof enc.ciphertext === 'string', '密文结构为 { iv, ciphertext }')
  eq(await decryptWithKey(key, enc), text, '同一密钥可正确解回原文')

  // ── 相同明文两次加密，密文不同（IV 随机）───────────────
  const enc2 = await encryptWithKey(key, text)
  ok(enc2.ciphertext !== enc.ciphertext, '相同明文两次加密得到不同密文（IV 随机）')
  ok(enc2.iv !== enc.iv, '两次加密的 IV 不同')

  // ── 密码校验块 ─────────────────────────────────────────
  const verifier = await makeVerifier(key)
  eq(await verifyMasterKey(key, verifier), true, '正确密钥可通过校验块验证')

  const wrongKey = await deriveMasterKey('my-secret-124', salt)
  eq(await verifyMasterKey(wrongKey, verifier), false, '错误密码无法通过校验块验证')

  // ── 不同盐派生出的密钥互不通用 ─────────────────────────
  const keyOtherSalt = await deriveMasterKey('my-secret-123', salt2)
  eq(await verifyMasterKey(keyOtherSalt, verifier), false, '同密码但不同盐 → 密钥不同、校验失败')

  // ── 用错误密钥解密必须抛错（而不是返回乱码）────────────
  let threw = false
  try { await decryptWithKey(wrongKey, enc) } catch { threw = true }
  ok(threw, '用错误密钥解密会抛出异常（AES-GCM 认证失败）')

  // ── 对象加解密 ─────────────────────────────────────────
  const obj = { title: '标题', tags: ['a', 'b'], content: { type: 'doc', content: [{ type: 'paragraph' }] } }
  const encObj = await encryptObject(key, obj)
  const back = await decryptObject(key, encObj)
  eq(JSON.stringify(back), JSON.stringify(obj), '对象可加解密回环（标题/标签/正文结构完整）')

  // ── 密文中不应出现明文片段 ─────────────────────────────
  const marker = 'TOP-SECRET-MARKER'
  const encM = await encryptWithKey(key, marker)
  ok(!encM.ciphertext.includes(marker), '密文中不含明文片段')
  ok(!Buffer.from(encM.ciphertext, 'base64').toString('latin1').includes(marker), '解 base64 后也不含明文片段')

  // ── 校验块本身的明文不该泄露 ───────────────────────────
  ok(!JSON.stringify(verifier).includes(VERIFY_TEXT), '校验块中不含其明文内容')

  console.log('')
  if (!fails.length) {
    console.log(`✅ crypto 全部通过（${pass} 项）`)
    process.exit(0)
  } else {
    console.log(`❌ 失败 ${fails.length} 项（通过 ${pass} 项）：\n`)
    fails.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`))
    process.exit(1)
  }
}

main().catch(e => { console.log('运行出错: ' + e.message); process.exit(1) })
