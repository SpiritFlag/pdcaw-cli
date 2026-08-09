// Design Ref: §2.1·§2.2·§5·§6 — 오케스트레이션. 자체 로직은 두지 않고 lib/*를 순서대로
// 호출한다(원본 Design Ref 관례 계승 — 파싱·해석 로직은 lib에 있다).
// 원본: PDCA-workspace scripts/docs-upload.ts. 의도된 행위 차이 전수는 Design §2.4 참조.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { classify } from '../lib/classify.ts'
import { ConfigError, resolveConfig } from '../lib/config.ts'
import { loadEnvFileIfPresent, resolveRepoRoot } from '../lib/root.ts'
import { GitDetectionError, TargetsError, resolveTargets } from '../lib/targets.ts'
import type { ChangedPath } from '../lib/git-changes.ts'
import { callTool, createCycle, resolveProjectId } from '../lib/workspace-api.ts'
import type { Api } from '../lib/workspace-api.ts'

const USAGE =
  'usage: pdcaw upload [--cycle <이름>] [--version vX.Y.Z] [--all]\n' +
  '                     [--path <파일|폴더>]... [--project <uuid>] [--base-url <url>]'

export class UsageError extends Error {}

function fail(message: string): never {
  throw new UsageError(message)
}

// ── 인자 파싱 ────────────────────────────────────────────────────────────────

type Args = {
  cycle?: string
  version?: string
  all: boolean
  path: string[]
  project?: string
  baseUrl?: string
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]
  if (!value || value.startsWith('--')) fail(`${flag} 에 값이 필요합니다\n${USAGE}`)
  return value
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { all: false, path: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--cycle':
        args.cycle = requireValue(argv, ++i, arg)
        break
      case '--version':
        args.version = requireValue(argv, ++i, arg)
        break
      case '--all':
        args.all = true
        break
      case '--path':
        args.path.push(requireValue(argv, ++i, arg))
        break
      case '--project':
        args.project = requireValue(argv, ++i, arg)
        break
      case '--base-url':
        args.baseUrl = requireValue(argv, ++i, arg)
        break
      default:
        fail(`알 수 없는 옵션: ${arg}\n${USAGE}`)
    }
  }
  if (args.version && !/^v\d+\.\d+\.\d+$/.test(args.version)) {
    fail(`--version은 v0.1.0 형식이어야 합니다: ${args.version}`)
  }
  if (args.version && !args.cycle) {
    fail(`--version은 --cycle과 함께 지정해야 합니다\n${USAGE}`)
  }
  // Design D-12 — --path는 완전 배타. 조합이 필요해지면 나중에 허용으로 푼다(역방향은 호환 파괴).
  if (args.path.length > 0 && (args.all || args.cycle || args.version)) {
    fail(`--path는 --all/--cycle/--version과 함께 쓸 수 없습니다\n${USAGE}`)
  }
  return args
}

// ── 대상 선정 ────────────────────────────────────────────────────────────────

type UploadTarget = ChangedPath

// FR-78(역파싱 실패는 사유와 함께 건너뜀) · FR-88(삭제·rename은 경고만, 서버 요청 없음)
// Design §2.4 ②: 파서 비매칭이어도 skip하지 않는다 — classify()가 general로 흡수한다.
// 사이클 필터(cycleFilter)는 파일을 열어야 아는 정보(title)에 걸리므로 여기서 적용하지
// 않고, classify() 이후(main)에서 적용한다.
function selectTargets(changes: ChangedPath[]): UploadTarget[] {
  const targets: UploadTarget[] = []
  for (const change of changes) {
    if (change.kind === 'deleted') {
      console.log(`  warn  삭제 감지: ${change.path} — 서버는 지우지 않음`)
      continue
    }
    if (change.kind === 'renamed') {
      console.log(`  warn  rename 감지: ${change.renamedFrom} → ${change.path} — 서버는 지우지 않음`)
      continue
    }
    if (!change.path.endsWith('.md')) {
      console.log(`  skip  ${change.path} — .md 아님`)
      continue
    }
    targets.push({ ...change })
  }
  return targets
}

// D-64 — 연월은 --cycle과 일치하는 변경 문서의 분류 결과에서 얻는다. 두 연월에 걸쳐
// 있으면 모호하므로 중단한다(자동 선택하지 않음). 원본 resolveCycleYearMonth 계승.
function resolveCycleYearMonth(
  targets: Array<{ info: ReturnType<typeof classify> }>,
  cycleName: string,
): string {
  const months = new Set(
    targets
      .map((t) => t.info)
      .filter((info) => info.kind === 'pdca' && info.title === cycleName)
      .map((info) => (info as { yearMonth: string }).yearMonth),
  )
  if (months.size === 0) {
    fail(`--cycle ${cycleName}에 해당하는 변경 문서를 찾을 수 없어 연월을 알 수 없습니다`)
  }
  if (months.size > 1) {
    fail(`--cycle ${cycleName}이 여러 연월(${[...months].join(', ')})에 걸쳐 있어 모호합니다`)
  }
  return [...months][0]
}

// ── 메인 ────────────────────────────────────────────────────────────────────

export async function main(argv: string[]): Promise<void> {
  // --help/-h는 파싱·설정 해석보다 먼저 처리한다 — 알 수 없는 옵션(fail)으로 떨어지거나
  // PAT·루트 판정을 요구하지 않아야 순수 도움말 조회가 성립한다.
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return
  }

  const args = parseArgs(argv)

  const cwd = process.cwd()
  const repoRoot = await resolveRepoRoot(cwd)
  loadEnvFileIfPresent(repoRoot)
  console.log(`루트: ${repoRoot.root} (${repoRoot.source})`)
  if (repoRoot.envFile) console.log(`env:  ${repoRoot.envFile}`)

  let config
  try {
    config = resolveConfig(repoRoot.root, { baseUrl: args.baseUrl, projectId: args.project })
  } catch (err) {
    if (err instanceof ConfigError) fail(err.message)
    throw err
  }

  const api: Api = { baseUrl: config.baseUrl, pat: config.pat }
  console.log(`→ ${api.baseUrl}`)

  let baseTag: string | undefined
  let changes: ChangedPath[]
  let skipped: string[]
  try {
    if (args.path.length > 0) {
      const result = await resolveTargets(repoRoot.root, cwd, { mode: 'path', paths: args.path })
      changes = result.changes
      skipped = result.skipped
    } else if (args.all) {
      const result = await resolveTargets(repoRoot.root, cwd, { mode: 'all' })
      changes = result.changes
      skipped = result.skipped
    } else {
      const result = await resolveTargets(repoRoot.root, cwd, { mode: 'git' })
      changes = result.changes
      baseTag = result.baseTag
      skipped = result.skipped
    }
  } catch (err) {
    if (err instanceof GitDetectionError) fail(err.message) // FR-86
    if (err instanceof TargetsError) fail(err.message)
    throw err
  }
  for (const s of skipped) console.log(`  skip  ${s}`)

  if (args.path.length > 0) {
    console.log(`기준: --path 지정 ${args.path.length}건`)
  } else {
    console.log(args.all ? '기준: --all (docs/ 전체)' : `기준: ${baseTag} 이후 + 작업트리`)
  }

  // I-4(원본 사후 발견): --cycle은 두 역할을 겸한다 — ①FR-77의 부분 동기화 필터
  // ②--version 시 릴리즈에 묶을 연월을 찾는 열쇠. --version이 있으면 대상 자체는
  // 필터하지 않는다(C29 — 이전 사이클 사후개정분 자동 포함).
  const cycleFilter = args.version ? undefined : args.cycle
  const preTargets = selectTargets(changes)

  const classified = await Promise.all(
    preTargets.map(async (t) => {
      const content = await readFile(path.join(repoRoot.root, t.path), 'utf-8')
      return { target: t, content, info: classify(t.path, content) }
    }),
  )

  const targets = classified.filter(({ info }) => {
    if (!cycleFilter) return true
    return info.kind === 'pdca' && info.title === cycleFilter
  })

  // FR-87 — 대상이 0건이면 --version 여부와 무관하게 조용히 성공 종료한다.
  if (targets.length === 0) {
    console.log('변경된 문서 없음')
    return
  }

  console.log(`대상 ${targets.length}건:`)
  for (const { target, info } of targets) {
    const stageCol = info.kind === 'pdca' ? info.stage : '-'
    console.log(`  ${info.title}  ${stageCol}  (${target.path})`)
  }

  const projectId = await resolveProjectId(api, config.projectId)
  console.log(`project=${projectId}`)

  if (args.version) {
    const yearMonth = resolveCycleYearMonth(targets, args.cycle!)
    const result = await createCycle(api, projectId, { version: args.version, name: args.cycle!, yearMonth })
    if (result.status === 'created') {
      console.log(`사이클: ${args.version} 생성 (${args.cycle} ${yearMonth} 연결)`)
    } else if (result.status === 'exists') {
      console.log(`사이클: ${args.version} 이미 존재 — 생성 생략`)
    } else {
      console.error(`사이클 FAIL: ${result.detail}`)
      process.exitCode = 1
    }
  }

  let created = 0
  let replaced = 0
  let failed = 0
  for (const { target, content, info } of targets) {
    try {
      if (!content.trim()) {
        console.log(`  warn  ${target.path} — 빈 파일, 건너뜀`)
        continue
      }
      const result = await callTool(api, 'document_write', {
        projectId,
        path: target.path,
        title: info.title,
        kind: info.kind,
        ...(info.kind === 'pdca' ? { pdcaStage: info.stage } : {}),
        content,
      })
      if (!result.ok) {
        failed++
        console.error(`  FAIL  ${target.path}\n        ${result.errorText}`)
        continue
      }
      const data = result.data as { replaced?: boolean; previousLength?: number }
      if (data.replaced) {
        replaced++
        console.log(`  ok    ${target.path} 덮어씀 (이전 ${data.previousLength ?? 0}자)`)
      } else {
        created++
        console.log(`  ok    ${target.path} 신규`)
      }
    } catch (err) {
      failed++
      console.error(`  FAIL  ${target.path}\n        ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`문서: 신규 ${created} / 덮어씀 ${replaced} / 실패 ${failed}`)
  if (failed > 0) process.exitCode = 1
}
