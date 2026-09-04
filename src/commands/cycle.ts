// pdcaw cycle list — 프로젝트의 릴리즈(버전) 목록. 버전 사다리·예약 확인용.
import { parseFlags, UsageError } from '../lib/args.ts'
import { prepareContext } from '../lib/context.ts'
import { compareVersions } from '../lib/cycle-path.ts'
import { createEmitter, table } from '../lib/output.ts'
import { listCycles } from '../lib/rest.ts'

const USAGE = 'usage: pdcaw cycle list [--project <uuid>] [--base-url <url>] [--json]'

export async function main(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return
  }
  const { flags, json, positionals } = parseFlags(argv, { project: 'string', 'base-url': 'string' } as const, USAGE)
  const [sub] = positionals
  if (sub !== 'list') throw new UsageError(`알 수 없는 하위 명령: ${sub ?? '(없음)'}\n${USAGE}`)

  const emit = createEmitter(json)
  const ctx = await prepareContext(emit, { baseUrl: flags['base-url'], project: flags.project })

  const cycles = await listCycles(ctx.api, ctx.projectId)
  const rows = cycles
    .map((c) => ({
      id: c.id,
      version: c.version,
      name: c.name,
      dir: c.dir ?? (c.yearMonth && c.name ? `docs/PDCA/${c.yearMonth}/${c.name}` : null),
      hasReleaseNote: !!c.releaseNote,
      createdAt: c.createdAt,
    }))
    .sort((a, b) => compareVersions(b.version, a.version))

  emit.result(rows, () =>
    table(rows.map((r) => [r.version, r.name ?? '-', r.dir ?? '-', r.hasReleaseNote ? 'note' : '-', r.createdAt.slice(0, 10)])),
  )
}
