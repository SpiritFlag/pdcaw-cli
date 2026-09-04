// 명령 공통 준비: 루트 판정 → .env.local → 설정 → Api. upload 외 명령들이 같은 순서를 쓴다.
import { ConfigError, resolveConfig } from './config.ts'
import { loadEnvFileIfPresent, resolveRepoRoot } from './root.ts'
import type { RepoRoot } from './root.ts'
import { resolveProjectId } from './workspace-api.ts'
import type { Api } from './workspace-api.ts'
import type { Emitter } from './output.ts'
import { UsageError } from './args.ts'

export type Context = { repoRoot: RepoRoot; api: Api; projectId: string }

/** [I/O] 서버가 필요한 명령의 준비. 설정 오류는 UsageError로 바꿔 스택 없이 안내한다. */
export async function prepareContext(
  emit: Emitter,
  overrides: { baseUrl?: string; project?: string } = {},
): Promise<Context> {
  const cwd = process.cwd()
  const repoRoot = await resolveRepoRoot(cwd)
  loadEnvFileIfPresent(repoRoot)

  let config
  try {
    config = resolveConfig(repoRoot.root, { baseUrl: overrides.baseUrl, projectId: overrides.project })
  } catch (err) {
    if (err instanceof ConfigError) throw new UsageError(err.message)
    throw err
  }
  const api: Api = { baseUrl: config.baseUrl, pat: config.pat }
  emit.log(`→ ${api.baseUrl}`)
  const projectId = await resolveProjectId(api, config.projectId)
  return { repoRoot, api, projectId }
}

/** [I/O] 서버 없이 로컬만 보는 명령의 준비(doc collect). */
export async function prepareLocal(): Promise<RepoRoot> {
  return resolveRepoRoot(process.cwd())
}
