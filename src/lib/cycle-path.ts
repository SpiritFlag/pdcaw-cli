// 사이클↔문서 경로 규칙 단일 원천 (pdca-skill v1).
//
//   docs/PDCA/<...>/<stem>/<stem>.<stage>.md
//
// 규칙은 하나뿐이다: 폴더명 == 파일 어간(stem). 상위 경로는 자유라서 새 배치
// (docs/PDCA/v1/v1.2.0-enhance-x/…)와 옛 배치(docs/PDCA/2026-08/refine-x/…)를 같은
// 파서가 읽는다. stem이 `vX.Y.Z-name`이면 version·name으로 가르고, 아니면 version은
// null이고 stem 전체가 name이다(옛 배치). 사이클명 문자집합은 검증하지 않는다 —
// 그건 서버 cycleNameSchema의 몫이라, 파서가 막으면 서버가 거부할 파일이 조용히
// 건너뛰어져 원인이 숨는다.
export type PdcaStage = 'plan' | 'design' | 'do' | 'analysis' | 'report' | 'release'
export const PDCA_STAGES: PdcaStage[] = ['plan', 'design', 'do', 'analysis', 'report', 'release']

export type ParsedCyclePath = {
  /** 사이클 폴더 경로. 서버 cycles.dir에 그대로 기록된다. 예: docs/PDCA/v1/v1.2.0-enhance-x */
  dir: string
  /** 폴더명이자 파일 어간. 예: v1.2.0-enhance-x */
  stem: string
  /** stem 앞의 vX.Y.Z. 옛 배치면 null */
  version: string | null
  /** 사이클명. 예: enhance-x */
  name: string
  stage: PdcaStage
}

const CYCLE_PATH_RE =
  /^(docs\/PDCA\/(?:[^/]+\/)*?([^/]+))\/([^/]+)\.(plan|design|do|analysis|report|release)\.md$/

const VERSION_PREFIX_RE = /^(v\d+\.\d+\.\d+)-(.+)$/

/** [순수] stem을 version · name으로 가른다. 접두가 없으면 version null. */
export function splitStem(stem: string): { version: string | null; name: string } {
  const m = VERSION_PREFIX_RE.exec(stem)
  if (!m) return { version: null, name: stem }
  return { version: m[1], name: m[2] }
}

/** [순수] 경로에서 사이클 정보를 되찾는다. 규칙 밖이면 null. */
export function parseCycleStagePath(path: string): ParsedCyclePath | null {
  const m = CYCLE_PATH_RE.exec(path)
  if (!m) return null
  const [, dir, dirName, stem, stage] = m
  if (dirName !== stem) return null
  const { version, name } = splitStem(stem)
  return { dir, stem, version, name, stage: stage as PdcaStage }
}

/** [순수] 사이클 폴더와 stage로 문서 경로를 만든다(파서의 역함수). */
export function cycleStagePath(dir: string, stage: PdcaStage): string {
  const stem = dir.split('/').pop() ?? dir
  return `${dir}/${stem}.${stage}.md`
}

/** [순수] `vX.Y.Z` 형식 검사. */
export function isVersion(s: string): boolean {
  return /^v\d+\.\d+\.\d+$/.test(s)
}

/** [순수] 버전 비교(semver 숫자 비교). a<b → 음수. 형식 밖 문자열은 뒤로 보낸다. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa && !pb) return a.localeCompare(b)
  if (!pa) return 1
  if (!pb) return -1
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

function parseVersion(s: string): [number, number, number] | null {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(s)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** [순수] 메이저 폴더명(`v1`)을 버전에서 얻는다. */
export function majorDirOf(version: string): string {
  const p = parseVersion(version)
  if (!p) throw new Error(`버전 형식이 아닙니다: ${version}`)
  return `v${p[0]}`
}
