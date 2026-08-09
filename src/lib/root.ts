// Design Ref: §10.2 D-11 — 레포 루트 판정 3단 + .env.local 자동 로딩(D-8).
// 원본(PDCA-workspace scripts/docs-upload.ts)은 REPO_ROOT를 스크립트 위치로 고정했다
// (import.meta.dirname/..) — npm 패키지에서는 성립하지 않는 가정이라 CLI에서 반드시
// 바뀌어야 하는 유일한 핵심 로직이다(Plan F3, D-1).
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type RootSource = 'pdcarc' | 'git' | 'cwd'
export type RepoRoot = { root: string; source: RootSource; envFile?: string }

/** [순수] cwd에서 상위로 올라가며 .pdcarc.json을 찾는다. .pdcarc가 git보다 우선인 이유는
 * 커밋 대상 파일이라 레포 루트의 결정적 표지이고, git 없는 환경(--path 전용 사용)에서도
 * 성립하기 때문이다(D-11). */
function findPdcarcRoot(cwd: string): string | null {
  let dir = cwd
  for (;;) {
    if (existsSync(path.join(dir, '.pdcarc.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

async function findGitRoot(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd })
    return stdout.trim()
  } catch {
    return null
  }
}

/** [I/O] 레포 루트 판정: .pdcarc.json 상향 탐색 → git 루트 → cwd(경고 없이 최종 폴백). */
export async function resolveRepoRoot(cwd: string): Promise<RepoRoot> {
  const pdcarcRoot = findPdcarcRoot(cwd)
  if (pdcarcRoot) return withEnvFile({ root: pdcarcRoot, source: 'pdcarc' })

  const gitRoot = await findGitRoot(cwd)
  if (gitRoot) return withEnvFile({ root: gitRoot, source: 'git' })

  return withEnvFile({ root: cwd, source: 'cwd' })
}

function withEnvFile(base: { root: string; source: RootSource }): RepoRoot {
  const envPath = path.join(base.root, '.env.local')
  if (!existsSync(envPath)) return base
  return { ...base, envFile: envPath }
}

/** [I/O] .env.local이 있으면 로딩한다. 이미 설정된 실제 환경변수는 덮지 않는다(D-15) —
 * Node 내장 process.loadEnvFile은 기존 값을 덮지 않는 것으로 실측 확인됨(module-1,2 구현 중). */
export function loadEnvFileIfPresent(repoRoot: RepoRoot): void {
  if (!repoRoot.envFile) return
  process.loadEnvFile(repoRoot.envFile)
}
