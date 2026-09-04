// REST 클라이언트. 서버 라우트는 `{ data }` / `{ error: { code, message, details } }` 봉투를 쓴다.
// PAT는 Authorization 헤더에만 싣고 어디에도 로그하지 않는다.
import type { Api } from './workspace-api.ts'

export type RestError = { code: string; message?: string; details?: unknown; status: number }
export type RestResult<T> = { ok: true; data: T; status: number } | { ok: false; error: RestError }

export class RestFailure extends Error {
  constructor(readonly error: RestError) {
    super(formatRestError(error))
  }
}

export function formatRestError(e: RestError): string {
  const base = `[${e.code}]${e.message ? ` ${e.message}` : ''} (HTTP ${e.status})`
  const details = e.details as { fieldErrors?: Record<string, string[]> } | undefined
  if (details?.fieldErrors) {
    const lines = Object.entries(details.fieldErrors).map(([k, v]) => `  ${k}: ${v.join(', ')}`)
    return `${base}\n${lines.join('\n')}`
  }
  return base
}

/** [I/O] 요청 한 번. 401은 PAT-서버 브랜치 불일치 원인 지목형 메시지로 바꾼다. */
export async function restRequest<T>(
  api: Api,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<RestResult<T>> {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${api.pat}` } }
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${api.baseUrl}/api${path}`, init)

  if (res.status === 401) {
    return {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: `PAT와 대상 서버(${api.baseUrl})가 짝인지 확인하세요 (Neon 브랜치별로 PAT가 다름)`,
        status: 401,
      },
    }
  }
  if (res.status === 204) return { ok: true, data: undefined as T, status: 204 }

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: 'BAD_RESPONSE', message: text.slice(0, 300), status: res.status } }
  }
  const envelope = json as { data?: T; error?: { code?: string; message?: string; details?: unknown } }
  if (!res.ok || envelope.error) {
    return {
      ok: false,
      error: {
        code: envelope.error?.code ?? `HTTP_${res.status}`,
        message: envelope.error?.message,
        details: envelope.error?.details,
        status: res.status,
      },
    }
  }
  return { ok: true, data: envelope.data as T, status: res.status }
}

/** [I/O] 실패를 예외로 올리는 편의 래퍼. 명령 본문이 성공 경로만 쓰게 한다. */
export async function restOrThrow<T>(
  api: Api,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const r = await restRequest<T>(api, method, path, body)
  if (!r.ok) throw new RestFailure(r.error)
  return r.data
}

// ── 도메인 타입(서버 응답 형태) ─────────────────────────────────────────────

export type BacklogStatus = 'todo' | 'doing' | 'done' | 'resolved' | 'dropped'
export type BacklogPriority = 'urgent' | 'high' | 'medium' | 'low'

export type BacklogItem = {
  id: string
  projectId: string
  title: string
  priority: BacklogPriority
  status: BacklogStatus
  detail: string | null
  openedOn: string
  closedOn: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type Cycle = {
  id: string
  projectId: string
  version: string
  releaseNote: string | null
  name: string | null
  /** 사이클 폴더 경로. 옛 서버는 이 필드 대신 yearMonth를 준다 */
  dir?: string | null
  yearMonth?: string | null
  createdAt: string
  updatedAt: string
}

export const BACKLOG_STATUSES: BacklogStatus[] = ['todo', 'doing', 'done', 'resolved', 'dropped']
export const BACKLOG_PRIORITIES: BacklogPriority[] = ['urgent', 'high', 'medium', 'low']
/** MCP와 같은 정책 — todo 복원은 사용자가 UI에서 한다(pdca-skill P7). */
export const CLI_ALLOWED_STATUS_TARGETS: BacklogStatus[] = ['doing', 'done', 'resolved', 'dropped']

// ── 백로그 ──────────────────────────────────────────────────────────────────

export type BacklogSummary = Omit<BacklogItem, 'detail'>
export type BacklogListParams = { statuses?: BacklogStatus[]; staleDays?: number; q?: string }

function backlogQuery(p: BacklogListParams): string {
  const qs = new URLSearchParams()
  if (p.statuses && p.statuses.length > 0) qs.set('status', p.statuses.join(','))
  if (p.staleDays !== undefined) qs.set('stale', String(p.staleDays))
  if (p.q) qs.set('q', p.q)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** 전체 행(detail 포함). 서버가 status·stale·q를 거른다(pdca-skill v1 §9.2). */
export function listBacklog(api: Api, projectId: string, p: BacklogListParams = {}) {
  return restOrThrow<BacklogItem[]>(api, 'GET', `/projects/${projectId}/backlog${backlogQuery(p)}`)
}

/** 요약 행(detail 없음). 100건이 넘어도 컨텍스트에 들어온다. */
export function listBacklogSummary(api: Api, projectId: string, p: BacklogListParams = {}) {
  return restOrThrow<BacklogSummary[]>(api, 'GET', `/projects/${projectId}/backlog/summary${backlogQuery(p)}`)
}

export function getBacklogItem(api: Api, id: string) {
  return restOrThrow<BacklogItem>(api, 'GET', `/backlog/${id}`)
}

export function createBacklogItem(
  api: Api,
  projectId: string,
  input: { title: string; priority: BacklogPriority; openedOn: string; detail?: string },
) {
  return restOrThrow<BacklogItem>(api, 'POST', `/projects/${projectId}/backlog`, input)
}

/** PATCH. appendDetail은 서버가 기존 detail 앞에 블록을 얹는다(원안 보존을 서버가 책임). */
export function updateBacklogItem(
  api: Api,
  id: string,
  patch: Partial<Omit<BacklogItem, 'id' | 'projectId'>> & { appendDetail?: string },
) {
  return restOrThrow<BacklogItem>(api, 'PATCH', `/backlog/${id}`, patch)
}

// ── 사이클(릴리즈) ──────────────────────────────────────────────────────────

export function listCycles(api: Api, projectId: string) {
  return restOrThrow<Cycle[]>(api, 'GET', `/projects/${projectId}/cycles`)
}

export function updateCycle(api: Api, id: string, patch: { releaseNote?: string; name?: string | null; dir?: string | null }) {
  return restOrThrow<Cycle>(api, 'PATCH', `/cycles/${id}`, patch)
}

// ── 순수 헬퍼(테스트 대상) ──────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

/** [순수] id 또는 id 접두(8자 이상)로 한 건을 찾는다. 0건 · 2건 이상이면 에러. */
export function findBacklogById<T extends { id: string; title: string }>(items: T[], idOrPrefix: string): T {
  const exact = items.find((it) => it.id === idOrPrefix)
  if (exact) return exact
  if (idOrPrefix.length < 8) throw new Error(`id는 전체 uuid 또는 8자 이상 접두여야 합니다: ${idOrPrefix}`)
  const hits = items.filter((it) => it.id.startsWith(idOrPrefix))
  if (hits.length === 1) return hits[0]
  if (hits.length === 0) throw new Error(`백로그 항목을 찾을 수 없습니다: ${idOrPrefix}`)
  throw new Error(`접두 ${idOrPrefix}에 ${hits.length}건이 매칭됩니다:\n${hits.map((h) => `  ${h.id}  ${h.title}`).join('\n')}`)
}
