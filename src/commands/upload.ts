// pdcaw upload — 오케스트레이션. 자체 로직은 두지 않고 lib/*를 순서대로 호출한다.
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { classify } from '../lib/classify.ts'
import { ConfigError, resolveConfig } from '../lib/config.ts'
import { listCycleDirs, pickCycleDirByVersion } from '../lib/cycle-dir.ts'
import { isVersion } from '../lib/cycle-path.ts'
import { loadEnvFileIfPresent, resolveRepoRoot } from '../lib/root.ts'
import { GitDetectionError, TargetsError, resolveTargets } from '../lib/targets.ts'
import type { ChangedPath } from '../lib/git-changes.ts'
import { updateCycle } from '../lib/rest.ts'
import { callTool, createCycle, resolveProjectId } from '../lib/workspace-api.ts'
import type { Api } from '../lib/workspace-api.ts'

const USAGE =
  'usage: pdcaw upload [--version vX.Y.Z] [--all | --path <파일|폴더>...]\n' +
  '                    [--project <uuid>] [--base-url <url>]\n' +
  '\n' +
  '  --version: docs/PDCA/*/{version}-*/ 폴더를 찾아 릴리즈를 만들고(있으면 재사용),\n' +
  '             변경 문서를 올린 뒤 그 폴더의 *.release.md를 릴리즈노트로 설정한다.\n' +
  '             기준선은 이 버전을 제외한 최신 태그 — 태그 전후 어느 순서로 실행해도 된다.\n' +
  '  --version --path: 소급 릴리즈. 지정 경로만 올리고 릴리즈를 만든다(중복 전송 없음).'

export class UsageError extends Error {}

function fail(message: string): never {
  throw new UsageError(message)
}

// ── 인자 파싱 ────────────────────────────────────────────────────────────────

type Args = {
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
      case '--cycle':
        fail('--cycle 은 없어졌습니다. 릴리즈는 --version 만으로 폴더를 찾고, 부분 동기화는 --path 를 쓰세요')
        break
      default:
        fail(`알 수 없는 옵션: ${arg}\n${USAGE}`)
    }
  }
  if (args.version && !isVersion(args.version)) {
    fail(`--version은 v0.1.0 형식이어야 합니다: ${args.version}`)
  }
  // --path와 --all은 대상 선정 방식이라 배타. --version은 릴리즈 처리라 어느 쪽과도 조합된다
  // (--version + --path = 소급 릴리즈: 그 폴더만 올린다).
  if (args.path.length > 0 && args.all) {
    fail(`--path는 --all과 함께 쓸 수 없습니다\n${USAGE}`)
  }
  return args
}

// ── 대상 선정 ────────────────────────────────────────────────────────────────

type UploadTarget = ChangedPath

// 삭제·rename은 경고만(서버 요청 없음). 파서 비매칭이어도 skip하지 않는다 — classify()가
// general로 흡수한다. 질문 파일(*.qN.md)은 사이클 폴더에 남아 있으면 안 되는 파일이라 경고한다.
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
    if (/\.q\d+\.md$/.test(change.path)) {
      console.log(`  warn  질문 파일 잔존: ${change.path} — 답을 반영하고 지워야 할 파일입니다 (그대로 general로 올라감)`)
    }
    targets.push({ ...change })
  }
  return targets
}

// ── 메인 ────────────────────────────────────────────────────────────────────

export async function main(argv: string[]): Promise<void> {
  // --help/-h는 파싱·설정 해석보다 먼저 처리한다.
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

  // --version이면 서버 요청 전에 로컬 폴더부터 확정한다 — 없으면 아무것도 올리지 않는다.
  let cycleDir: { dir: string; stem: string; name: string } | undefined
  if (args.version) {
    const dirs = await listCycleDirs(repoRoot.root)
    try {
      cycleDir = pickCycleDirByVersion(dirs, args.version)
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err))
    }
    console.log(`사이클 폴더: ${cycleDir.dir}`)
  }

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
      const result = await resolveTargets(repoRoot.root, cwd, { mode: 'git', excludeTag: args.version })
      changes = result.changes
      baseTag = result.baseTag
      skipped = result.skipped
    }
  } catch (err) {
    if (err instanceof GitDetectionError) fail(err.message)
    if (err instanceof TargetsError) fail(err.message)
    throw err
  }
  for (const s of skipped) console.log(`  skip  ${s}`)

  if (args.path.length > 0) {
    console.log(`기준: --path 지정 ${args.path.length}건`)
  } else {
    console.log(args.all ? '기준: --all (docs/ 전체)' : `기준: ${baseTag} 이후 + 작업트리`)
  }

  const preTargets = selectTargets(changes)
  const targets = await Promise.all(
    preTargets.map(async (t) => {
      const content = await readFile(path.join(repoRoot.root, t.path), 'utf-8')
      return { target: t, content, info: classify(t.path, content) }
    }),
  )

  // 대상이 0건이고 릴리즈도 없으면 조용히 성공 종료한다. --version이면 릴리즈 생성은 계속한다.
  if (targets.length === 0 && !args.version) {
    console.log('변경된 문서 없음')
    return
  }

  if (targets.length > 0) {
    console.log(`대상 ${targets.length}건:`)
    for (const { target, info } of targets) {
      const stageCol = info.kind === 'pdca' ? info.stage : '-'
      console.log(`  ${info.title}  ${stageCol}  (${target.path})`)
    }
  } else {
    console.log('변경된 문서 없음 (릴리즈만 처리)')
  }

  const projectId = await resolveProjectId(api, config.projectId)
  console.log(`project=${projectId}`)

  let cycleId: string | undefined
  if (args.version && cycleDir) {
    const result = await createCycle(api, projectId, { version: args.version, name: cycleDir.name, dir: cycleDir.dir })
    cycleId = result.id
    if (result.status === 'created') {
      console.log(`사이클: ${args.version} 생성 (${cycleDir.name}, ${cycleDir.dir})`)
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

  if (targets.length > 0) console.log(`문서: 신규 ${created} / 덮어씀 ${replaced} / 실패 ${failed}`)
  if (failed > 0) process.exitCode = 1

  // release.md가 있으면 그 내용을 릴리즈노트로. 문서 업로드와 무관하게 폴더에 있으면 반영한다.
  if (args.version && cycleDir) {
    const releasePath = `${cycleDir.dir}/${cycleDir.stem}.release.md`
    let note: string | undefined
    try {
      await stat(path.join(repoRoot.root, releasePath))
      note = await readFile(path.join(repoRoot.root, releasePath), 'utf-8')
    } catch {
      note = undefined
    }
    if (!note?.trim()) {
      console.log(`릴리즈노트: ${releasePath} 없음 — 서버 릴리즈노트는 그대로 둠`)
    } else if (!cycleId) {
      console.error('릴리즈노트: 사이클 id를 알 수 없어 설정하지 못함')
      process.exitCode = 1
    } else {
      try {
        await updateCycle(api, cycleId, { releaseNote: note })
        console.log(`릴리즈노트: ${releasePath} → ${args.version}`)
      } catch (err) {
        console.error(`릴리즈노트 FAIL: ${err instanceof Error ? err.message : err}`)
        process.exitCode = 1
      }
    }
  }
}
