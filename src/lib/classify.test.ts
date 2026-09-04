import { describe, expect, it } from 'vitest'
import { classify, extractFirstHeading, titleFromFilename } from './classify.ts'

describe('classify', () => {
  it('k1: 새 배치 PDCA 경로 → kind=pdca, stage·title(사이클명)·dir·stem·version', () => {
    const result = classify(
      'docs/PDCA/v1/v1.2.0-enhance-lyric-sync/v1.2.0-enhance-lyric-sync.plan.md',
      '# 아무 제목',
    )
    expect(result).toEqual({
      kind: 'pdca',
      stage: 'plan',
      title: 'enhance-lyric-sync',
      dir: 'docs/PDCA/v1/v1.2.0-enhance-lyric-sync',
      stem: 'v1.2.0-enhance-lyric-sync',
      version: 'v1.2.0',
    })
  })

  it('k2: 옛 배치 경로도 pdca — version null', () => {
    const result = classify('docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.report.md', '# 무관')
    expect(result).toEqual({
      kind: 'pdca',
      stage: 'report',
      title: 'refine-cycle-closing',
      dir: 'docs/PDCA/2026-08/refine-cycle-closing',
      stem: 'refine-cycle-closing',
      version: null,
    })
  })

  it('k3: 비매칭 경로 → general + 첫 헤딩 title', () => {
    const result = classify('docs/deploy/CHECKLIST.md', '# 배포 체크리스트\n\n내용')
    expect(result).toEqual({ kind: 'general', title: '배포 체크리스트' })
  })

  it('k4: H1 없이 H2로 시작 → 그 H2가 title', () => {
    const result = classify('docs/RULE.md', '## PDCA 문서\n\n- 내용')
    expect(result).toEqual({ kind: 'general', title: 'PDCA 문서' })
  })

  it('k5: 프론트매터 스킵 후 첫 헤딩', () => {
    const content = '---\ntemplate: plan\nversion: 1.3\n---\n\n# 진짜 제목\n'
    expect(extractFirstHeading(content)).toBe('진짜 제목')
  })

  it('k6: 코드펜스 안의 #은 헤딩이 아니다', () => {
    const content = '```\n# 이건 코드 주석\n```\n\n# 진짜 헤딩'
    expect(extractFirstHeading(content)).toBe('진짜 헤딩')
  })

  it('k7: 헤딩 전무 → 파일명(확장자 제거)', () => {
    const result = classify('docs/notes.md', '그냥 텍스트, 헤딩 없음')
    expect(result).toEqual({ kind: 'general', title: 'notes' })
  })

  it('k8: docs/PDCA/_INDEX.md → general', () => {
    const result = classify('docs/PDCA/_INDEX.md', '# PDCA Index\n')
    expect(result).toEqual({ kind: 'general', title: 'PDCA Index' })
  })

  it('k9: 질문 파일은 general로 흡수된다(업로드 전 지워야 하는 파일이라 경고 대상)', () => {
    const result = classify('docs/PDCA/v1/v1.0.0-x/v1.0.0-x.q1.md', '# 질문')
    expect(result).toEqual({ kind: 'general', title: '질문' })
  })
})

describe('titleFromFilename', () => {
  it('경로의 마지막 세그먼트에서 .md 확장자만 제거한다', () => {
    expect(titleFromFilename('docs/deploy/CHECKLIST.md')).toBe('CHECKLIST')
    expect(titleFromFilename('RULE.md')).toBe('RULE')
  })
})
