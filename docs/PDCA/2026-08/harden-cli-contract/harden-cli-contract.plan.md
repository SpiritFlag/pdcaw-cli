# harden-cli-contract Planning Document

> **Summary**: npm에 배포된 `pdcaw`가 self-hosted 서버 전용 클라이언트라는 계약을 코드와 문서 양쪽에서 명확히 한다 — `baseUrl` 프로덕션 기본값을 제거해 무설정 상태로도 형의 서버를 향하지 않게 하고, README에 "범용 도구 아님"을 명시한다.
>
> **Project**: pdcaw
> **Version**: 0.1.0 → 0.2.0 (예정)
> **Author**: 형
> **Date**: 2026-08-09
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | `pdcaw`가 npm에 배포되어 `npx pdcaw`로 누구나 설치할 수 있게 됐는데, `DEFAULT_BASE_URL`이 형 소유 프로덕션 서버(`https://pdca-workspace.vercel.app`)로 하드코딩돼 있어 "설정 없이도 동작하는 범용 도구"처럼 보인다. 실제로는 self-hosted PDCA-workspace 서버 없이는 아무것도 할 수 없는 레포 종속 CLI다. |
| **Solution** | `baseUrl` 기본값을 제거하고 `PDCAW_PAT`와 동일하게 미설정 시 `ConfigError`로 막는다. README는 기존 구조를 유지하되 "self-hosted 서버 필수, 범용 업로드 도구 아님" 경고와 `PDCAW_BASE_URL` 필수화를 반영해 모순되는 기존 문구를 고친다. |
| **Function/UX Effect** | `--base-url`/`PDCAW_BASE_URL`/`.pdcarc.json` 중 아무것도 지정하지 않은 사용자는 이제 조용히 형의 서버로 요청을 보내는 대신, PAT 가이드와 동일한 톤의 에러 메시지로 즉시 설정 방법을 안내받는다. |
| **Core Value** | 배포된 패키지의 실제 동작(레포 종속)과 사용자가 받는 신호(설명·기본값)가 일치한다 — 오배포·오사용을 코드 레벨에서 원천 차단. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | npm 배포로 배포 범위가 "형만 씀"에서 "누구나 설치 가능"으로 바뀌었는데, 프로덕션 기본값이 그 변화를 반영 못 하고 있다 |
| **WHO** | `pdcaw`를 설치하는 제3자 사용자(및 미래의 형 — 설정 누락 시 실수로 프로덕션을 침) |
| **RISK** | README만 고치고 코드 기본값을 남겨두면 문서와 동작이 다시 어긋난다 — 경고 문구 추가 방식이라 기존 "defaults to prod" 서술과 충돌할 수 있음 |
| **SUCCESS** | `baseUrl` 미설정 시 100% 에러로 막힘(프로덕션 요청 0건), README에 모순되는 기본값 서술 없음 |
| **SCOPE** | config.ts 기본값 제거 + 에러 메시지, README 경고 반영, 예시 파일(.pdcarc.example.json/.env.local.example) 정리, v0.2.0 릴리즈 |

---

## 1. Overview

### 1.1 Purpose

`pdcaw`의 설정 계약을 "명시적 설정 없이는 동작 불가"로 강제해, npm 배포로 넓어진 사용자 범위에서도 의도치 않게 형의 프로덕션 서버로 요청이 가는 일을 코드 레벨에서 막는다.

### 1.2 Background

- 직전 사이클(`extract-docs-upload-cli`)에서 이 CLI가 독립 npm 패키지로 이식됐고, 이식 도중 실측으로 "`.env.local` 기본값이 프로덕션"이라는 사실이 발견됐다. 당시엔 "검증 절차에 `--base-url` 명시를 필수화"하는 선에서 문서화만 하고 넘어갔다 (`extract-docs-upload-cli.design.md:340`, `.report.md:171`).
- 이번에 형이 README를 다시 보다가, npm 배포 이후에도 이 기본값이 그대로 남아있으면 "레포 종속 도구"라는 본질과 어긋난다는 걸 지적 — 기본값 자체를 없애기로 방향을 바꿨다.
- `PDCAW_PAT`는 이미 미설정 시 `ConfigError`로 막고 있으므로(`resolveConfig`), `baseUrl`도 같은 패턴을 따르는 게 코드 일관성 면에서도 자연스럽다.

### 1.3 Related Documents

- 참고: 형이 준 README 초안 (본 PDCA 사이클 트리거 프롬프트에 포함)
- 선행 사이클: `docs/PDCA/2026-08/extract-docs-upload-cli/`

---

## 2. Scope

### 2.1 In Scope

- [ ] `src/lib/config.ts` — `DEFAULT_BASE_URL` 상수 제거, `mergeConfig`/`resolveConfig`를 `baseUrl` 미설정 시 `PDCAW_PAT`와 동일하게 `ConfigError`로 처리
- [ ] 에러 가이드 문구(`PAT_GUIDE`, `NO_CONFIG_GUIDE`) — `baseUrl` 필수 안내 반영
- [ ] `src/lib/config.test.ts` — "전부 없으면 기본값(prod)" 케이스(c4)를 "전부 없으면 에러" 케이스로 교체
- [ ] `README.md` — 기존 구조 유지, `PDCAW_BASE_URL` 관련 표·문구를 "필수, 기본값 없음"으로 수정(현재 "optional, defaults to prod" 서술과의 모순 제거 포함), self-hosted 전용임을 알리는 경고 반영
- [ ] `.pdcarc.example.json` / `.env.local.example` — 프로덕션 URL(`https://pdca-workspace.vercel.app`, 실질적으로 진짜 서버 주소)을 예시 placeholder로 교체
- [ ] `CHANGELOG.md` — v0.2.0 항목 추가 (breaking: baseUrl 기본값 제거)
- [ ] `package.json` — `version`을 `0.2.0`으로 변경

### 2.2 Out of Scope

- 업로드 로직(`upload.ts`), git 해석, MCP 클라이언트 등 기존 동작 변경 없음
- `PDCAW_PROJECT_ID` 자동 해석(project_list 폴백) 로직 변경 없음 — 이건 이미 "없으면 에러 아님, 서버에 위임" 정책으로 별개
- README 전체 재작성(형이 준 초안 그대로 갈아엎기)은 제외 — 기존 구조 유지 + 필요한 부분만 수정

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `DEFAULT_BASE_URL` 상수를 제거하고, `baseUrl`이 CLI/env/.pdcarc 어디에도 없으면 `resolveConfig`가 `ConfigError`를 던진다 | High | Pending |
| FR-02 | `baseUrl` 누락 에러 메시지는 `PAT_GUIDE`와 같은 톤으로 설정 방법(`--base-url` / `PDCAW_BASE_URL` / `.pdcarc.json`)을 안내한다. `NO_CONFIG_GUIDE`도 baseUrl을 "선택"이 아닌 필수 항목으로 갱신한다 | High | Pending |
| FR-03 | PAT와 baseUrl이 모두 없을 때 두 에러 안내가 함께(또는 순서대로) 노출되어 사용자가 한 번에 무엇을 설정해야 하는지 안다 | Medium | Pending |
| FR-04 | README의 `PDCAW_BASE_URL` 관련 서술에서 "optional, defaults to prod" 문구를 제거하고 "필수, 기본값 없음"으로 교체한다 | High | Pending |
| FR-05 | README에 self-hosted 서버 없이는 사용할 수 없다는 경고를 기존 구조를 해치지 않는 위치(예: 최상단 또는 Setup 섹션 도입부)에 추가한다 | High | Pending |
| FR-06 | `.pdcarc.example.json`/`.env.local.example`의 `baseUrl` 예시값을 실제 프로덕션 URL이 아닌 플레이스홀더(`https://your-pdca-workspace.example.com` 등)로 교체한다 | Medium | Pending |
| FR-07 | `config.test.ts`의 "전부 없으면 기본값(prod)" 단위 테스트(c4)를 "전부 없으면 `ConfigError`" 케이스로 교체한다 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 일관성 | `baseUrl` 에러 처리가 기존 `PDCAW_PAT` 처리와 코드 패턴·톤 모두 동일 | 코드 리뷰 |
| 하위 호환성 | 이미 `--base-url`/`PDCAW_BASE_URL`/`.pdcarc.json` 중 하나라도 설정한 기존 사용자(형 포함)는 동작에 변화 없음 | 회귀 테스트 |
| 문서 정합성 | README에 "기본값은 prod" 류의 모순 서술이 남지 않음 | grep 확인 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `baseUrl` 미설정 시 `ConfigError` 발생 확인 (단위 테스트 + 실측)
- [ ] `PDCAW_PAT`만 있고 `baseUrl` 없는 조합, 반대 조합, 둘 다 없는 조합 각각의 에러 메시지 확인
- [ ] README에 남아있던 "defaults to prod" 문구 완전 제거 확인 (`grep -n "defaults to prod" README.md` 결과 없음)
- [ ] `.pdcarc.example.json`/`.env.local.example`에 실제 프로덕션 URL 미노출 확인
- [ ] 전체 테스트 그린 (`npm test`)
- [ ] CHANGELOG.md v0.2.0 항목 반영, package.json version 0.2.0

### 4.2 Quality Criteria

- [ ] 신규/변경 테스트 케이스 포함 전체 테스트 통과
- [ ] Zero lint errors (`npm run lint`)
- [ ] Build 성공 (`npm run build`)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 기존에 `baseUrl`을 어디에도 설정 안 해둔 사용자(형 본인의 다른 스크립트/CI 포함)가 있다면 다음 실행부터 즉시 에러로 깨짐 | Medium | Low | 릴리즈 전 형의 실제 사용 환경(`.env.local`, `.pdcarc.json`)에 이미 값이 있는지 확인. 에러 메시지를 명확히 해 즉시 복구 가능하게 함 |
| README를 "경고 문구만 추가"하는 식으로 수정하면서 기존 "optional, defaults to prod" 문구를 놓치면 서로 모순되는 두 문장이 공존하게 됨 | Medium | Medium | Do 단계에서 README 전체를 grep해 `PDCAW_BASE_URL` 언급 지점 전부(표, 예시 JSON, 본문 서술) 확인 후 일괄 수정 |
| semver: RULE.md 기준으로는 breaking change=major bump가 원칙이나, 형이 0.x 단계 관례에 따라 v0.2.0으로 정함 — 외부 사용자가 있다면 SemVer 엄격 해석과 어긋날 수 있음 | Low | Low | 사이클 종료 절차(RULE.md)에서 최신 태그 확인 후 형에게 버전 재확인 — 이번 Plan에서는 v0.2.0으로 잠정 확정, 최종 결정은 사이클 종료 시점 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `src/lib/config.ts` | Config 모듈 | `DEFAULT_BASE_URL` 상수 제거, `mergeConfig`/`resolveConfig`의 baseUrl 해석·에러 분기 변경 |
| `PAT_GUIDE` / `NO_CONFIG_GUIDE` 문자열 | 에러 메시지 | baseUrl 필수 안내 추가/수정 |
| `src/lib/config.test.ts` | 단위 테스트 | c4 케이스(기본값 prod) → 에러 케이스로 교체 |
| `README.md` | 문서 | `PDCAW_BASE_URL` 관련 표·본문 수정, self-hosted 경고 추가 |
| `.pdcarc.example.json` | 예시 설정 파일 | `baseUrl` 값을 플레이스홀더로 교체 |
| `.env.local.example` | 예시 환경변수 파일 | `PDCAW_BASE_URL` 주석·예시값 수정 |
| `CHANGELOG.md` | 문서 | v0.2.0 항목 추가 |
| `package.json` | 패키지 메타 | `version: 0.1.0 → 0.2.0` |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `resolveConfig` | CALL | `src/commands/upload.ts:150` (유일한 호출부) | Breaking — baseUrl 미설정 시 기존엔 조용히 prod로 갔지만 이제 즉시 에러 |
| `mergeConfig` | CALL | `src/lib/config.ts` 내부(`resolveConfig`), `src/lib/config.test.ts` (단위 테스트 4건 c1~c4) | c4 테스트만 기대값 변경 필요, c1~c3(명시적 설정 있는 케이스)는 영향 없음 |
| `DEFAULT_BASE_URL` | REFERENCE | `src/lib/config.ts` 내부에서만 참조 | 제거 후 참조 없음 확인 필요 |

### 6.3 Verification

- [ ] `resolveConfig`의 유일한 호출부(`upload.ts`)가 새 에러 케이스를 별도 처리 없이 기존 `try/catch`(있다면)로 그대로 받아내는지 확인
- [ ] `config.test.ts` c1~c3(명시적 설정 케이스)가 변경 없이 통과하는지 확인
- [ ] `DEFAULT_BASE_URL` 삭제 후 다른 파일에서 참조하는 곳이 없는지 grep 재확인

---

## 7. Architecture Considerations

> 본 항목은 웹앱 아키텍처(Starter/Dynamic/Enterprise) 선택을 전제로 한 템플릿 섹션이나, `pdcaw`는 단일 목적 Node CLI 패키지이므로 해당 없음(N/A). 기존 구조(`src/lib/*`, `src/commands/*`) 그대로 유지하며 `config.ts` 내부 로직만 변경한다.

### 7.1 Project Level Selection

N/A — 웹앱이 아닌 CLI 패키지

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| baseUrl 누락 처리 | 조용히 fallback 유지 / undefined로 두고 fetch 실패에 위임 / PAT와 동일하게 명시적 ConfigError | PAT와 동일하게 명시적 ConfigError | 형 확인 — 에러 메시지 일관성, 사용자가 fetch 스택트레이스가 아니라 설정 가이드를 즉시 받음 |
| README 개정 범위 | 전체 재작성 / 기존 구조 유지 + 경고 추가 | 기존 구조 유지 + 경고 추가 | 형 확인 — 기존 Usage/Setup 표의 실용 정보는 살리고, 모순되는 기본값 서술만 정정 |

### 7.3 Clean Architecture Approach

변경 없음 — 기존 `src/lib/config.ts`, `src/commands/upload.ts` 구조 그대로.

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `docs/RULE.md`에 PDCA 문서 규칙 존재 (경로: `docs/PDCA/YYYY-MM/{feature}/`)
- [x] TypeScript 설정(`tsconfig.json`) 존재
- [x] `oxlint` 설정 존재
- [x] `vitest.config.ts` 존재

### 8.2 Conventions to Define/Verify

해당 없음 — 본 사이클은 기존 컨벤션(Design Ref 주석, 에러 클래스 패턴) 안에서만 작업하며 신규 컨벤션을 도입하지 않는다.

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `PDCAW_BASE_URL` | 대상 서버 주소 (기존 변수, 기본값만 제거) | CLI 실행 환경 | ☐ (이미 존재, 필수화만 진행) |

### 8.4 Pipeline Integration

해당 없음 — 9-phase Development Pipeline 대상 프로젝트 아님(RULE.md 기준 별도 PDCA 문서 규칙 적용).

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`harden-cli-contract.design.md`) — `mergeConfig`/`resolveConfig` 에러 분기 상세, 에러 메시지 문구 확정, README 수정 diff 설계
2. [ ] 형 리뷰 및 승인
3. [ ] 구현 착수 (Do 단계)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 | 형 |
