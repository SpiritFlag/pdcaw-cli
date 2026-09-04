// pdcaw doc collect — 로컬 docs/PDCA에서 한 stage를 모은다. 서버 불요.
// GUI 파일 선택기(웹 클로드 업로드)에 여러 폴더의 report를 한 번에 넘기려는 용도.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseFlags, UsageError } from '../lib/args.ts'
import { prepareLocal } from '../lib/context.ts'
import { listStageDocs } from '../lib/cycle-dir.ts'
import { PDCA_STAGES } from '../lib/cycle-path.ts'
import type { PdcaStage } from '../lib/cycle-path.ts'
import { createEmitter } from '../lib/output.ts'

const USAGE = [
  'usage: pdcaw doc collect --stage <plan|design|do|analysis|report|release> --out <dir|file.md>',
  '                         [--major vN] [--json]',
  '',
  '  --out 이 .md 로 끝나면 한 파일로 이어붙인다(문서마다 경로 헤딩). 아니면 폴더로 복사한다.',
].join('\n')

const SPEC = { stage: 'string', out: 'string', major: 'string' } as const

function fail(msg: string): never {
  throw new UsageError(`${msg}\n${USAGE}`)
}

/** [순수] 이어붙이기 형식. 문서 사이에 구분선 + 경로 헤딩. */
export function concatDocs(docs: Array<{ relPath: string; content: string }>): string {
  return docs
    .map((d) => `<!-- ${d.relPath} -->\n\n${d.content.trimEnd()}\n`)
    .join('\n---\n\n')
}

export async function main(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return
  }
  const { flags, json, positionals } = parseFlags(argv, SPEC, USAGE)
  const [sub] = positionals
  if (sub !== 'collect') fail(`알 수 없는 하위 명령: ${sub ?? '(없음)'}`)
  if (!flags.stage || !PDCA_STAGES.includes(flags.stage as PdcaStage)) fail(`--stage 는 ${PDCA_STAGES.join(' | ')} 중 하나여야 합니다`)
  if (!flags.out) fail('--out 이 필요합니다')
  if (flags.major && !/^v\d+$/.test(flags.major)) fail('--major 는 v1 형식이어야 합니다')

  const emit = createEmitter(json)
  const repoRoot = await prepareLocal()
  const docs = await listStageDocs(repoRoot.root, flags.stage as PdcaStage, flags.major)
  if (docs.length === 0) {
    emit.result({ count: 0, files: [] }, () => `${flags.stage} 문서 없음`)
    return
  }

  const outAbs = path.resolve(process.cwd(), flags.out)
  const asFile = flags.out.endsWith('.md')

  if (asFile) {
    const contents = await Promise.all(
      docs.map(async (d) => ({ relPath: d.relPath, content: await readFile(path.join(repoRoot.root, d.relPath), 'utf-8') })),
    )
    await mkdir(path.dirname(outAbs), { recursive: true })
    await writeFile(outAbs, concatDocs(contents), 'utf-8')
    emit.result({ count: docs.length, out: outAbs, files: docs.map((d) => d.relPath) }, () =>
      `${docs.length}건 → ${outAbs}\n${docs.map((d) => `  ${d.relPath}`).join('\n')}`,
    )
    return
  }

  await mkdir(outAbs, { recursive: true })
  const copied: string[] = []
  for (const d of docs) {
    const dest = path.join(outAbs, path.basename(d.relPath))
    await copyFile(path.join(repoRoot.root, d.relPath), dest)
    copied.push(dest)
  }
  emit.result({ count: docs.length, out: outAbs, files: copied }, () =>
    `${docs.length}건 → ${outAbs}/\n${copied.map((c) => `  ${path.basename(c)}`).join('\n')}`,
  )
}
