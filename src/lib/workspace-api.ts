// 원본: PDCA-workspace scripts/lib/workspace-api.ts — 이식(로직 무수정).
// Design Ref: §3.4, §9.1 — MCP·REST 클라이언트(I/O)와 JSON-RPC 봉투 해석(순수)을 분리한다.
// F58 실측 형태: /api/mcp는 stateless라 initialize 선행·Accept 헤더 불요, 헤더는
// Authorization·Content-Type 둘뿐. 봉투 해석 규칙은 server/l1-harness.ts의 callTool과 동일.
// Plan SC: C26 — content는 이 파일이 fetch body로 실어 보낼 뿐 어디에도 로그하지 않는다.
export type Api = { baseUrl: string; pat: string }
export type ToolResult = { ok: true; data: unknown } | { ok: false; errorText: string }

type JsonRpcEnvelope = {
  result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
  error?: { message?: string }
}

/** [순수] JSON-RPC 응답 봉투 해석. w1~w4가 명세. */
export function parseToolEnvelope(json: unknown): ToolResult {
  const envelope = json as JsonRpcEnvelope
  if (envelope.error) {
    return { ok: false, errorText: envelope.error.message ?? 'JSON-RPC error' }
  }
  const text = envelope.result?.content?.[0]?.text ?? ''
  if (envelope.result?.isError) {
    return { ok: false, errorText: text }
  }
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: true, data: text }
  }
}

/** [I/O] MCP tools/call. 401은 RK-40(PAT-서버 브랜치 불일치) 원인 지목형 메시지로 변환한다. */
export async function callTool(
  api: Api,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const res = await fetch(`${api.baseUrl}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.pat}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `docs-upload-${name}`,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })

  if (res.status === 401) {
    return {
      ok: false,
      errorText: `HTTP 401 — PAT와 대상 서버(${api.baseUrl})가 짝인지 확인하세요 (Neon 브랜치별로 PAT가 다름)`,
    }
  }
  if (!res.ok) {
    return { ok: false, errorText: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` }
  }
  return parseToolEnvelope(await res.json())
}

/**
 * [I/O] REST 사이클 생성. 409는 target='version'일 때만 "이미 존재"다(D-58) — 재실행 시
 * 정상 경로이자 F68상 반드시 발생하는 형태. target='name'은 다른 버전에 같은 사이클명이
 * 이미 연결돼 있다는 뜻으로, 요청한 version은 생성되지 않았으므로 실패로 취급한다(I-1).
 */
export async function createCycle(
  api: Api,
  projectId: string,
  input: { version: string; name: string; yearMonth: string },
): Promise<{ status: 'created' | 'exists' | 'failed'; detail?: string }> {
  const res = await fetch(`${api.baseUrl}/api/projects/${projectId}/cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.pat}` },
    body: JSON.stringify(input),
  })
  if (res.status === 201) return { status: 'created' }
  if (res.status === 409) {
    const body = (await res.json()) as { error?: { details?: { target?: string } } }
    if (body.error?.details?.target === 'version') return { status: 'exists' }
    return {
      status: 'failed',
      detail: `버전 '${input.version}'은 생성되지 않았습니다 — 사이클명 '${input.name}'이 다른 버전에 이미 연결돼 있습니다`,
    }
  }
  return { status: 'failed', detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` }
}

type ProjectListEntry = { name: string; projects?: Array<{ id: string; name: string }> }

/** [I/O] PDCAW_PROJECT_ID가 없으면 project_list로 해석한다(F70). 2개 이상이면 목록과 함께 에러. */
export async function resolveProjectId(api: Api, explicit?: string): Promise<string> {
  if (explicit) return explicit

  const result = await callTool(api, 'project_list', {})
  if (!result.ok) throw new Error(`project_list 실패: ${result.errorText}`)

  const workspaces = result.data as ProjectListEntry[]
  const projects = workspaces.flatMap((ws) =>
    (ws.projects ?? []).map((p) => ({ id: p.id, label: `${ws.name}/${p.name}` })),
  )

  if (projects.length === 0) {
    throw new Error('접근 가능한 프로젝트가 없습니다 — PAT의 소유자를 확인하세요')
  }
  if (projects.length > 1) {
    throw new Error(
      `프로젝트가 ${projects.length}개라 자동 선택할 수 없습니다.\n` +
        `PDCAW_PROJECT_ID 또는 --project로 지정하세요:\n` +
        projects.map((p) => `  ${p.id}  ${p.label}`).join('\n'),
    )
  }
  return projects[0].id
}
