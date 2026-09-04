import { describe, expect, it } from 'vitest'
import { filterBacklog, findBacklogById, formatRestError, prependDetail } from './rest.ts'
import type { BacklogItem } from './rest.ts'

function item(over: Partial<BacklogItem>): BacklogItem {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    projectId: 'p',
    title: 't',
    priority: 'medium',
    status: 'todo',
    detail: null,
    openedOn: '2026-08-01',
    closedOn: null,
    sortOrder: 0,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  }
}

const NOW = new Date('2026-09-04T00:00:00Z')

describe('filterBacklog', () => {
  const items = [
    item({ id: 'a'.repeat(36), title: '오래된 todo', status: 'todo', updatedAt: '2026-08-01T00:00:00Z' }),
    item({ id: 'b'.repeat(36), title: '최근 todo', status: 'todo', updatedAt: '2026-09-03T00:00:00Z' }),
    item({ id: 'c'.repeat(36), title: '오래된 done', status: 'done', updatedAt: '2026-07-01T00:00:00Z', detail: '가사 싱크' }),
  ]

  it('f1: 상태 필터', () => {
    expect(filterBacklog(items, { statuses: ['done'] }).map((i) => i.title)).toEqual(['오래된 done'])
  })

  it('f2: 정체 필터는 todo에만 걸린다', () => {
    expect(filterBacklog(items, { staleDays: 14, now: NOW }).map((i) => i.title)).toEqual(['오래된 todo'])
  })

  it('f3: 부분일치는 제목·detail 모두, 대소문자 무시', () => {
    expect(filterBacklog(items, { query: '싱크' }).map((i) => i.title)).toEqual(['오래된 done'])
    expect(filterBacklog(items, { query: 'TODO' }).length).toBe(2)
  })

  it('f4: 필터 없음이면 전건', () => {
    expect(filterBacklog(items, {}).length).toBe(3)
  })
})

describe('prependDetail', () => {
  it('d1: 기존 본문 앞에 블록을 얹고 빈 줄로 가른다', () => {
    expect(prependDetail('원안 본문', '[2026-09-04 완료 — 근거: v1.2.0 SC-1]')).toBe(
      '[2026-09-04 완료 — 근거: v1.2.0 SC-1]\n\n원안 본문',
    )
  })
  it('d2: 기존이 비면 블록만', () => {
    expect(prependDetail(null, '블록')).toBe('블록')
    expect(prependDetail('   ', '블록\n')).toBe('블록')
  })
})

describe('findBacklogById', () => {
  const items = [
    item({ id: '11111111-aaaa-4000-8000-000000000000', title: 'A' }),
    item({ id: '11111111-bbbb-4000-8000-000000000000', title: 'B' }),
    item({ id: '22222222-cccc-4000-8000-000000000000', title: 'C' }),
  ]
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
