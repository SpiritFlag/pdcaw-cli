import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listCycleDirs, listStageDocs, pickCycleDirByVersion, sortStageDocs } from './cycle-dir.ts'

let root: string

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'pdcaw-'))
  const files = [
    'docs/PDCA/_INDEX.md',
    'docs/PDCA/v1/v1.2.0-enhance-x/v1.2.0-enhance-x.plan.md',
    'docs/PDCA/v1/v1.2.0-enhance-x/v1.2.0-enhance-x.report.md',
    'docs/PDCA/v1/v1.2.1-fix-y/v1.2.1-fix-y.release.md',
    'docs/PDCA/v0/v0.9.0-adopt-z/v0.9.0-adopt-z.report.md',
    'docs/PDCA/2026-08/refine-old/refine-old.report.md',
    'docs/PDCA/v1/not-a-cycle/README.md',
  ]
  for (const f of files) {
    await mkdir(path.join(root, path.dirname(f)), { recursive: true })
    await writeFile(path.join(root, f), '# x\n')
  }
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('listCycleDirs', () => {
  it('c1: stage 파일이 있는 폴더만 사이클로 본다', async () => {
    const dirs = await listCycleDirs(root)
    expect(dirs.map((d) => d.dir).sort()).toEqual([
      'docs/PDCA/2026-08/refine-old',
      'docs/PDCA/v0/v0.9.0-adopt-z',
      'docs/PDCA/v1/v1.2.0-enhance-x',
      'docs/PDCA/v1/v1.2.1-fix-y',
    ])
  })
  it('c2: 없는 루트면 빈 배열', async () => {
    expect(await listCycleDirs(path.join(root, 'nope'))).toEqual([])
  })
})

describe('pickCycleDirByVersion', () => {
  it('c3: 버전으로 한 건', async () => {
    const dirs = await listCycleDirs(root)
    expect(pickCycleDirByVersion(dirs, 'v1.2.1')).toMatchObject({ name: 'fix-y', stem: 'v1.2.1-fix-y' })
  })
  it('c4: 없으면 에러', async () => {
    const dirs = await listCycleDirs(root)
    expect(() => pickCycleDirByVersion(dirs, 'v9.9.9')).toThrow(/사이클 폴더가 없습니다/)
  })
})

describe('listStageDocs', () => {
  it('c5: stage 하나를 버전순으로, 옛 배치는 뒤에', async () => {
    const docs = await listStageDocs(root, 'report')
    expect(docs.map((d) => d.relPath)).toEqual([
      'docs/PDCA/v0/v0.9.0-adopt-z/v0.9.0-adopt-z.report.md',
      'docs/PDCA/v1/v1.2.0-enhance-x/v1.2.0-enhance-x.report.md',
      'docs/PDCA/2026-08/refine-old/refine-old.report.md',
    ])
  })
  it('c6: --major로 메이저 폴더를 좁힌다', async () => {
    const docs = await listStageDocs(root, 'report', 'v1')
    expect(docs.map((d) => d.stem)).toEqual(['v1.2.0-enhance-x'])
  })
})

describe('sortStageDocs', () => {
  it('c7: 순수 정렬', () => {
    const sorted = sortStageDocs([
      { version: null, relPath: 'b' },
      { version: 'v0.10.0', relPath: 'x' },
      { version: 'v0.9.0', relPath: 'y' },
      { version: null, relPath: 'a' },
    ])
    expect(sorted.map((d) => d.relPath)).toEqual(['y', 'x', 'a', 'b'])
  })
})
