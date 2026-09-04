import { describe, expect, it } from 'vitest'
import { concatDocs } from './doc.ts'

describe('concatDocs', () => {
  it('x1: 문서마다 경로 주석 헤딩, 사이에 구분선', () => {
    const out = concatDocs([
      { relPath: 'docs/PDCA/v1/a/a.report.md', content: '# A\n\n본문\n\n' },
      { relPath: 'docs/PDCA/v1/b/b.report.md', content: '# B' },
    ])
    expect(out).toBe('<!-- docs/PDCA/v1/a/a.report.md -->\n\n# A\n\n본문\n\n---\n\n<!-- docs/PDCA/v1/b/b.report.md -->\n\n# B\n')
  })
})
