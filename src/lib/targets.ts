// Design Ref: §2.2·§5.1·§10.2 D-4·D-12·D-17·D-18 — 대상 선정 3모드(git/all/path).
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { GitDetectionError, detectChangedDocs } from './git-changes.ts'
import type { ChangedPath } from './git-changes.ts'

export class TargetsError extends Error {}

/** [I/O] --all 모드: git 없이 docs/ 전체를 스캔한다(원본 scanAllDocs를 docs/PDCA→docs로 확장). */
export async function scanAllDocs(repoRoot: string): Promise<ChangedPath[]> {
  const root = path.join(repoRoot, 'docs')
  const out: ChangedPath[] = []
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.md')) out.push({ path: path.relative(repoRoot, full), kind: 'modified' })
    }
  }
  await walk(root)
  return out
}

export type PathResolution = { targets: ChangedPath[]; skipped: string[] }

/** [순수 판정 + I/O 존재 검증] --path 모드: 지정 경로만, git 우회, 무조건 업로드(D-4).
 * 상대경로는 cwd 기준으로 해석한 뒤 repoRoot 상대로 정규화한다(Design D-17) — cwd와
 * repoRoot가 다를 수 있다(하위 디렉터리에서 실행하는 경우). 폴더면 하위 .md 재귀 수집.
 * 파일인데 .md가 아니면 사유와 함께 skip 목록에 담는다(FR-13). 존재하지 않는 경로가
 * 하나라도 있으면 전체를 중단한다(D-18) — 서버 요청 전이라 안전하다. */
export async function resolvePathTargets(
  repoRoot: string,
  cwd: string,
  rawPaths: string[],
): Promise<PathResolution> {
  const missing: string[] = []
  const resolved: { abs: string; rel: string }[] = []

  for (const raw of rawPaths) {
    const abs = path.isAbsolute(raw) ? raw : path.resolve(cwd, raw)
    const rel = path.relative(repoRoot, abs)
    if (rel.startsWith('..')) {
      throw new TargetsError(`--path ${raw} 는 레포 루트(${repoRoot}) 밖입니다`)
    }
    try {
      await stat(abs)
      resolved.push({ abs, rel })
    } catch {
      missing.push(raw)
    }
  }

  if (missing.length > 0) {
    throw new TargetsError(`--path로 지정한 경로를 찾을 수 없습니다:\n${missing.map((m) => `  ${m}`).join('\n')}`)
  }

  const targets: ChangedPath[] = []
  const skipped: string[] = []
  const seen = new Set<string>()

  async function collect(abs: string, rel: string) {
    const st = await stat(abs)
    if (st.isDirectory()) {
      const entries = await readdir(abs, { withFileTypes: true })
      for (const entry of entries) {
        await collect(path.join(abs, entry.name), path.join(rel, entry.name))
      }
      return
    }
    if (!rel.endsWith('.md')) {
      skipped.push(`${rel} — .md 아님, 건너뜀`)
      return
    }
    if (seen.has(rel)) return
    seen.add(rel)
    targets.push({ path: rel, kind: 'modified' })
  }

  for (const { abs, rel } of resolved) await collect(abs, rel)

  return { targets, skipped }
}

export type TargetMode =
  | { mode: 'git'; excludeTag?: string }
  | { mode: 'all' }
  | { mode: 'path'; paths: string[] }

/** [I/O] 모드에 따라 ChangedPath 목록을 만든다. git 모드에서 태그가 없으면 GitDetectionError.
 * cwd는 --path 모드의 상대경로 해석에만 쓰인다(Design D-17). */
export async function resolveTargets(
  repoRoot: string,
  cwd: string,
  mode: TargetMode,
): Promise<{ changes: ChangedPath[]; baseTag?: string; skipped: string[] }> {
  if (mode.mode === 'all') {
    return { changes: await scanAllDocs(repoRoot), skipped: [] }
  }
  if (mode.mode === 'path') {
    const { targets, skipped } = await resolvePathTargets(repoRoot, cwd, mode.paths)
    return { changes: targets, skipped }
  }
  const { baseTag, changes } = await detectChangedDocs(repoRoot, { excludeTag: mode.excludeTag })
  return { changes, baseTag, skipped: [] }
}

export { GitDetectionError }
