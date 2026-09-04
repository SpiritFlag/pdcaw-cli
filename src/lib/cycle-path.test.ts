import { describe, expect, it } from 'vitest'
import {
  PDCA_STAGES,
  compareVersions,
  cycleStagePath,
  isVersion,
  majorDirOf,
  parseCycleStagePath,
  splitStem,
} from './cycle-path.ts'

describe('parseCycleStagePath', () => {
  it('t1: 새 배치 — 6 stage 전수, dir·stem·version·name 복원', () => {
    for (const stage of PDCA_STAGES) {
      const path = `docs/PDCA/v1/v1.2.0-enhance-lyric-sync/v1.2.0-enhance-lyric-sync.${stage}.md`
      expect(parseCycleStagePath(path)).toEqual({
        dir: 'docs/PDCA/v1/v1.2.0-enhance-lyric-sync',
        stem: 'v1.2.0-enhance-lyric-sync',
        version: 'v1.2.0',
        name: 'enhance-lyric-sync',
        stage,
      })
    }
  })

  it('t2: 옛 배치(연월 폴더, 버전 접두 없음)도 읽는다 — version null, name=stem', () => {
    expect(
      parseCycleStagePath('docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.plan.md'),
    ).toEqual({
      dir: 'docs/PDCA/2026-08/refine-cycle-closing',
      stem: 'refine-cycle-closing',
      version: null,
      name: 'refine-cycle-closing',
      stage: 'plan',
    })
  })

  it('t3: 파싱 성공 경로를 cycleStagePath로 재조립하면 원 경로가 나온다', () => {
    const path = 'docs/PDCA/v0/v0.13.2-refine-backlog/v0.13.2-refine-backlog.report.md'
    const parsed = parseCycleStagePath(path)
    expect(parsed).not.toBeNull()
    expect(cycleStagePath(parsed!.dir, parsed!.stage)).toBe(path)
  })

  it('t4: docs/PDCA/_INDEX.md 은 null', () => {
    expect(parseCycleStagePath('docs/PDCA/_INDEX.md')).toBeNull()
  })

  it('t5: 폴더명과 파일 어간이 다르면 null (자기식별 강제)', () => {
    expect(parseCycleStagePath('docs/PDCA/v1/foo/bar.plan.md')).toBeNull()
    expect(parseCycleStagePath('docs/PDCA/v1/v1.0.0-foo/foo.plan.md')).toBeNull()
  })

  it('t6: 확장자·stage가 형태를 벗어나면 null', () => {
    expect(parseCycleStagePath('docs/PDCA/v1/foo/foo.plan.txt')).toBeNull()
    expect(parseCycleStagePath('docs/PDCA/v1/foo/foo.unknown.md')).toBeNull()
  })

  it('t7: docs/PDCA 접두를 벗어나면 null', () => {
    expect(parseCycleStagePath('docs/RULE.md')).toBeNull()
    expect(parseCycleStagePath('src/foo/foo.plan.md')).toBeNull()
  })

  it('t8: 상위 경로 깊이는 자유 — docs/PDCA 바로 아래 폴더도 읽는다', () => {
    expect(parseCycleStagePath('docs/PDCA/foo/foo.design.md')).toEqual({
      dir: 'docs/PDCA/foo',
      stem: 'foo',
      version: null,
      name: 'foo',
      stage: 'design',
    })
  })

  it('t9: 질문 파일(*.q1.md)은 stage가 아니라 null', () => {
    expect(parseCycleStagePath('docs/PDCA/v1/v1.0.0-x/v1.0.0-x.q1.md')).toBeNull()
  })
})

describe('splitStem', () => {
  it('s1: 버전 접두를 가른다', () => {
    expect(splitStem('v1.2.0-enhance-x')).toEqual({ version: 'v1.2.0', name: 'enhance-x' })
  })
  it('s2: 접두가 없으면 version null', () => {
    expect(splitStem('enhance-x')).toEqual({ version: null, name: 'enhance-x' })
  })
  it('s3: 버전만 있고 이름이 없으면 접두로 보지 않는다', () => {
    expect(splitStem('v1.2.0')).toEqual({ version: null, name: 'v1.2.0' })
  })
})

describe('version helpers', () => {
  it('v1: isVersion', () => {
    expect(isVersion('v0.1.0')).toBe(true)
    expect(isVersion('0.1.0')).toBe(false)
    expect(isVersion('v1.2')).toBe(false)
  })
  it('v2: compareVersions는 숫자로 비교한다(v0.10.0 > v0.9.0)', () => {
    expect(compareVersions('v0.10.0', 'v0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('v1.0.0', 'v1.0.0')).toBe(0)
    expect(['v1.0.0', 'v0.2.0', 'v0.10.0'].sort(compareVersions)).toEqual(['v0.2.0', 'v0.10.0', 'v1.0.0'])
  })
  it('v3: majorDirOf', () => {
    expect(majorDirOf('v1.2.3')).toBe('v1')
    expect(() => majorDirOf('1.2.3')).toThrow()
  })
})
