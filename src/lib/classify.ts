// Design Ref: §2.2·§10.2 D-5·D-13 — kind 분기(pdca/general)와 title 추출.
// 파서(cycle-path.ts)는 한 글자도 고치지 않는다(D-3) — 이 파일이 그 결과를 분류로 감싼다.
import { parseCycleStagePath } from './cycle-path.ts'
import type { PdcaStage } from './cycle-path.ts'

export type Classified =
  | { kind: 'pdca'; stage: PdcaStage; title: string; yearMonth: string }
  | { kind: 'general'; title: string }

const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/
const FRONTMATTER_DELIM = '---'
const FENCE_RE = /^```/

/** [순수] 첫 헤딩(레벨 무관) 텍스트를 뽑는다. 프론트매터(---…---)를 건너뛰고, 코드펜스
 * 내부의 '#'은 헤딩으로 보지 않는다(Design D-13, K4·F7·V2 실측 반영). 없으면 null. */
export function extractFirstHeading(content: string): string | null {
  const lines = content.split('\n')
  let i = 0

  if (lines[0]?.trim() === FRONTMATTER_DELIM) {
    i = 1
    while (i < lines.length && lines[i].trim() !== FRONTMATTER_DELIM) i++
    i++ // 닫는 --- 다음 줄부터
  }

  let inFence = false
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = HEADING_RE.exec(line)
    if (match) return match[1]
  }
  return null
}

/** [순수] 파일명에서 title을 도출한다 — 확장자 제거. */
export function titleFromFilename(relPath: string): string {
  const base = relPath.split('/').pop() ?? relPath
  return base.replace(/\.md$/, '')
}

/** [순수] 경로 + 내용으로 kind·stage·title을 결정한다. pdca 매칭이면 title은 사이클명
 * (원본 D-59 계승 — ImportDialog와 정합). 비매칭이면 general — 첫 헤딩, 없으면 파일명(K4). */
export function classify(relPath: string, content: string): Classified {
  const parsed = parseCycleStagePath(relPath)
  if (parsed) {
    return { kind: 'pdca', stage: parsed.stage, title: parsed.name, yearMonth: parsed.yearMonth }
  }

  const heading = extractFirstHeading(content)
  return { kind: 'general', title: heading ?? titleFromFilename(relPath) }
}
