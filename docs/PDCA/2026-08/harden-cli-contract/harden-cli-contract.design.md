---
template: design
version: 1.3
---

# harden-cli-contract 설계 문서

> **한 줄 요약**: `DEFAULT_BASE_URL` 프로덕션 기본값을 제거하고, `PDCAW_PAT`·`baseUrl` 중
> 누락된 필수 설정을 한 번에 모아 안내하는 **완전분리형 에러 구조(Option B)**로 재설계한다.
> README는 기존 구조를 유지하되 모순되는 "defaults to prod" 서술을 제거한다.
>
> **프로젝트**: pdcaw
> **버전**: 0.1.0 → 0.2.0 (예정)
> **작성자**: 형
> **작성일**: 2026-08-09
> **상태**: Draft
> **Plan 문서**: [harden-cli-contract.plan.md](./harden-cli-contract.plan.md)

---

## Context Anchor

> Plan에서 복사. Design→Do 인계 시 전략 컨텍스트 유지용.

| Key | Value |
|-----|-------|
| **WHY** | npm 배포로 배포 범위가 "형만 씀"에서 "누구나 설치 가능"으로 바뀌었는데, 프로덕션 기본값이 그 변화를 반영 못 하고 있다 |
| **WHO** | `pdcaw`를 설치하는 제3자 사용자(및 미래의 형 — 설정 누락 시 실수로 프로덕션을 침) |
| **RISK** | README만 고치고 코드 기본값을 남겨두면 문서와 동작이 다시 어긋난다 — 경고 문구 추가 방식이라 기존 "defaults to prod" 서술과 충돌할 수 있음 |
| **SUCCESS** | `baseUrl` 미설정 시 100% 에러로 막힘(프로덕션 요청 0건), README에 모순되는 기본값 서술 없음 |
| **SCOPE** | config.ts 기본값 제거 + 에러 메시지, README 경고 반영, 예시 파일 정리, v0.2.0 릴리즈 |

---

## 1. Overview

### 1.1 설계 목표

1. **무설정 상태에서 절대 프로덕션으로 요청이 나가지 않을 것** — `DEFAULT_BASE_URL` 완전 제거가 전제.
2. **누락된 필수 설정(PAT·baseUrl)을 한 번에 안내할 것** — Checkpoint 3에서 형이 선택한
   Option B(완전분리). 사용자가 PAT 고치고 재실행 → baseUrl도 없다고 다시 안내받는
   왕복을 없앤다.
3. **기존 코드 스타일(`Design Ref:` 주석, 에러 원인 지목형 메시지)을 그대로 따를 것** — 신규
   패턴을 도입하지 않는다.

### 1.2 설계 원칙

- **순수 로직과 I/O 분리 유지** — `mergeConfig`(순수)와 `resolveConfig`(I/O) 경계는 그대로
  둔다. 다만 에러 메시지 조립 로직도 순수 함수로 뽑아 단위 테스트 가능하게 만든다(§2.4).
- **필드별 가이드 = 독립 상수/함수** — PAT 가이드와 baseUrl 가이드는 각각 독립적으로
  존재하고, 누락 목록에 따라 조합된다. 한쪽만 고쳐도 다른 쪽 문구에 영향 없음.

---

## 2. Architecture

### 2.0 설계안 비교 (Checkpoint 3 — 결정 완료)

| 기준 | A: 최소변경 | **B: 완전분리 (선택)** | C: 실용절충 |
|------|:-:|:-:|:-:|
| **접근** | 반환타입만 optional로, 체크 한 줄 추가 | 누락 필드 배열로 모아 한 번에 안내 | PAT_GUIDE와 대칭 상수 추가, 체크만 병렬화 |
| **신규 파일** | 0 | 0 | 0 |
| **변경 파일** | 2 (config.ts, config.test.ts) | 2 (config.ts, config.test.ts) | 2 (config.ts, config.test.ts) |
| **복잡도** | Low | Medium | Low |
| **유지보수성** | Medium (숨은 결합) | High (필드별 독립 가이드 + 합성 함수) | Medium |
| **UX** | 낮음 (한 번에 하나씩만 안내) | **높음 (누락 전체를 한 번에 안내)** | 낮음 (기존과 동일하게 한 번에 하나씩) |
| **공수** | Low | Medium | Low |
| **리스크** | Low | Low (순수 함수라 테스트로 방지) | Low |
| **추천** | 빠른 땜빵 | **기본 선택** | PAT 패턴과의 일관성 우선 시 |

**선택**: Option B — **근거**: 형이 Checkpoint 3에서 명시적으로 완전분리를 선택. 이 사이클
스코프가 작아 리팩토링 부담이 크지 않고(§2.3 참조), 두 필수값이 동시에 없는 상황(신규
사용자의 첫 실행)에서 UX 이득이 확실하다.

> 이하 상세 설계는 Option B 기준.

### 2.1 컴포넌트 다이어그램

```
┌──────────────────┐     ┌──────────────────────┐     ┌────────────────┐
│  upload.ts        │────▶│  resolveConfig()       │────▶│  ConfigError    │
│  (유일한 호출부)   │     │  (I/O: pdcarc 읽기 +   │     │  (누락 필드     │
│                   │     │   mergeConfig 호출 +   │     │   합성 메시지)  │
│                   │     │   누락 검사)            │     │                │
└──────────────────┘     └──────────────────────┘     └────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │  mergeConfig()         │  순수 함수 — 우선순위
                          │  (baseUrl: string|      │  해석만. 기본값 없음.
                          │   undefined 반환)       │
                          └──────────────────────┘
```

### 2.2 데이터 흐름

```
CLI 인자 / env / .pdcarc.json
        │
        ▼
  mergeConfig()  ── baseUrl: string | undefined, projectId?, pat: string | undefined
        │
        ▼
  resolveConfig()
        │
        ├─ missing = [] ; !pat → missing.push('pat') ; !baseUrl → missing.push('baseUrl')
        │
        ├─ missing.length > 0 → buildMissingConfigMessage(missing, hasAnyConfig) 로 조립 → ConfigError throw
        │
        └─ missing.length === 0 → { baseUrl, projectId, pat } 반환 (baseUrl은 이 지점에서 string으로 확정)
```

### 2.3 변경 대상 함수 시그니처

```typescript
// mergeConfig — 순수, 기본값 제거로 반환 타입만 변경
export function mergeConfig(
  cli: CliOverrides,
  env: NodeJS.ProcessEnv,
  pdcarc: Pdcarc,
): { config: { baseUrl: string | undefined; projectId?: string }; pat: string | undefined }

// 필드별 가이드 — 각각 독립 상수 (기존 PAT_GUIDE 스타일 유지)
const FIELD_GUIDE: Record<'pat' | 'baseUrl', string> = {
  pat: /* 기존 PAT_GUIDE 문구 그대로 */,
  baseUrl:
    'PDCAW_BASE_URL이 설정되지 않았습니다.\n' +
    '  본인 소유 self-hosted PDCA-workspace 서버 주소가 필요합니다 (기본값 없음).\n' +
    '  1) CLI 인자 --base-url <url>\n' +
    '  2) 환경변수 PDCAW_BASE_URL=https://... (.env.local)\n' +
    '  3) 레포 루트 .pdcarc.json 의 "baseUrl" 필드',
}

// 누락 목록 → 최종 에러 메시지 합성 — 순수 함수, 단위 테스트 대상
export function buildMissingConfigMessage(
  missing: Array<'pat' | 'baseUrl'>,
  hasAnyConfig: boolean,
): string

// resolveConfig — I/O, missing 배열 계산 후 buildMissingConfigMessage 위임
export function resolveConfig(repoRoot: string, cli: CliOverrides = {}): ResolvedConfig
```

`buildMissingConfigMessage`는 `hasAnyConfig`가 `false`(아무 설정도 없는 완전 초기 상태)일 때만
기존 `NO_CONFIG_GUIDE`에 해당하는 도입부 문장을 앞에 붙이고, 이후 `missing` 배열 순서대로
`FIELD_GUIDE[field]`를 이어붙인다. `missing`이 `['pat']`이나 `['baseUrl']` 하나뿐이면 기존
동작(단일 필드 안내)과 사실상 동일한 메시지가 나온다 — 회귀 없음.

### 2.4 단위 테스트 대상 (신규/변경)

| 대상 | 케이스 |
|------|--------|
| `mergeConfig` | 기존 c1~c3 변경 없음. c4는 "전부 없으면 `baseUrl: undefined`"로 기대값 변경(에러는 더 이상 여기서 안 던짐) |
| `buildMissingConfigMessage` | (신규) `['pat']`만 / `['baseUrl']`만 / `['pat','baseUrl']` 둘 다 / `hasAnyConfig=false`일 때 도입부 포함 여부 |
| `resolveConfig` | 기존 통합 테스트 유지 + baseUrl만 없는 케이스, 둘 다 없는 케이스 추가 (임시 디렉터리 + env 목킹) |

---

## 3. Data Model

N/A — 웹앱/DB 없음. 설정 해석 로직만 다루는 CLI 모듈.

---

## 4. API Specification

N/A — 외부에 노출하는 API 없음. `resolveConfig`/`mergeConfig`/`buildMissingConfigMessage`는
모듈 내부(라이브러리) export일 뿐 HTTP API가 아니다.

---

## 5. UI/UX Design

N/A — CLI 도구. 대신 **에러 메시지 UX**를 §2.3·§6에서 다룬다.

---

## 6. Error Handling

### 6.1 에러 케이스 정의

| 케이스 | 이전 동작 | 신규 동작 |
|--------|----------|----------|
| PAT만 없음 | `PAT_GUIDE`만 출력 | `FIELD_GUIDE.pat`만 출력 (문구 동일) |
| baseUrl만 없음 | (기본값으로 조용히 통과) | `FIELD_GUIDE.baseUrl`만 출력 — **신규 차단** |
| 둘 다 없음, 다른 설정도 전혀 없음 | `NO_CONFIG_GUIDE` + `PAT_GUIDE` | 도입부 + `FIELD_GUIDE.pat` + `FIELD_GUIDE.baseUrl` (한 번에 둘 다 안내) |
| 둘 다 없음, `.pdcarc.json`에 `projectId`만 있음 | `PAT_GUIDE`만(도입부 없음) | `FIELD_GUIDE.pat` + `FIELD_GUIDE.baseUrl` (도입부 없음, 둘 다 안내) |

### 6.2 에러 메시지 조립 규칙

- `ConfigError`(기존 클래스 재사용, 신설 없음)에 `buildMissingConfigMessage()` 결과를 그대로 담는다.
- 필드 순서는 항상 `pat` → `baseUrl` 고정(선언 순서와 무관하게 결정적 출력 — 테스트 안정성).

---

## 7. Security Considerations

- [x] 기존 `SECRET_KEYS` 필터링(.pdcarc.json에 pat/token 키가 있으면 경고, 값은 로그에 안 실음) — 변경 없음, 유지
- [x] baseUrl 에러 메시지에는 사용자가 입력한 값을 그대로 echo하지 않는다(설정값 노출 방지 원칙 유지)
- N/A — 인증/HTTPS/Rate limiting은 서버 측 관심사, 본 사이클 스코프 아님

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| 단위 테스트 | `mergeConfig`, `buildMissingConfigMessage`, `resolveConfig` | vitest | Do |
| 회귀 테스트 | 기존 c1~c3(명시적 설정 케이스) 무변경 통과 | vitest | Check |
| 문서 정합성 | README/`​.pdcarc.example.json`/`.env.local.example`에 프로덕션 URL·"defaults to prod" 서술 없음 | grep | Do/Check |

### 8.2 단위 테스트 시나리오

| # | 대상 | 입력 | 기대 결과 |
|---|------|------|----------|
| 1 | `mergeConfig` | cli/env/.pdcarc 전부 baseUrl 없음 | `config.baseUrl === undefined` (에러 아님, 순수 함수는 던지지 않음) |
| 2 | `mergeConfig` | c1~c3 기존 케이스 | 기존과 동일한 결과 (회귀 없음) |
| 3 | `buildMissingConfigMessage` | `['pat']`, `hasAnyConfig=true` | `FIELD_GUIDE.pat`만 포함, 도입부 없음 |
| 4 | `buildMissingConfigMessage` | `['baseUrl']`, `hasAnyConfig=true` | `FIELD_GUIDE.baseUrl`만 포함 |
| 5 | `buildMissingConfigMessage` | `['pat','baseUrl']`, `hasAnyConfig=false` | 도입부 + 두 가이드 모두 포함, 순서 `pat`→`baseUrl` |
| 6 | `resolveConfig` | 임시 repoRoot(.pdcarc 없음) + env 비움 | `ConfigError` throw, 메시지에 두 가이드 모두 포함 |
| 7 | `resolveConfig` | baseUrl만 env로 설정, PAT 없음 | `ConfigError` throw, `FIELD_GUIDE.pat`만 포함 |
| 8 | `resolveConfig` | PAT·baseUrl 모두 설정 | 정상 반환, `config.baseUrl`이 trailing slash 제거된 값 |

### 8.3 Seed Data Requirements

N/A — DB/시드 데이터 없음. 테스트는 임시 디렉터리 + `process.env` 목킹으로 충분.

---

## 9. Clean Architecture

### 9.1 Layer Structure (기존 구조 유지, 변경 없음)

| Layer | 역할 | 위치 |
|-------|------|------|
| Commands | CLI 인자 파싱, 오케스트레이션 | `src/commands/` |
| Lib (I/O) | 설정 해석, 워크스페이스 API 호출 | `src/lib/config.ts`, `src/lib/workspace-api.ts` |
| Lib (순수) | `mergeConfig`, `buildMissingConfigMessage`, git 해석 등 | `src/lib/config.ts` 내부 export |

### 9.2 이번 사이클의 레이어 배정

| 대상 | 레이어 | 위치 |
|------|--------|------|
| `mergeConfig` | Lib (순수) | `src/lib/config.ts` |
| `buildMissingConfigMessage` | Lib (순수, 신규 export) | `src/lib/config.ts` |
| `resolveConfig` | Lib (I/O) | `src/lib/config.ts` |
| `FIELD_GUIDE` | Lib (순수 상수) | `src/lib/config.ts` |

레이어 구조 자체는 바뀌지 않는다 — 기존 `config.ts` 파일 내부 함수 3~4개 시그니처/본문만 변경.

---

## 10. Coding Convention Reference

기존 프로젝트 컨벤션(`Design Ref:` 주석, camelCase 함수명, `ConfigError` 커스텀 에러 클래스
재사용) 그대로 따른다. 신규 컨벤션 도입 없음.

### 10.4 이번 사이클의 컨벤션 적용

| 항목 | 적용 컨벤션 |
|------|------------|
| 에러 메시지 문구 | 기존 `PAT_GUIDE` 톤(원인 지목 + 번호 매긴 해결 단계) 그대로 `FIELD_GUIDE.baseUrl`에도 적용 |
| 함수명 | camelCase, 동사+명사 (`buildMissingConfigMessage`) |
| 파일 위치 | 신규 파일 생성 없이 `src/lib/config.ts` 내부에 추가 |

---

## 11. Implementation Guide

### 11.1 File Structure (변경 없음)

```
src/
├── lib/
│   ├── config.ts        ← 이번 사이클 변경 대상
│   └── config.test.ts   ← 이번 사이클 변경 대상
├── commands/
│   └── upload.ts         ← 호출부, 변경 없음(에러를 그대로 전파)
README.md                 ← 이번 사이클 변경 대상
.pdcarc.example.json      ← 이번 사이클 변경 대상
.env.local.example        ← 이번 사이클 변경 대상
CHANGELOG.md               ← 이번 사이클 변경 대상
package.json               ← version bump만
```

### 11.2 Implementation Order

1. [ ] `src/lib/config.ts` — `DEFAULT_BASE_URL` 제거, `mergeConfig` 반환 타입 변경
2. [ ] `src/lib/config.ts` — `FIELD_GUIDE` 상수 도입(기존 `PAT_GUIDE` 문구 이관 + `baseUrl` 신설), `NO_CONFIG_GUIDE`를 도입부 전용으로 축소
3. [ ] `src/lib/config.ts` — `buildMissingConfigMessage` 함수 작성, `resolveConfig`가 이를 사용하도록 변경
4. [ ] `src/lib/config.test.ts` — §8.2 테스트 1~8 반영 (기존 c4 교체 포함)
5. [ ] `README.md` — `PDCAW_BASE_URL` 관련 표·본문 수정("optional, defaults to prod" 제거), self-hosted 전용 경고 추가
6. [ ] `.pdcarc.example.json` / `.env.local.example` — baseUrl 예시를 플레이스홀더로 교체
7. [ ] `CHANGELOG.md` — v0.2.0 항목 추가
8. [ ] `package.json` — version `0.2.0`
9. [ ] `npm test && npm run lint && npm run build` 전체 통과 확인

### 11.3 Session Guide

> 변경 규모가 작아 단일 세션으로 충분 — 모듈 분할 불필요.

#### Module Map

| Module | Scope Key | 설명 | 예상 턴 |
|--------|-----------|------|:---:|
| config 로직 + 테스트 | `module-1` | config.ts/config.test.ts 변경 (11.2의 1~4) | 15-20 |
| 문서 정리 + 버전 | `module-2` | README/예시파일/CHANGELOG/package.json (11.2의 5~8) | 10-15 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | 전체 (module-1 + module-2, 단일 세션으로 충분) | 25-35 |
| Session 3 | Check + Report | 전체 | 15-20 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 (Option B 선택 반영) | 형 |
