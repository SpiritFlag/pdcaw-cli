// pdcaw project list — 워크스페이스·프로젝트 목록. .pdcarc.json에 넣을 projectId를 찾을 때.
import { parseFlags, UsageError } from '../lib/args.ts'
import { ConfigError, resolveConfig } from '../lib/config.ts'
import { createEmitter, table } from '../lib/output.ts'
import { loadEnvFileIfPresent, resolveRepoRoot } from '../lib/root.ts'
import { callTool } from '../lib/workspace-api.ts'

const USAGE = 'usage: pdcaw project list [--base-url <url>] [--json]'

type WorkspaceEntry = { id: string; name: string; slug: string; projects?: Array<{ id: string; name: string; slug: string }> }

export async function main(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return
  }
  const { flags, json, positionals } = parseFlags(argv, { 'base-url': 'string' } as const, USAGE)
  const [sub] = positionals
  if (sub !== 'list') throw new UsageError(`알 수 없는 하위 명령: ${sub ?? '(없음)'}\n${USAGE}`)

  const emit = createEmitter(json)
  const repoRoot = await resolveRepoRoot(process.cwd())
  loadEnvFileIfPresent(repoRoot)
  let config
  try {
    config = resolveConfig(repoRoot.root, { baseUrl: flags['base-url'] })
  } catch (err) {
    if (err instanceof ConfigError) throw new UsageError(err.message)
    throw err
  }
  const api = { baseUrl: config.baseUrl, pat: config.pat }

  const result = await callTool(api, 'project_list', {})
  if (!result.ok) throw new Error(`project_list 실패: ${result.errorText}`)
  const workspaces = result.data as WorkspaceEntry[]

  const rows = workspaces.flatMap((ws) =>
    (ws.projects ?? []).map((p) => ({ projectId: p.id, workspace: ws.name, project: p.name, slug: `${ws.slug}/${p.slug}` })),
  )
  emit.result(rows, () => table(rows.map((r) => [r.projectId, r.workspace, r.project, r.slug])))
}
