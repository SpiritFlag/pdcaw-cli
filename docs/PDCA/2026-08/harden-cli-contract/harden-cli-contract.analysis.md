---
template: analysis
version: 1.3
---

# harden-cli-contract 분석 보고서

> **분석 유형**: Gap Analysis (Design vs Implementation)
>
> **프로젝트**: pdcaw
> **버전**: 0.2.0
> **분석자**: Claude
> **분석일**: 2026-08-09
> **Design 문서**: [harden-cli-contract.design.md](./harden-cli-contract.design.md)

---

## Context Anchor

> Design에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | npm 배포로 배포 범위가 "형만 씀"에서 "누구나 설치 가능"으로 바뀌었는데, 프로덕션 기본값이 그 변화를 반영 못 하고 있다 |
| **WHO** | `pdcaw`를 설치하는 제3자 사용자(및 미래의 형) |
| **RISK** | README만 고치고 코드 기본값을 남겨두면 문서와 동작이 다시 어긋난다 |
| **SUCCESS** | `baseUrl` 미설정 시 100% 에러로 막힘, README에 모순되는 기본값 서술 없음 |
| **SCOPE** | config.ts 기본값 제거 + 에러 메시지, README 경고 반영, 예시 파일 정리, v0.2.0 릴리즈 |

---

## Strategic Alignment Check

> PRD 없음(본 사이클은 `/pdca pm` 생략, Plan부터 착수) — PRD Alignment 섹션은 N/A.

### Success Criteria Status (Plan §4.1 Definition of Done)

| # | Criteria (from Plan) | Status | Evidence |
|---|---------------------|:------:|----------|
| SC-1 | `baseUrl` 미설정 시 `ConfigError` 발생 확인 | ✅ | `config.test.ts` c6·c8, 실제 `npm test` 그린 |
| SC-2 | PAT+baseUrl 조합별 에러 메시지 케이스 확인 | ✅ | m1~m3(순수 함수), c6~c8b(I/O) — Checkpoint 5에서 GAP-1 즉시 해소(§2.2) |
| SC-3 | README "defaults to prod" 문구 제거 확인 | ✅ | `grep -n "defaults to prod" README.md` → 결과 없음 |
| SC-4 | 예시 파일에 실제 프로덕션 URL 미노출 | ✅ | `grep -rn "vercel.app" README.md .pdcarc.example.json .env.local.example` → 결과 없음 |
| SC-5 | 전체 테스트 그린 (`npm test`) | ✅ | 55/55 passed |
| SC-6 | CHANGELOG v0.2.0 + package.json version bump | ✅ | `package.json`(0.2.0), `CHANGELOG.md`(v0.2.0 항목), `package-lock.json` 동기화(§2.3 참조) |

**Success Rate**: 6/6 met (전부 ✅, 갭 없음)

### Decision Record Verification

| Source | Decision | Followed? | Deviation |
|--------|----------|:---------:|-----------|
| [Plan] | `baseUrl` 기본값 제거, PAT와 동일하게 필수 처리 | ✅ | 없음 |
| [Design] | Option B(완전분리) — 누락 필드 배열로 모아 한 번에 안내 | ✅ | 없음 — `buildMissingConfigMessage` 그대로 구현 |
| [Design §2.3] | `mergeConfig` 반환 타입을 `baseUrl: string \| undefined`로 변경 | ✅ | 없음 |

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Plan §3(FR-01~07)·Design §2~11에서 정한 대로 `config.ts`의 기본값 제거·에러 합성 로직·문서 수정이 빠짐없이, 설계와 일치하게 구현됐는지 확인한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/PDCA/2026-08/harden-cli-contract/harden-cli-contract.design.md`
- **Implementation Path**: `src/lib/config.ts`, `src/lib/config.test.ts`, `README.md`, `.pdcarc.example.json`, `.env.local.example`, `CHANGELOG.md`, `package.json`
- **서버/UI 없음** — 본 프로젝트는 CLI 라이브러리이므로 L1(API)/L2(UI)/L3(E2E) 런타임 검증은 해당 없음. **정적 전용 공식** 적용(Design §8.1).
- **Analysis Date**: 2026-08-09

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 함수 시그니처 대조 (Design §2.3 vs 구현)

| Design 시그니처 | 구현 위치 | Status | Notes |
|------------------|-----------|--------|-------|
| `mergeConfig(cli, env, pdcarc): { config: { baseUrl: string \| undefined; projectId?: string }; pat: string \| undefined }` | `src/lib/config.ts:39-49` | ✅ Match | |
| `FIELD_GUIDE: Record<'pat'\|'baseUrl', string>` | `src/lib/config.ts:54-66` | ✅ Match | |
| `buildMissingConfigMessage(missing, hasAnyConfig): string` | `src/lib/config.ts:72-77` | ✅ Match | pat→baseUrl 고정 순서까지 설계대로 |
| `resolveConfig(repoRoot, cli): ResolvedConfig` | `src/lib/config.ts:81-97` | ✅ Match | missing 배열 계산 → 합성 메시지 → throw, 설계 흐름과 동일 |

### 2.2 단위 테스트 시나리오 대조 (Design §8.2, 8개 항목)

| # | Design 시나리오 | 구현된 테스트 | Status |
|---|-----------------|----------------|--------|
| 1 | `mergeConfig` 전부 없음 → `baseUrl: undefined` | c4 | ✅ |
| 2 | `mergeConfig` c1~c3 기존 케이스 무변경 | c1~c3 | ✅ |
| 3 | `buildMissingConfigMessage(['pat'], true)` | m1 | ✅ |
| 4 | `buildMissingConfigMessage(['baseUrl'], true)` | m2 | ✅ |
| 5 | `buildMissingConfigMessage(['pat','baseUrl'], false)` | m3 | ✅ |
| 6 | `resolveConfig` 둘 다 없음 → 둘 다 안내 | c6 | ✅ |
| 7 | `resolveConfig` baseUrl만 설정, PAT 없음 → pat 가이드만 | c8b | ✅ |
| 8 | `resolveConfig` 둘 다 있음 → 정상 반환 + trailing slash 제거 | c9 | ✅ |

**GAP-1 — 해소됨**: 최초 분석 시점엔 Design §8.2 항목 7(baseUrl만 설정, PAT 누락)의 정확한 조합이 빠져 있었고 대칭 케이스(c8)만 존재했다. Checkpoint 5에서 형이 "지금 바로 테스트 1개 추가"를 선택해 `c8b`를 추가, 8개 시나리오 전부 1:1로 대응하는 상태로 해소했다(`npm test` 56/56 재확인).

### 2.3 문서·메타 파일 정합성 (Design §6, Plan FR-04~07)

| 항목 | 확인 방법 | 결과 | Status |
|------|-----------|------|--------|
| README "defaults to prod" 제거 | `grep -n "defaults to prod" README.md` | 결과 없음 | ✅ |
| README self-hosted 경고 추가 | README.md:8-11 blockquote 확인 | 존재, PDCA-workspace 레포 링크 포함(형 요청으로 후속 추가) | ✅ |
| `.pdcarc.example.json`/`.env.local.example` 프로덕션 URL 제거 | `grep -rn "vercel.app"` | 결과 없음 | ✅ |
| CHANGELOG v0.2.0 항목 | `CHANGELOG.md` 확인 | Breaking 표기 포함하여 존재 | ✅ |
| package.json version | `0.2.0` | 확인 | ✅ |
| package-lock.json version 동기화 | Check 단계에서 발견 — lockfile이 `0.1.0`으로 미동기화 상태였음 | `npm install --package-lock-only`로 즉시 수정, `0.2.0`으로 동기화 완료 | ✅ (Check 중 수정) |

**갭 상세 (GAP-2, Minor, 즉시 수정 완료)**: Do 단계에서 `package.json`만 수동으로 `0.2.0`으로 바꾸고 `package-lock.json`을 재생성하지 않아 두 파일의 버전 필드가 불일치했다. Check 단계에서 발견해 `npm install --package-lock-only`로 바로 동기화했다 — 재작업 불필요, 별도 커밋 없이 이번 사이클 커밋에 포함.

### 2.4 Functional Depth Analysis

| File | Depth Score | Placeholder Indicators | Missing Design Elements |
|------|:----------:|----------------------|------------------------|
| `src/lib/config.ts` | 100 | 없음 | 없음 — Design §2.3 시그니처·§6 에러 케이스 전부 구현 |
| `src/lib/config.test.ts` | 100 | 없음 | 없음 (GAP-1 해소, c8b 추가) |
| `README.md` | 100 | 없음 | 없음 |
| `.pdcarc.example.json` / `.env.local.example` | 100 | 없음 | 없음 |
| `CHANGELOG.md` / `package.json` | 100 (Check 중 lockfile 갭 수정 완료) | 없음 | 없음 |

**Shallow File Count**: 0 / 8 files (0%) — Depth 60 미만 파일 없음

### 2.5 Contract Verification (Design §6 에러 케이스 ↔ upload.ts 호출부)

CLI 도구라 HTTP API 계약은 없다. 대신 `resolveConfig`의 유일한 호출부(`src/commands/upload.ts:150-154`)가 `ConfigError`를 그대로 잡아 `fail(err.message)`로 출력하는 기존 패턴을 재확인했다.

| # | 케이스 | resolveConfig (Design) | upload.ts (호출부) | Contract |
|---|--------|:------:|:------:|:--------:|
| 1 | 둘 다 없음 | ConfigError, 합성 메시지 | `catch → fail(message)` 그대로 전파 | PASS |
| 2 | baseUrl만 없음 | ConfigError, baseUrl 가이드 | 동일 | PASS |
| 3 | 둘 다 있음 | 정상 반환 | `config.baseUrl`/`config.pat`를 `Api`에 그대로 사용 | PASS |

**Contract Match Rate**: 3/3 = 100%

### 2.6 Match Rate Summary (정적 전용 — 서버/UI 없음)

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:   100%               │
│  Functional Match Rate:   100%  (GAP-1 해소) │
│  Contract Match Rate:     100%               │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:      100%               │
│  = (Structural × 0.2) + (Functional × 0.4)  │
│    + (Contract × 0.4)   [정적 전용 공식]     │
├─────────────────────────────────────────────┤
│  ✅ Match:           8 items (100%)          │
│  ⚠️ Shallow:         0 items (0%)            │
│  ❌ Not implemented: 0 items (0%)            │
└─────────────────────────────────────────────┘
```

---

## 3. Code Quality Analysis

### 3.1 Complexity

`resolveConfig`/`mergeConfig`/`buildMissingConfigMessage` 모두 분기 2~3개 이내의 단순 함수. 복잡도 이슈 없음.

### 3.2 Code Smells

없음 — 신규 로직은 기존 `PAT_GUIDE` 패턴을 그대로 따르는 상수+합성 함수 구조로, 중복이나 매직 넘버 없음.

### 3.3 Security Issues

| Severity | File | Location | Issue | Recommendation |
|----------|------|----------|-------|-----------------|
| 🟢 Info | `src/lib/config.ts` | `readPdcarc` | `SECRET_KEYS` 필터링 로직 변경 없음, 값 미노출 유지 확인 | - |
| 🟢 Info | `src/lib/config.ts` | `buildMissingConfigMessage` | 사용자가 입력한 값을 echo하지 않음(Design §7 요구사항) — 실제로 필드명만 안내, 값 미포함 확인 | - |

---

## 4. Performance Analysis

N/A — 순수 설정 해석 로직, 성능 이슈 대상 아님.

---

## 5. Test Coverage

### 5.1 Coverage Status

| Area | 비고 |
|------|------|
| `config.ts` 신규/변경 로직 | `mergeConfig`(c1~c5b), `buildMissingConfigMessage`(m1~m3), `resolveConfig`(c6~c9) 전부 단위 테스트 존재 |
| 전체 테스트 | 56/56 passed (기존 50 + 신규 6, Checkpoint 5에서 c8b 추가) |

퍼센트 커버리지 도구(istanbul 등) 미설정 프로젝트라 정량 수치는 없음 — Plan §4.2 "Test coverage above 80%" 기준은 이번 사이클 신규 로직 100% 단위 테스트 존재로 충족한다고 판단(정성 평가).

### 5.2 Uncovered Areas

없음.

---

## 6. Clean Architecture Compliance

### 6.1 Layer Dependency Verification

| Layer | Design 기대 | 실제 | Status |
|-------|------------|------|--------|
| Lib (순수) | `mergeConfig`, `buildMissingConfigMessage`가 I/O 없이 값만 반환 | 확인됨 — 둘 다 fs/env 직접 접근 없음(env는 인자로 주입받음) | ✅ |
| Lib (I/O) | `resolveConfig`만 `readPdcarc`/`process.env` 접근 | 확인됨 | ✅ |
| Commands | `upload.ts`는 `resolveConfig` 호출·에러 캐치만, 내부 로직 모름 | 변경 없음, 확인됨 | ✅ |

### 6.2 Dependency Violations

없음.

### 6.3 Architecture Score

```
┌─────────────────────────────────────────────┐
│  Architecture Compliance: 100%               │
├─────────────────────────────────────────────┤
│  ✅ 순수/IO 경계 유지, 레이어 위반 0건        │
└─────────────────────────────────────────────┘
```

---

## 7. Convention Compliance

| 항목 | 컨벤션 | 확인 |
|------|--------|------|
| 함수명 | camelCase, 동사+명사 | `buildMissingConfigMessage` ✅ |
| 에러 메시지 톤 | 기존 `PAT_GUIDE` 스타일(원인+번호 매긴 해결 단계) | `FIELD_GUIDE.baseUrl`도 동일 톤 ✅ |
| Design Ref 주석 | 파일 상단에 관련 Design 절 번호 명시 | `config.ts:1-3`, `config.test.ts:1` 갱신됨 ✅ |
| 파일 위치 | 신규 파일 생성 없이 기존 `config.ts` 내부 확장 | 확인됨 ✅ |

**Convention Score**: 100%

---

## 8. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 100%                    │
├─────────────────────────────────────────────┤
│  Design Match(정적):    100점                │
│  Code Quality:          100점                │
│  Security:               양호 (Info 2건)      │
│  Testing:                정성 충족             │
│  Architecture:           100점                │
│  Convention:             100점                │
└─────────────────────────────────────────────┘
```

---

## 9. Recommended Actions

### 9.1 즉시 처리 완료 (Check 단계 중 수정)

| Priority | Item | File | 상태 |
|----------|------|------|------|
| 🟡 GAP-2 | package-lock.json 버전 불일치 | package-lock.json | ✅ 수정 완료(`npm install --package-lock-only`) |
| 🟢 GAP-1 | Design §8.2 항목 7 정확한 조합의 `resolveConfig` 레벨 테스트 누락 | `config.test.ts` | ✅ 수정 완료(Checkpoint 5, `c8b` 추가) |

### 9.2 Backlog

없음.

---

## 10. Design Document Updates Needed

없음 — 구현이 Design과 일치한다.

---

## 11. Next Steps

- [x] Critical/Important 이슈 없음 — Act(iterate) 불필요
- [ ] `/pdca report harden-cli-contract`로 완료 보고서 작성

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 분석 (Overall 98%) | Claude |
| 0.2 | 2026-08-09 | Checkpoint 5에서 GAP-1 즉시 수정(c8b 테스트 추가) 반영, Overall 100%로 갱신 | Claude |
