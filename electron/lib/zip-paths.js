/**
 * 备份包内的路径解析规则（纯函数，无副作用，可单测）
 *
 * 目录约定：
 *   正常日记：diaries/<date>/<id>/diary.json
 *   回收站：  .trash/<date>_<id>/diary.json
 *
 * 为什么需要解析回收站：导出时整个库目录都会被打包（含 .trash/），
 * 若只识别 diaries/，回收站内容会在导入时被静默丢弃，导致"整库还原"不完整。
 */
const path = require('path')

/**
 * 解析 zip 条目名，判断它是不是一篇日记
 * @param {string} name 条目名（可能含反斜杠）
 * @returns {{kind:'diary'|'trash', date?:string, id?:string, folder?:string} | null}
 */
function parseDiaryEntry(name) {
  const norm = String(name == null ? '' : name).replace(/\\/g, '/')

  // 正常日记
  const m1 = norm.match(/(?:^|\/)diaries\/([^/]+)\/([^/]+)\/diary\.json$/)
  if (m1) return { kind: 'diary', date: m1[1], id: m1[2] }

  // 回收站：目录名本身就是 <date>_<id>，直接沿用原目录名，避免拆分带来的信息损失
  const m2 = norm.match(/(?:^|\/)\.trash\/([^/]+)\/diary\.json$/)
  if (m2) return { kind: 'trash', folder: m2[1] }

  return null
}

/**
 * 计算某篇日记在目标库中的落盘路径
 * @param {string} lib 目标日记库根目录
 * @param {{kind:string, date?:string, id?:string, folder?:string}} parsed
 * @returns {string}
 */
function resolveDiaryDest(lib, parsed) {
  if (parsed.kind === 'trash') {
    return path.join(lib, '.trash', parsed.folder, 'diary.json')
  }
  return path.join(lib, 'diaries', parsed.date, parsed.id, 'diary.json')
}

module.exports = { parseDiaryEntry, resolveDiaryDest }
