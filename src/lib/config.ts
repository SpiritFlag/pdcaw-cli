// Design Ref: §2.3·§6·§10.2 — 설정 해석. 우선순위: CLI 인자 > PDCAW_* 환경변수 >
// .pdcarc.json (기본값 없음 — Plan FR-01). PAT는 환경변수 경로만 인정한다(D-9) — .pdcarc는
// 커밋 대상 파일이라 비밀을 두면 공개 레포에 새어나간다.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const SECRET_KEYS = ['pat', 'token', 'PAT', 'TOKEN']

export type ResolvedConfig = { baseUrl: string; pat: string; projectId?: string }

export type CliOverrides = { baseUrl?: string; projectId?: string }

type Pdcarc = { projectId?: string; baseUrl?: string; [key: string]: unknown }

export class ConfigError extends Error {}

/** [I/O] .pdcarc.json을 읽는다. 없으면 빈 객체. 비밀 키가 있으면 경고를 반환에 싣는다
 * (값은 담지 않는다 — 호출부가 로그에 값을 출력하지 않도록 구조로 강제, FR-5). */
function readPdcarc(repoRoot: string): { data: Pdcarc; warnings: string[] } {
  const filePath = path.join(repoRoot, '.pdcarc.json')
  if (!existsSync(filePath)) return { data: {}, warnings: [] }

  const raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as Pdcarc
  const warnings: string[] = []
  for (const key of SECRET_KEYS) {
    if (key in data) {
      warnings.push(
        `warn  .pdcarc.json의 '${key}' 키는 무시됩니다 — PAT는 PDCAW_PAT 환경변수로만 지정하세요`,
      )
    }
  }
  return { data, warnings }
}

/** [순수] 우선순위 해석 본체 — I/O로 얻은 세 입력을 합성한다. baseUrl은 기본값 없이
 * undefined로 남을 수 있다(Design §2.3) — 프로덕션으로 조용히 향하는 것을 막는다. 단위
 * 테스트는 이 함수를 문다. */
export function mergeConfig(
  cli: CliOverrides,
  env: NodeJS.ProcessEnv,
  pdcarc: Pdcarc,
): { config: { baseUrl: string | undefined; projectId?: string }; pat: string | undefined } {
  const rawBaseUrl = cli.baseUrl ?? env.PDCAW_BASE_URL ?? pdcarc.baseUrl
  const baseUrl = rawBaseUrl?.replace(/\/+$/, '')
  const projectId = cli.projectId ?? env.PDCAW_PROJECT_ID ?? pdcarc.projectId
  const pat = env.PDCAW_PAT
  return { config: { baseUrl, projectId }, pat }
}

type MissingField = 'pat' | 'baseUrl'

/** 필드별 독립 가이드(Design §2.3) — 한쪽 문구를 고쳐도 다른 쪽에 영향 없다. */
const FIELD_GUIDE: Record<MissingField, string> = {
  pat:
    'PDCAW_PAT가 설정되지 않았습니다.\n' +
    '  1) 웹 UI의 /tokens 에서 PAT를 발급하고 (평문은 발급 직후 1회만 표시됨)\n' +
    '  2) .env.local 에 PDCAW_PAT=pdcaw_... 로 추가하세요.\n' +
    '  주의: PAT는 서버(=Neon 브랜치)별로 다릅니다 — 붙는 서버에서 발급한 것을 쓰세요.',
  baseUrl:
    'PDCAW_BASE_URL이 설정되지 않았습니다.\n' +
    '  본인 소유 self-hosted PDCA-workspace 서버 주소가 필요합니다 (기본값 없음).\n' +
    '  1) CLI 인자 --base-url <url>\n' +
    '  2) 환경변수 PDCAW_BASE_URL=https://... (.env.local)\n' +
    '  3) 레포 루트 .pdcarc.json 의 "baseUrl" 필드',
}

const NO_CONFIG_INTRO = '설정을 찾을 수 없습니다. 다음 중 하나를 준비하세요:'

/** [순수] 누락된 필수 필드(§2.3)를 한 번에 안내하는 메시지를 조립한다. 필드 순서는 항상
 * pat → baseUrl 고정(결정적 출력). hasAnyConfig가 false일 때만 도입부를 붙인다. */
export function buildMissingConfigMessage(missing: MissingField[], hasAnyConfig: boolean): string {
  const guides = (['pat', 'baseUrl'] as const)
    .filter((field) => missing.includes(field))
    .map((field) => FIELD_GUIDE[field])
  return hasAnyConfig ? guides.join('\n\n') : `${NO_CONFIG_INTRO}\n\n${guides.join('\n\n')}`
}

/** [I/O] 설정을 해석하고 경고를 콘솔에 출력한다. PAT·baseUrl 중 하나라도 없으면 둘 다 모아
 * ConfigError로 안내한다(Design §6). */
export function resolveConfig(repoRoot: string, cli: CliOverrides = {}): ResolvedConfig {
  const { data: pdcarc, warnings } = readPdcarc(repoRoot)
  for (const w of warnings) console.log(`  ${w}`)

  const { config, pat } = mergeConfig(cli, process.env, pdcarc)

  const missing: MissingField[] = []
  if (!pat) missing.push('pat')
  if (!config.baseUrl) missing.push('baseUrl')

  if (missing.length > 0) {
    const hasAnyConfig = Object.keys(pdcarc).length > 0 || Boolean(cli.projectId) || Boolean(cli.baseUrl)
    throw new ConfigError(buildMissingConfigMessage(missing, hasAnyConfig))
  }

  return { baseUrl: config.baseUrl as string, projectId: config.projectId, pat: pat as string }
}
