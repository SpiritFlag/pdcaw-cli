// Design Ref: §5.1 D-12 — 신규 단위 테스트. analysis v0.1 GAP-2 대응
// (parseArgs 자체를 겨냥한 테스트가 없었음 — 코드는 맞았으나 회귀 방지 커버리지가 없었다).
import { describe, expect, it } from 'vitest'
import { UsageError, parseArgs } from './upload.ts'

describe('parseArgs', () => {
  it('a1: --cycle/--version/--all 없이 기본값', () => {
    const args = parseArgs([])
    expect(args).toEqual({ all: false, path: [] })
  })

  it('a2: --path는 여러 번 지정하면 누적된다', () => {
    const args = parseArgs(['--path', 'a.md', '--path', 'b'])
    expect(args.path).toEqual(['a.md', 'b'])
  })

  it('a3: --version은 vX.Y.Z 형식이 아니면 에러', () => {
    expect(() => parseArgs(['--cycle', 'x', '--version', '1.0'])).toThrow(UsageError)
  })

  it('a4: --version은 --cycle 없이 못 쓴다', () => {
    expect(() => parseArgs(['--version', 'v0.1.0'])).toThrow(UsageError)
  })

  it('a5: --path + --all 조합은 배타 에러 (D-12)', () => {
    expect(() => parseArgs(['--path', 'a.md', '--all'])).toThrow(UsageError)
  })

  it('a6: --path + --cycle 조합은 배타 에러 (D-12)', () => {
    expect(() => parseArgs(['--path', 'a.md', '--cycle', 'x'])).toThrow(UsageError)
  })

  it('a7: --path + --version 조합은 배타 에러 (D-12)', () => {
    expect(() => parseArgs(['--path', 'a.md', '--cycle', 'x', '--version', 'v0.1.0'])).toThrow(UsageError)
  })

  it('a8: --path 단독 또는 다른 옵션과의 조합(비배타 옵션)은 허용된다', () => {
    expect(() => parseArgs(['--path', 'a.md', '--project', 'x', '--base-url', 'http://x'])).not.toThrow()
  })

  it('a9: 알 수 없는 옵션은 에러', () => {
    expect(() => parseArgs(['--unknown'])).toThrow(UsageError)
  })
})
