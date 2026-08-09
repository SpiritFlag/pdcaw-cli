// 원본: PDCA-workspace src/features/cycle/lib/cyclePath.ts (7차 사이클 refine-cycle-closing 산출물)
// 이식: 로직 무수정 복사본(Design D-3) — 단일 원천 통합은 이월(Plan §2.2)
// 사이클↔문서 경로 규칙 단일 원천: docs/PDCA/{yearMonth}/{name}/{name}.{stage}.md
export type PdcaStage = 'plan' | 'design' | 'analysis' | 'report'
export const PDCA_STAGES: PdcaStage[] = ['plan', 'design', 'analysis', 'report']

export function cycleStagePath(yearMonth: string, name: string, stage: PdcaStage): string {
  return `docs/PDCA/${yearMonth}/${name}/${name}.${stage}.md`
}

export type ParsedCyclePath = { yearMonth: string; name: string; stage: PdcaStage }

const CYCLE_PATH_RE =
  /^docs\/PDCA\/(\d{4}-\d{2})\/([^/]+)\/([^/]+)\.(plan|design|analysis|report)\.md$/

// Design Ref: §3.2 — cycleStagePath의 역함수. 디렉터리명과 파일명 어간의 일치를 강제해
// 자기식별을 보장한다(RULE.md 파일명 규칙). 사이클명 문자집합 검증은 하지 않는다 —
// 그건 서버 cycleNameSchema의 몫이라, 파서가 막으면 서버가 거부할 파일이 조용히 건너뛰어져
// 원인이 숨는다.
// Plan SC: C27·C29 — git이 준 경로에서 사이클명·stage를 되찾아야 대상 목록을 만들 수 있다.
export function parseCycleStagePath(path: string): ParsedCyclePath | null {
  const match = CYCLE_PATH_RE.exec(path)
  if (!match) return null
  const [, yearMonth, dirName, fileStem, stage] = match
  if (dirName !== fileStem) return null
  return { yearMonth, name: dirName, stage: stage as PdcaStage }
}
