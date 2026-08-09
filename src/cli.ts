#!/usr/bin/env node
// Design Ref: §2.1 — 서브커맨드 라우팅만. 로직은 commands/*로 위임한다.
import { UsageError, main as uploadMain } from './commands/upload.ts'

const USAGE = 'usage: pdcaw <command> [옵션]\n\ncommands:\n  upload   PDCA 문서를 워크스페이스 서버에 동기화'

async function run() {
  const [command, ...rest] = process.argv.slice(2)

  if (command === 'upload') {
    await uploadMain(rest)
    return
  }

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE)
    process.exitCode = command ? 0 : 1
    return
  }

  console.error(`알 수 없는 명령: ${command}\n${USAGE}`)
  process.exitCode = 1
}

run().catch((err) => {
  // UsageError는 사용자 안내라 스택 없이, 그 외는 원인 추적을 위해 그대로 노출한다.
  // 어느 쪽이든 PAT는 등장하지 않는다(FR-84 — workspace-api.ts가 헤더에만 쓰고 로그엔 안 씀).
  console.error(err instanceof UsageError ? err.message : err)
  process.exitCode = 1
})
