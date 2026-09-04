import { describe, expect, it } from 'vitest'
import { findBacklogById, formatRestError, isUuid } from './rest.ts'

const items = [
  { id: '11111111-aaaa-4000-8000-000000000000', title: 'A' },
  { id: '11111111-bbbb-4000-8000-000000000000', title: 'B' },
  { id: '22222222-cccc-4000-8000-000000000000', title: 'C' },
]

describe('findBacklogById', () => {
  it('i1: 전체 id 정확 일치', () => {
    expect(findBacklogById(items, '22222222-cccc-4000-8000-000000000000').title).toBe('C')
  })
  it('i2: 8자 이상 접두로 유일하면 찾는다', () => {
    expect(findBacklogById(items, '11111111-bbbb').title).toBe('B')
  })
  it('i3: 접두가 여럿에 걸리면 에러', () => {
    expect(() => findBacklogById(items, '11111111')).toThrow(/2건/)
  })
  it('i4: 8자 미만 접두는 거부', () => {
    expect(() => findBacklogById(items, '1111')).toThrow(/8자/)
  })
  it('i5: 없으면 에러', () => {
    expect(() => findBacklogById(items, '99999999-0000')).toThrow(/찾을 수 없습니다/)
  })
})

describe('isUuid', () => {
  it('u1: 전체 uuid만 참', () => {
    expect(isUuid('11111111-aaaa-4000-8000-000000000000')).toBe(true)
    expect(isUuid('11111111-aaaa')).toBe(false)
  })
})

describe('formatRestError', () => {
  it('e1: fieldErrors가 있으면 줄로 펼친다', () => {
    const s = formatRestError({
      code: 'VALIDATION_ERROR',
      status: 400,
      details: { fieldErrors: { openedOn: ['YYYY-MM-DD 형식이어야 합니다'] } },
    })
    expect(s).toContain('[VALIDATION_ERROR]')
    expect(s).toContain('openedOn: YYYY-MM-DD')
  })
})
