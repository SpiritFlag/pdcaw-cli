// 로컬 docs/PDCA를 훑어 사이클 폴더를 찾는다(--version → 폴더, doc collect의 대상 수집).
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { PDCA_STAGES, compareVersions, parseCycleStagePath, splitStem } from './cycle-path.ts'
import type { ParsedCyclePath, PdcaStage } from './cycle-path.ts'

export type CycleDir = { dir: string; stem: string; version: string | null; name: string }

/** [I/O] docs/PDCA 아래 모든 사이클 폴더. 판정 기준은 "폴더 안에 `{폴더명}.{stage}.md`가 하나라도 있다". */
export async function listCycleDirs(repoRoot: string): Promise<CycleDir[]> {
  const root = path.join(repoRoot, 'docs', 'PDCA')
  const out: CycleDir[] = []
  try {
    await stat(root)
  } catch {
    return out
  }

  async function walk(absDir: string, relDir: string) {
    const entries = await readdir(absDir, { withFileTypes: true })
    const dirName = path.basename(relDir)
    const isCycle = entries.some(
      (e) => e.isFile() && PDCA_STAGES.some((s) => e.name === `${dirName}.${s}.md`),
    )
    if (isCycle) {
      const { version, name } = splitStem(dirName)
      out.push({ dir: relDir, stem: dirName, version, name })
      return // 사이클 폴더 아래는 더 내려가지 않는다
    }
    for (const e of entries) {
      if (e.isDirectory()) await walk(path.join(absDir, e.name), `${relDir}/${e.name}`)
    }
  }
  await walk(root, 'docs/PDCA')
  return out
}

/** [순수] 버전으로 사이클 폴더를 고른다. 0건·2건 이상은 에러(자동 선택 없음). */
export function pickCycleDirByVersion(dirs: CycleDir[], version: string): CycleDir {
  const hits = dirs.filter((d) => d.version === version)
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) {
    throw new Error(
      `${version}에 해당하는 사이클 폴더가 없습니다 — docs/PDCA/v{major}/${version}-{cycle}/ 아래에 문서가 있어야 합니다`,
    )
  }
  throw new Error(`${version}에 사이클 폴더가 ${hits.length}개입니다:\n${hits.map((h) => `  ${h.dir}`).join('\n')}`)
}

export type StageDoc = ParsedCyclePath & { relPath: string }

/** [I/O] 한 stage의 문서 전건. 버전순(옛 배치는 뒤, 경로순). */
export async function listStageDocs(repoRoot: string, stage: PdcaStage, majorDir?: string): Promise<StageDoc[]> {
  const dirs = await listCycleDirs(repoRoot)
  const docs: StageDoc[] = []
  for (const d of dirs) {
    if (majorDir && !d.dir.startsWith(`docs/PDCA/${majorDir}/`)) continue
    const relPath = `${d.dir}/${d.stem}.${stage}.md`
    try {
      await stat(path.join(repoRoot, relPath))
    } catch {
      continue
    }
    const parsed = parseCycleStagePath(relPath)
    if (parsed) docs.push({ ...parsed, relPath })
  }
  return sortStageDocs(docs)
}

/** [순수] 버전 있는 것 먼저 버전순, 없는 것은 뒤에 경로순. */
export function sortStageDocs<T extends { version: string | null; relPath: string }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => {
    if (a.version && b.version) return compareVersions(a.version, b.version)
    if (a.version) return -1
    if (b.version) return 1
    return a.relPath.localeCompare(b.relPath)
  })
}
