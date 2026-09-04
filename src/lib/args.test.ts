import { describe, expect, it } from 'vitest'
import { UsageError, parseFlags, splitList } from './args.ts'

const SPEC = { status: 'string', stale: 'string', all: 'boolean', path: 'list' } as const
const USAGE = 'usage'

describe('parseFlags', () => {
  it('p1: string · boolean · list · positional을 가른다', () => {
    const r = parseFlags(['get', 'abc', '--status', 'todo', '--all', '--path', 'a', '--path', 'b'], SPEC, USAGE)
    expect(r.positionals).toEqual(['get', 'abc'])
    expect(r.flags).toEqual({ status: 'todo', all: true, path: ['a', 'b'] })
    expect(r.json).toBe(false)
  })

  it('p2: --json은 명세 없이 항상 인정된다', () => {
    const r = parseFlags(['--json'], SPEC, USAGE)
    expect(r.json).toBe(true)
    expect(r.flags).toEqual({})
  })

  it('p3: --name=value 형태도 받는다', () => {
    const r = parseFlags(['--status=done'], SPEC, USAGE)
    expect(r.flags.status).toBe('done')
  })

  it('p4: 값이 필요한 옵션에 값이 없으면 UsageError', () => {
    expect(() => parseFlags(['--status'], SPEC, USAGE)).toThrow(UsageError)
    expect(() => parseFlags(['--status', '--all'], SPEC, USAGE)).toThrow(UsageError)
  })

  it('p5: 모르는 옵션은 UsageError', () => {
    expect(() => parseFlags(['--nope'], SPEC, USAGE)).toThrow(UsageError)
  })
})

describe('splitList', () => {
  it('l1: 쉼표 구분, 공백 제거, 빈 조각 제거', () => {
    expect(splitList('a, b,,c ')).toEqual(['a', 'b', 'c'])
    expect(splitList(undefined)).toEqual([])
  })
})
