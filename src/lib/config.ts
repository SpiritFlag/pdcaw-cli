// Design Ref: §5·§7.1·§10.2 — 설정 해석. 우선순위: CLI 인자 > PDCAW_* 환경변수 >
// .pdcarc.json > 에러/기본값(Plan FR-3). PAT는 환경변수 경로만 인정한다(D-9) — .pdcarc는
// 커밋 대상 파일이라 비밀을 두면 공개 레포에 새어나간다.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const DEFAULT_BASE_URL = 'https://pdca-workspace.vercel.app'
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

/** [순수] 우선순위 해석 본체 — I/O로 얻은 세 입력을 합성한다. 단위 테스트는 이 함수를 문다. */
export function mergeConfig(
  cli: CliOverrides,
  env: NodeJS.ProcessEnv,
  pdcarc: Pdcarc,
): { config: Omit<ResolvedConfig, 'pat'>; pat: string | undefined } {
  const baseUrl = (cli.baseUrl ?? env.PDCAW_BASE_URL ?? pdcarc.baseUrl ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  )
  const projectId = cli.projectId ?? env.PDCAW_PROJECT_ID ?? pdcarc.projectId
  const pat = env.PDCAW_PAT
  return { config: { baseUrl, projectId }, pat }
}

const PAT_GUIDE =
  'PDCAW_PAT가 설정되지 않았습니다.\n' +
  '  1) 웹 UI의 /tokens 에서 PAT를 발급하고 (평문은 발급 직후 1회만 표시됨)\n' +
  '  2) .env.local 에 PDCAW_PAT=pdcaw_... 로 추가하세요.\n' +
  '  주의: PAT는 서버(=Neon 브랜치)별로 다릅니다 — 붙는 서버에서 발급한 것을 쓰세요.'

const NO_CONFIG_GUIDE =
  '설정을 찾을 수 없습니다. 다음 중 하나를 준비하세요:\n' +
  '  1) 레포 루트에 .pdcarc.json 생성 — { "projectId": "...", "baseUrl": "..." }\n' +
  '  2) 환경변수 PDCAW_PAT(필수)·PDCAW_PROJECT_ID·PDCAW_BASE_URL(선택) 설정'

/** [I/O] 설정을 해석하고 경고를 콘솔에 출력한다. PAT 없으면 ConfigError. */
export function resolveConfig(repoRoot: string, cli: CliOverrides = {}): ResolvedConfig {
  const { data: pdcarc, warnings } = readPdcarc(repoRoot)
  for (const w of warnings) console.log(`  ${w}`)

  const { config, pat } = mergeConfig(cli, process.env, pdcarc)

  if (!pat) {
    const hasAnyConfig = Object.keys(pdcarc).length > 0 || cli.projectId || cli.baseUrl
    throw new ConfigError(hasAnyConfig ? PAT_GUIDE : `${NO_CONFIG_GUIDE}\n\n${PAT_GUIDE}`)
  }

  return { ...config, pat }
}
