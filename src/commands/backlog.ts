// pdcaw backlog list | get | create | update — 스킬이 서버 백로그를 만지는 유일한 통로.
// 정책은 MCP와 같다: todo 복원은 CLI로 하지 않는다(사용자가 UI에서). 하드 삭제 없음.
import { readFile } from 'node:fs/promises'
import { parseFlags, splitList, UsageError } from '../lib/args.ts'
import { prepareContext } from '../lib/context.ts'
import { createEmitter, table } from '../lib/output.ts'
import {
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  CLI_ALLOWED_STATUS_TARGETS,
  createBacklogItem,
  findBacklogById,
  getBacklogItem,
  isUuid,
  listBacklogSummary,
  updateBacklogItem,
} from '../lib/rest.ts'
import type { BacklogPriority, BacklogStatus, BacklogSummary } from '../lib/rest.ts'
import type { Api } from '../lib/workspace-api.ts'

const USAGE = [
  'usage: pdcaw backlog list   [--status s,...] [--stale <days>] [--q <text>] [--json]',
  '       pdcaw backlog get    <id|접두8자+> [--json]',
  '       pdcaw backlog create --title <t> --priority <p> --opened-on <YYYY-MM-DD>',
  '                            [--detail <t> | --detail-file <f>] [--json]',
  '       pdcaw backlog update <id> [--status s] [--closed-on d] [--opened-on d]',
  '                            [--title t] [--priority p]',
  '                            [--detail <t> | --detail-file <f> | --append-detail <t|@file>] [--json]',
  '',
  '  --status(update): doing | done | resolved | dropped  (todo 복원은 사용자 전용)',
  '  --priority: urgent | high | medium | low',
  '  공통: [--project <uuid>] [--base-url <url>]',
].join('\n')

const SPEC = {
  status: 'string',
  stale: 'string',
  q: 'string',
  title: 'string',
  priority: 'string',
  'opened-on': 'string',
  'closed-on': 'string',
  detail: 'string',
  'detail-file': 'string',
  'append-detail': 'string',
  project: 'string',
  'base-url': 'string',
} as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function fail(msg: string): never {
  throw new UsageError(`${msg}\n${USAGE}`)
}

/** `@file` 형태면 파일 내용, 아니면 그대로. */
async function textOrFile(value: string): Promise<string> {
  if (value.startsWith('@')) return readFile(value.slice(1), 'utf-8')
  return value
}

function summaryRow(it: BacklogSummary): string[] {
  return [it.id.slice(0, 8), it.status, it.priority, it.openedOn, it.updatedAt.slice(0, 10), it.title]
}

/** [I/O] 전체 uuid면 바로 단건 GET, 접두면 요약 목록에서 유일하게 좁힌 뒤 단건 GET. */
async function resolveItem(api: Api, projectId: string, idOrPrefix: string) {
  if (isUuid(idOrPrefix)) return getBacklogItem(api, idOrPrefix)
  const summaries = await listBacklogSummary(api, projectId)
  const hit = findBacklogById(summaries, idOrPrefix)
  return getBacklogItem(api, hit.id)
}

export async function main(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return
  }
  const { flags, json, positionals } = parseFlags(argv, SPEC, USAGE)
  const [sub, target] = positionals
  const emit = createEmitter(json)

  if (!sub || !['list', 'get', 'create', 'update'].includes(sub)) {
    fail(`알 수 없는 하위 명령: ${sub ?? '(없음)'}`)
  }

  // 입력 검증은 서버 요청 전에 끝낸다 — 잘못된 인자로 프로젝트 해석까지 가지 않게.
  if (sub === 'create') {
    if (!flags.title) fail('--title 이 필요합니다')
    if (!flags.priority || !BACKLOG_PRIORITIES.includes(flags.priority as BacklogPriority)) {
      fail(`--priority 는 ${BACKLOG_PRIORITIES.join(' | ')} 중 하나여야 합니다`)
    }
    if (!flags['opened-on'] || !DATE_RE.test(flags['opened-on'])) fail('--opened-on 은 YYYY-MM-DD 형식이어야 합니다')
    if (flags.detail && flags['detail-file']) fail('--detail 과 --detail-file 은 함께 쓸 수 없습니다')
  }
  if (sub === 'update') {
    if (!target) fail('update 에는 id가 필요합니다')
    const detailModes = [flags.detail, flags['detail-file'], flags['append-detail']].filter((v) => v !== undefined)
    if (detailModes.length > 1) fail('--detail / --detail-file / --append-detail 은 하나만 쓸 수 있습니다')
    if (flags.status && !CLI_ALLOWED_STATUS_TARGETS.includes(flags.status as BacklogStatus)) {
      fail(`--status 는 ${CLI_ALLOWED_STATUS_TARGETS.join(' | ')} 중 하나여야 합니다 (todo 복원은 사용자가 UI에서 합니다)`)
    }
    if (flags.priority && !BACKLOG_PRIORITIES.includes(flags.priority as BacklogPriority)) {
      fail(`--priority 는 ${BACKLOG_PRIORITIES.join(' | ')} 중 하나여야 합니다`)
    }
    for (const k of ['closed-on', 'opened-on'] as const) {
      if (flags[k] && !DATE_RE.test(flags[k]!)) fail(`--${k} 은 YYYY-MM-DD 형식이어야 합니다`)
    }
    const patchable = ['status', 'closed-on', 'opened-on', 'title', 'priority', 'detail', 'detail-file', 'append-detail'] as const
    if (!patchable.some((k) => flags[k] !== undefined)) fail('update 에 바꿀 항목이 없습니다')
  }
  if (sub === 'get' && !target) fail('get 에는 id가 필요합니다')
  if (sub === 'list') {
    const statuses = splitList(flags.status)
    const bad = statuses.filter((s) => !BACKLOG_STATUSES.includes(s as BacklogStatus))
    if (bad.length > 0) fail(`--status 에 모르는 값: ${bad.join(', ')}`)
    if (flags.stale !== undefined && !/^\d+$/.test(flags.stale)) fail('--stale 은 정수(일)여야 합니다')
  }

  const ctx = await prepareContext(emit, { baseUrl: flags['base-url'], project: flags.project })

  if (sub === 'list') {
    // 필터·요약은 서버가 한다(pdca-skill v1 §9.2). detail은 응답에 없다 — get으로 한 건씩.
    const items = await listBacklogSummary(ctx.api, ctx.projectId, {
      statuses: splitList(flags.status) as BacklogStatus[],
      staleDays: flags.stale !== undefined ? Number(flags.stale) : undefined,
      q: flags.q,
    })
    emit.result({ count: items.length, items }, () => `${table(items.map(summaryRow))}\n(${items.length}건)`)
    return
  }

  if (sub === 'get') {
    const item = await resolveItem(ctx.api, ctx.projectId, target)
    emit.result(item, () => {
      const head = table([
        ['id', item.id],
        ['title', item.title],
        ['status', item.status],
        ['priority', item.priority],
        ['openedOn', item.openedOn],
        ['closedOn', item.closedOn ?? '-'],
        ['updatedAt', item.updatedAt],
      ])
      return `${head}\n\n${item.detail ?? '(detail 없음)'}`
    })
    return
  }

  if (sub === 'create') {
    const detail = flags['detail-file'] ? await readFile(flags['detail-file'], 'utf-8') : flags.detail
    const created = await createBacklogItem(ctx.api, ctx.projectId, {
      title: flags.title!,
      priority: flags.priority as BacklogPriority,
      openedOn: flags['opened-on']!,
      ...(detail ? { detail } : {}),
    })
    emit.result(created, () => `생성: ${created.id}  ${created.title}`)
    return
  }

  // update
  const existing = await resolveItem(ctx.api, ctx.projectId, target)
  const patch: Record<string, unknown> = {}
  if (flags.status) patch.status = flags.status
  if (flags['closed-on']) patch.closedOn = flags['closed-on']
  if (flags['opened-on']) patch.openedOn = flags['opened-on']
  if (flags.title) patch.title = flags.title
  if (flags.priority) patch.priority = flags.priority
  if (flags.detail !== undefined) patch.detail = flags.detail
  if (flags['detail-file']) patch.detail = await readFile(flags['detail-file'], 'utf-8')
  // appendDetail은 서버가 기존 본문 앞에 얹는다 — 클라이언트가 원안을 읽어 재조립하지 않는다.
  if (flags['append-detail'] !== undefined) patch.appendDetail = await textOrFile(flags['append-detail'])
  if (flags.status && ['done', 'resolved', 'dropped'].includes(flags.status) && !flags['closed-on'] && !existing.closedOn) {
    emit.log(`  warn  ${flags.status} 전환인데 --closed-on 이 없습니다 (처리일이 비어 있음)`)
  }
  const updated = await updateBacklogItem(ctx.api, existing.id, patch)
  emit.result(updated, () => `갱신: ${updated.id}  ${updated.status}  ${updated.title}`)
}
