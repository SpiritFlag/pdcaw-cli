#!/usr/bin/env node
// 서브커맨드 라우팅만. 로직은 commands/*로 위임한다.
import { UsageError as ArgsUsageError } from './lib/args.ts'
import { RestFailure } from './lib/rest.ts'
import { main as backlogMain } from './commands/backlog.ts'
import { main as cycleMain } from './commands/cycle.ts'
import { main as docMain } from './commands/doc.ts'
import { main as projectMain } from './commands/project.ts'
import { UsageError as UploadUsageError, main as uploadMain } from './commands/upload.ts'

const USAGE = [
  'usage: pdcaw <command> [옵션]',
  '',
  'commands:',
  '  upload    PDCA 문서를 워크스페이스 서버에 동기화 (--version 이면 릴리즈 생성 + 릴리즈노트)',
  '  project   list                           워크스페이스·프로젝트 목록',
  '  cycle     list                           릴리즈(버전) 목록',
  '  backlog   list | get | create | update   백로그',
  '  doc       collect                        로컬 docs/PDCA에서 한 stage를 한곳에 모음',
  '',
  '모든 명령이 --json 을 받는다. 자세한 옵션은 `pdcaw <command> --help`.',
].join('\n')

const COMMANDS: Record<string, (argv: string[]) => Promise<void>> = {
  upload: uploadMain,
  project: projectMain,
  cycle: cycleMain,
  backlog: backlogMain,
  doc: docMain,
}

async function run() {
  const [command, ...rest] = process.argv.slice(2)

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE)
    process.exitCode = command ? 0 : 1
    return
  }

  const handler = COMMANDS[command]
  if (!handler) {
    console.error(`알 수 없는 명령: ${command}\n${USAGE}`)
    process.exitCode = 1
    return
  }
  await handler(rest)
}

run().catch((err) => {
  // 사용자 안내(UsageError·RestFailure)는 스택 없이, 그 외는 원인 추적을 위해 그대로 노출한다.
  // 어느 쪽이든 PAT는 등장하지 않는다(rest.ts·workspace-api.ts가 헤더에만 쓰고 로그엔 안 씀).
  const quiet = err instanceof ArgsUsageError || err instanceof UploadUsageError || err instanceof RestFailure
  console.error(quiet ? err.message : err)
  process.exitCode = 1
})
