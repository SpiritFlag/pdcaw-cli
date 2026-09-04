import { describe, expect, it } from 'vitest'
import { UsageError, parseArgs } from './upload.ts'

describe('parseArgs', () => {
  it('a1: 옵션 없이 기본값', () => {
    const args = parseArgs([])
    expect(args).toEqual({ all: false, path: [] })
  })

  it('a2: --path는 여러 번 지정하면 누적된다', () => {
    const args = parseArgs(['--path', 'a.md', '--path', 'b'])
    expect(args.path).toEqual(['a.md', 'b'])
  })

  it('a3: --version은 vX.Y.Z 형식이 아니면 에러', () => {
    expect(() => parseArgs(['--version', '1.0'])).toThrow(UsageError)
  })

  it('a4: --version 단독으로 쓴다(사이클명은 폴더에서 얻는다)', () => {
    expect(parseArgs(['--version', 'v0.1.0'])).toEqual({ all: false, path: [], version: 'v0.1.0' })
  })

  it('a5: --path + --all 조합은 배타 에러', () => {
    expect(() => parseArgs(['--path', 'a.md', '--all'])).toThrow(UsageError)
  })

  it('a6: --cycle 은 없어졌다 — 안내와 함께 에러', () => {
    expect(() => parseArgs(['--cycle', 'x'])).toThrow(/--cycle 은 없어졌습니다/)
  })

  it('a7: --path + --version 조합은 배타 에러', () => {
    expect(() => parseArgs(['--path', 'a.md', '--version', 'v0.1.0'])).toThrow(UsageError)
  })

  it('a8: --path 단독 또는 다른 옵션과의 조합(비배타 옵션)은 허용된다', () => {
    expect(() => parseArgs(['--path', 'a.md', '--project', 'x', '--base-url', 'http://x'])).not.toThrow()
  })

  it('a9: 알 수 없는 옵션은 에러', () => {
    expect(() => parseArgs(['--unknown'])).toThrow(UsageError)
  })
})
