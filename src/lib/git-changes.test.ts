// 원본: PDCA-workspace scripts/lib/git-changes.test.ts — 이식(케이스 ID·내용 무수정).
// parseDiffLines·parseStatusLines는 pathspec과 무관한 순수 함수라 이식에 영향 없음.
import { describe, expect, it } from 'vitest'
import { parseDiffLines, parseStatusLines } from './git-changes.ts'

describe('parseDiffLines', () => {
  it('g1: M/A 표본을 modified/added로 판정한다', () => {
    const stdout = 'M\tdocs/PDCA/2026-08/x/x.plan.md\nA\tdocs/PDCA/2026-08/x/x.design.md\n'
    expect(parseDiffLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/x/x.plan.md', kind: 'modified' },
      { path: 'docs/PDCA/2026-08/x/x.design.md', kind: 'added' },
    ])
  })

  it('g2: R100\\told\\tnew 는 renamed + renamedFrom', () => {
    const stdout = 'R100\tdocs/PDCA/2026-08/x/x.plan.md\tdocs/PDCA/2026-08/y/y.plan.md\n'
    expect(parseDiffLines(stdout)).toEqual([
      {
        path: 'docs/PDCA/2026-08/y/y.plan.md',
        kind: 'renamed',
        renamedFrom: 'docs/PDCA/2026-08/x/x.plan.md',
      },
    ])
  })

  it('g3: D 는 deleted', () => {
    const stdout = 'D\tdocs/PDCA/2026-08/x/x.plan.md\n'
    expect(parseDiffLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/x/x.plan.md', kind: 'deleted' },
    ])
  })

  it('g5: 경로에 공백이 있어도 온전히 보존한다', () => {
    const stdout = 'M\tdocs/PDCA/2026-08/x y/x y.plan.md\n'
    expect(parseDiffLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/x y/x y.plan.md', kind: 'modified' },
    ])
  })

  it('g6: 빈 stdout은 빈 배열', () => {
    expect(parseDiffLines('')).toEqual([])
  })
})

describe('parseStatusLines', () => {
  it('g4: ?? / " M" / " D" 를 untracked/modified/deleted로 판정한다', () => {
    const stdout = '?? docs/PDCA/2026-08/x/x.plan.md\n M docs/PDCA/2026-08/y/y.plan.md\n D docs/PDCA/2026-08/z/z.plan.md\n'
    expect(parseStatusLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/x/x.plan.md', kind: 'untracked' },
      { path: 'docs/PDCA/2026-08/y/y.plan.md', kind: 'modified' },
      { path: 'docs/PDCA/2026-08/z/z.plan.md', kind: 'deleted' },
    ])
  })

  it('g5: porcelain 경로에 공백이 있어도 온전히 보존한다', () => {
    const stdout = '?? docs/PDCA/2026-08/x y/x y.plan.md\n'
    expect(parseStatusLines(stdout)).toEqual([
      { path: 'docs/PDCA/2026-08/x y/x y.plan.md', kind: 'untracked' },
    ])
  })

  it('g6: 빈 stdout은 빈 배열', () => {
    expect(parseStatusLines('')).toEqual([])
  })
})
