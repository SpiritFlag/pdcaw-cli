// 원본: PDCA-workspace scripts/lib/git-changes.ts — 이식.
// 변경점(Design §2.4 ①): pathspec 'docs/PDCA' → 'docs' — 형 지적(docs/ 전체 동기화) 반영.
// 순수 함수(parseDiffLines·parseStatusLines)는 무수정.
// Design Ref: §3.3, §9.1 — 대상 선정의 I/O(git 실행)와 해석(순수 파싱)을 분리한다.
// 파싱 함수만 단위 테스트 대상(D-65) — I/O는 module-3 종단 검증이 커버한다.
// Plan SC: C29 — 이전 사이클 사후개정분을 기억이 아니라 git 태그로 자동 탐지한다.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type ChangeKind = 'modified' | 'added' | 'untracked' | 'deleted' | 'renamed'
export type ChangedPath = { path: string; kind: ChangeKind; renamedFrom?: string }

const DIFF_KIND: Record<string, ChangeKind> = { M: 'modified', A: 'added', D: 'deleted' }

/** [순수] `git diff --name-status <tag>..HEAD` 출력 해석. rename은 `R###\told\tnew` 형태. */
export function parseDiffLines(stdout: string): ChangedPath[] {
  const results: ChangedPath[] = []
  for (const line of stdout.split('\n')) {
    if (!line) continue
    const tabIdx = line.indexOf('\t')
    if (tabIdx === -1) continue
    const statusLetter = line[0]
    const rest = line.slice(tabIdx + 1)
    if (statusLetter === 'R') {
      const [from, to] = rest.split('\t')
      if (from && to) results.push({ path: to, kind: 'renamed', renamedFrom: from })
      continue
    }
    const kind = DIFF_KIND[statusLetter]
    if (kind) results.push({ path: rest, kind })
  }
  return results
}

const STATUS_KIND_PRIORITY: Array<[predicate: (xy: string) => boolean, kind: ChangeKind]> = [
  [(xy) => xy === '??', 'untracked'],
  [(xy) => xy.includes('D'), 'deleted'],
  [(xy) => xy.includes('R'), 'renamed'],
  [(xy) => xy.includes('A'), 'added'],
  [(xy) => xy.includes('M'), 'modified'],
]

/** [순수] `git status --porcelain -uall` 출력 해석. 형식: XY<space>path (경로에 공백 보존). */
export function parseStatusLines(stdout: string): ChangedPath[] {
  const results: ChangedPath[] = []
  for (const line of stdout.split('\n')) {
    if (line.length < 3) continue
    const xy = line.slice(0, 2)
    const path = line.slice(3)
    if (!path) continue
    const match = STATUS_KIND_PRIORITY.find(([predicate]) => predicate(xy))
    if (match) results.push({ path, kind: match[1] })
  }
  return results
}

export class GitDetectionError extends Error {}

async function runGit(repoRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoRoot })
  return stdout
}

/**
 * [I/O] 최신 태그 이후 docs/ 변경분을 결정한다(D-55). 커밋분(diff)과 작업트리
 * (status)의 합집합이며, 같은 경로가 둘 다에 있으면 작업트리 판정이 우선한다(D-68) —
 * 올릴 본문은 어차피 디스크의 현재본 하나이므로.
 * 대상 폴더는 docs/ 전체다(Design §2.4 ① — 원본은 docs/PDCA로 한정했었다).
 */
export async function detectChangedDocs(
  repoRoot: string,
  options: { excludeTag?: string } = {},
): Promise<{ baseTag: string; changes: ChangedPath[] }> {
  let baseTag: string
  try {
    // excludeTag: `upload --version vX`가 vX 태그를 이미 찍은 뒤 실행되면 그 태그가 기준선이
    // 되어 diff가 비어 버린다(close 절차는 태그 → 업로드 순). 이번 릴리즈 태그는 기준선에서
    // 뺀다 — 그러면 태그 전후 어느 순서로 실행해도 "직전 릴리즈 이후 변경분"이 나온다.
    const args = ['describe', '--tags', '--abbrev=0']
    if (options.excludeTag) args.push(`--exclude=${options.excludeTag}`)
    baseTag = (await runGit(repoRoot, args)).trim()
  } catch {
    throw new GitDetectionError(
      '최신 태그를 찾을 수 없습니다 (git 저장소가 아니거나 태그가 없음). --all 또는 --path로 대상을 지정하세요.',
    )
  }

  const [diffOut, statusOut] = await Promise.all([
    runGit(repoRoot, ['diff', '--name-status', `${baseTag}..HEAD`, '--', 'docs']),
    runGit(repoRoot, ['status', '--porcelain', '-uall', '--', 'docs']),
  ])

  const merged = new Map<string, ChangedPath>()
  for (const change of parseDiffLines(diffOut)) merged.set(change.path, change)
  for (const change of parseStatusLines(statusOut)) merged.set(change.path, change)

  return { baseTag, changes: [...merged.values()] }
}
