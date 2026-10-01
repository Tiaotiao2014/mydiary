// 文件系统操作封装（通过 IPC 调用 Electron 主进程）
export async function readDiaryList(libraryPath) {
  // TODO: 读取 diaries/ 目录下所有 diary.json
  return []
}

export async function saveDiary(libraryPath, diaryData) {
  // TODO: 写入 diaries/<date>/<id>/diary.json
}
