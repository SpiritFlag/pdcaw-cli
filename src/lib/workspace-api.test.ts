// 원본: PDCA-workspace scripts/lib/workspace-api.test.ts — 이식(케이스 ID·내용 무수정)
import { describe, expect, it } from 'vitest'
import { parseToolEnvelope } from './workspace-api.ts'

describe('parseToolEnvelope', () => {
  it('w1: 정상 봉투(content[0].text가 JSON)는 ok + 파싱된 data', () => {
    const json = { result: { content: [{ type: 'text', text: '{"a":1}' }] } }
    expect(parseToolEnvelope(json)).toEqual({ ok: true, data: { a: 1 } })
  })

  it('w2: isError:true + 텍스트는 ok:false + errorText', () => {
    const json = { result: { isError: true, content: [{ type: 'text', text: '실패 사유' }] } }
    expect(parseToolEnvelope(json)).toEqual({ ok: false, errorText: '실패 사유' })
  })

  it('w3: JSON-RPC error 필드는 ok:false', () => {
    const json = { error: { message: 'boom' } }
    expect(parseToolEnvelope(json)).toEqual({ ok: false, errorText: 'boom' })
  })

  it('w4: text가 비JSON 문자열이면 ok + 원문 문자열', () => {
    const json = { result: { content: [{ type: 'text', text: 'plain text' }] } }
    expect(parseToolEnvelope(json)).toEqual({ ok: true, data: 'plain text' })
  })
})
