// Design Ref: §8.2 — 신규 단위 테스트 p1~p5 (p5는 GAP-1 회귀 테스트, analysis v0.1)
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TargetsError, resolvePathTargets } from './targets.ts'

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'pdcaw-targets-'))
  mkdirSync(path.join(root, 'docs', 'sub'), { recursive: true })
  writeFileSync(path.join(root, 'docs', 'a.md'), '# a')
  writeFileSync(path.join(root, 'docs', 'sub', 'b.md'), '# b')
  writeFileSync(path.join(root, 'docs', 'notes.txt'), 'not markdown')
  return root
}

describe('resolvePathTargets', () => {
  it('p1: 파일·폴더 혼합 지정 → 합집합, 중복 제거', async () => {
    const root = makeRepo()
    try {
      const { targets } = await resolvePathTargets(root, root, ['docs/a.md', 'docs/sub', 'docs/a.md'])
      const paths = targets.map((t) => t.path).sort()
      expect(paths).toEqual(['docs/a.md', 'docs/sub/b.md'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('p2: 비-.md 파일을 직접 지정하면 skip 목록에 사유와 함께 담긴다', async () => {
    const root = makeRepo()
    try {
      const { targets, skipped } = await resolvePathTargets(root, root, ['docs/notes.txt'])
      expect(targets).toEqual([])
      expect(skipped[0]).toContain('.md 아님')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('p3: 레포 루트 밖 경로는 에러', async () => {
    const root = makeRepo()
    try {
      await expect(resolvePathTargets(root, root, ['../outside.md'])).rejects.toThrow(TargetsError)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('p4: 존재하지 않는 경로는 서버 요청 전에 전체 중단(D-18)', async () => {
    const root = makeRepo()
    try {
      await expect(resolvePathTargets(root, root, ['docs/missing.md'])).rejects.toThrow(TargetsError)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('p5: 상대경로는 repoRoot가 아니라 cwd 기준으로 해석된다 (Design D-17, GAP-1 회귀)', async () => {
    const root = makeRepo()
    const subCwd = path.join(root, 'docs', 'sub')
    try {
      // cwd가 docs/sub일 때 상대경로 '../a.md'는 docs/a.md를 가리켜야 한다.
      // repoRoot 기준으로 잘못 해석하면(고치기 전 동작) root/../a.md = repo 밖 경로가 되어
      // TargetsError(레포 밖)나 존재하지 않음 에러가 난다 — 이 테스트는 그 회귀를 잡는다.
      const { targets } = await resolvePathTargets(root, subCwd, ['../a.md'])
      expect(targets.map((t) => t.path)).toEqual(['docs/a.md'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
