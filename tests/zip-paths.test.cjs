/**
 * electron/lib/zip-paths.js 的单元测试
 * 运行：npm test   （或 node tests/zip-paths.test.cjs）
 *
 * 无第三方依赖；断言失败即以非零码退出。
 */
const path = require('path')
const { parseDiaryEntry, resolveDiaryDest } = require('../electron/lib/zip-paths')

let passed = 0
const failures = []

function eq(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failures.push(`${label}\n     期望: ${e}\n     实际: ${a}`)
  }
}

// ── parseDiaryEntry：正常日记 ─────────────────────────────
eq(parseDiaryEntry('diaries/2026-10-02/abc-123/diary.json'),
  { kind: 'diary', date: '2026-10-02', id: 'abc-123' },
  '正常日记（无顶层目录前缀）')

eq(parseDiaryEntry('mydiary/diaries/2026-10-02/abc-123/diary.json'),
  { kind: 'diary', date: '2026-10-02', id: 'abc-123' },
  '正常日记（带 mydiary/ 前缀）')

eq(parseDiaryEntry('mydiary\\diaries\\2026-10-02\\abc-123\\diary.json'),
  { kind: 'diary', date: '2026-10-02', id: 'abc-123' },
  '正常日记（Windows 反斜杠路径）')

// ── parseDiaryEntry：回收站（本次修复的核心回归点）─────────
eq(parseDiaryEntry('mydiary/.trash/2026-10-02_abc-123/diary.json'),
  { kind: 'trash', folder: '2026-10-02_abc-123' },
  '回收站条目（带前缀）—— 修复前会返回 null 被丢弃')

eq(parseDiaryEntry('.trash/2026-10-02_abc-123/diary.json'),
  { kind: 'trash', folder: '2026-10-02_abc-123' },
  '回收站条目（无前缀）')

eq(parseDiaryEntry('mydiary\\.trash\\2026-10-02_abc-123\\diary.json'),
  { kind: 'trash', folder: '2026-10-02_abc-123' },
  '回收站条目（反斜杠路径）')

// ── parseDiaryEntry：非日记条目应被忽略 ───────────────────
eq(parseDiaryEntry('mydiary/config.json'), null, 'config.json 应忽略')
eq(parseDiaryEntry('mydiary/attachments/xxx.png'), null, '附件应忽略')
eq(parseDiaryEntry('mydiary/attachments/'), null, '附件目录应忽略')
eq(parseDiaryEntry('mydiary/diaries/2026-10-02/abc/other.json'), null, '非 diary.json 应忽略')
eq(parseDiaryEntry('mydiary/.trash/'), null, '回收站目录条目应忽略')
eq(parseDiaryEntry('mydiary/'), null, '顶层目录应忽略')

// ── parseDiaryEntry：异常输入不应抛错 ─────────────────────
eq(parseDiaryEntry(''), null, '空字符串')
eq(parseDiaryEntry(null), null, 'null')
eq(parseDiaryEntry(undefined), null, 'undefined')

// ── resolveDiaryDest：落盘路径 ────────────────────────────
const LIB = 'C:/diary-lib'

eq(resolveDiaryDest(LIB, { kind: 'diary', date: '2026-10-02', id: 'abc' }),
  path.join(LIB, 'diaries', '2026-10-02', 'abc', 'diary.json'),
  '正常日记落盘到 diaries/<date>/<id>/diary.json')

eq(resolveDiaryDest(LIB, { kind: 'trash', folder: '2026-10-02_abc' }),
  path.join(LIB, '.trash', '2026-10-02_abc', 'diary.json'),
  '回收站日记落盘到 .trash/<date>_<id>/diary.json')

// ── 结果 ──────────────────────────────────────────────────
console.log('')
if (failures.length === 0) {
  console.log(`✅ zip-paths 全部通过（${passed} 项）`)
  process.exit(0)
} else {
  console.log(`❌ 失败 ${failures.length} 项（通过 ${passed} 项）：\n`)
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`))
  process.exit(1)
}
