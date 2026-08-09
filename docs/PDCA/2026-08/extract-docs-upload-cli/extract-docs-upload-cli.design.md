---
template: design
version: 1.3
---

# extract-docs-upload-cli 설계 문서

> **한 줄 요약**: 원본 4파일의 순수 함수는 그대로 복사하고, 오케스트레이션과 신규 로직
> (설정·루트 판정·대상 선정·분류)을 **관심사별 모듈로 완전 분리**한다(Option B — 형 선택).
> 무회귀의 증거는 구조 대조가 아니라 **이식 테스트 19케이스 + C3 종단 행위 동일성**이다.
>
> **프로젝트**: pdcaw-cli
> **작성자**: Claude
> **작성일**: 2026-08-09
> **상태**: **구현+종단 검증 완료** (v0.2 — M1~M8 구현 및 E1~E10 종단 검증 반영. §8.3 참조)
> **Plan 문서**: [extract-docs-upload-cli.plan.md](./extract-docs-upload-cli.plan.md) (v0.3 Approved)

---

## Context Anchor

> Plan v0.3에서 복사. Design→Do 인계 시 전략 컨텍스트 유지용.

| Key | Value |
|-----|-------|
| **WHY** | ①검증 끝난 도구가 한 레포에 묶여 재사용 불가 ②`docs/PDCA` 밖 문서가 서버에 반영된 적 없음(실측 3건) ③호출자가 이미 아는 변경 목록을 CLI가 중복 계산. ②·③은 형이 착수 중 직접 지목 — 지시서의 "이동+패키징" 전제가 부분 폐기됨(Plan §1.4) |
| **WHO** | **클로드(Claude Code CLI) — 유일한 상시 호출자.** `--path`는 "클로드가 `git diff` 결과를 그대로 넘긴다"는 사용을 전제로 만들어진다 / **형** — 승인자, PAT 발급 주체, npm 배포 주체 |
| **RISK** | `docs/` 전면 확대의 의도치 않은 업로드(RK-1) / 무회귀 판정 기준 소실(RK-3) / 레포 루트 판정 흔들림(RK-4) / 두 벌 공존 혼동(RK-6) / 빌드 산출물 누락(RK-5) |
| **SUCCESS** | C1~C10 — 이식 무회귀(C1·C3)와 확장 실증(C4·C5)을 **분리 판정** |
| **SCOPE** | 7건(S1 골격 / S2 이식 / S3 config / S4 `docs/` 전체 / S5 `--path` / S6 테스트 / S7 문서). 파서 통합·원본 제거·`docsDir`·삭제 반영 등은 이월 |

---

## 1. Overview

### 1.1 설계 목표

1. **무회귀가 증명 가능할 것** — 원본의 순수 함수(파싱·해석)는 바이트 수준으로 보존하고,
   행위 차이는 전부 "의도된 확장 목록"(§2.4)에 등재한다. 목록에 없는 차이 = 회귀.
2. **신규 로직은 전부 단위 테스트 가능할 것** — Option B의 선택 이유. 설정 우선순위, 분류,
   대상 해석이 각각 순수 함수로 존재해 CLI 실행 없이 검증된다.
3. **런타임 의존성 0을 구조가 보장할 것** — `dependencies`가 비어 있고, 모든 외부 상호작용은
   Node 내장(fs, child_process, fetch, `process.loadEnvFile`)뿐이다.

### 1.2 설계 원칙

- **I/O와 순수 로직의 분리** — 원본 D-65의 계승. 순수 함수만 단위 테스트하고, I/O는 종단
  검증(C3~C7)이 커버한다. 모듈 경계가 이 분리를 따라간다.
- **원본 참조 주석 보존** — 이식 파일의 `Design Ref:`/`Plan SC:`/`FR-`/`D-` 주석은 그대로
  두고, 파일 헤더에 "참조 번호는 PDCA-workspace 7차 문서 기준"을 명시한다(Plan §8.2).
- **에러는 원인 지목형** — 원본의 401·PAT·태그 부재 메시지 스타일을 신규 에러(설정 부재,
  경로 없음, 옵션 충돌)에도 적용한다.

---

## 2. Architecture

### 2.0 설계안 비교 (Checkpoint 3 — 결정 완료)

| 기준 | A: 최소 변경 | **B: 완전 분리 (선택)** | C: 실용 절충 |
|------|:--:|:--:|:--:|
| 접근 | 신규 로직을 `upload.ts`에 인라인 | 신규 관심사마다 모듈 분리 | 신규 모듈 2개(config·classify)만 |
| src 파일 수 | 5 | **9** | 7 |
| 원본 대비 diff | upload.ts ~180줄 증가 | **오케스트레이션 재작성** | upload.ts 원형 유지 |
| 신규 로직 테스트 | CLI 통째 실행만 | **전 모듈 단위 테스트** | config·classify만 |
| 무회귀 증거 | 구조 대조 | **행위 대조(19케이스+C3)** | 구조+행위 |

**선택: B** — **근거**(형 결정, 2026-08-09): 신규 로직 전수가 단위 테스트되는 구조를 우선.
클로드는 C를 권고했으나(diff 최소화 = 무회귀 대조 용이), B에서도 순수 함수 복사본은
무수정이므로 **무회귀 증거를 구조 대조가 아닌 행위 대조로 옮기면 성립**한다:

- 이식 19케이스가 원본과 같은 ID·같은 입력·같은 기대값으로 green (C1)
- C3 종단에서 원본 실행과 서버 상태·출력 로그가 PDCA 경로 문서에 한해 동일
- §2.4의 "의도된 행위 차이" 목록 밖의 차이가 관찰되면 그것이 회귀다

### 2.1 모듈 구성도

```
src/
├── cli.ts                  # bin 엔트리(#!/usr/bin/env node) — 서브커맨드 라우팅만
│                           #   upload → commands/upload.ts / 그 외 → usage, exit 1
├── commands/
│   └── upload.ts           # 오케스트레이션 — 아래 lib을 순서대로 호출. 자체 로직 없음
└── lib/
    ├── cycle-path.ts       # [복사본·무수정] 파서·역파서 (원본 cyclePath.ts, D-3)
    ├── git-changes.ts      # [복사본] diff/status 해석 순수 함수 무수정.
    │                       #   pathspec 'docs/PDCA' → 'docs' 2곳만 변경 (§2.4 ①)
    ├── workspace-api.ts    # [복사본·무수정] MCP·REST 클라이언트 + 봉투 해석
    ├── root.ts             # [신규] 레포 루트 판정(D-11) + .env.local 로딩(D-8)
    ├── config.ts           # [신규] 설정 해석 — 우선순위(FR-3)·.pdcarc·PAT 가드
    ├── targets.ts          # [신규] 대상 선정 3모드 — git/all/path (D-12)
    └── classify.ts         # [신규] kind 분기 + title 추출 (D-5·D-13, 순수)
```

의존 방향(§9에서 상세): `cli → commands → lib`, lib 상호간은
`targets → git-changes`·`classify → cycle-path` 두 개만. `config`·`root`는 잎(leaf).

### 2.2 실행 흐름

```
npx pdcaw upload [옵션]
  │
  ├─ cli.ts        서브커맨드 판별 → upload로
  │
  ├─ upload.ts     parseArgs (원본 + --path 반복 허용, 배타 검증 D-12)
  │
  ├─ root.ts       ① 루트 판정: cwd에서 .pdcarc.json 상향 탐색
  │                   → 없으면 git rev-parse --show-toplevel
  │                   → 없으면 cwd + 경고                            (D-11)
  │                ② root/.env.local 있으면 process.loadEnvFile     (D-8)
  │                ③ 판정된 루트·로딩한 env 파일 경로 출력            (RK-4·RK-8)
  │
  ├─ config.ts     CLI 인자 > PDCAW_* > .pdcarc.json > 에러/기본값    (FR-3)
  │                .pdcarc의 pat/token 류 키 → 경고 후 무시           (FR-5)
  │                PAT 없으면 3줄 안내 에러                           (FR-7)
  │
  ├─ targets.ts    --path → 지정 경로만 (git 우회, 존재 검증)         (D-4·D-18)
  │                --all  → root/docs 전체 스캔
  │                기본   → 최신 태그 이후 docs/ 변경분 ∪ 작업트리     (FR-10)
  │                공통: .md만(FR-13) / 삭제·rename 경고만(FR-15)
  │
  ├─ classify.ts   parseCycleStagePath 매칭 → pdca (stage, title=사이클명)
  │                          비매칭 → general (title=첫 헤딩→파일명)   (D-5·D-13)
  │
  ├─ upload.ts     대상 목록 출력(경로·kind·stage, FR-17)
  │                --version 있으면 사이클 생성 먼저 (FR-22)
  │                파일별 document_write 루프 — 실패 격리 (FR-21)
  │                집계 출력 → exit 코드
  │
  └─ workspace-api.ts  HTTP 전송 (PAT는 헤더에만, FR-24)
```

### 2.3 의존성

| 구분 | 항목 | 근거 |
|------|------|------|
| dependencies | **(없음)** | NFR-1. F1 실측 — Node 내장만 사용 |
| devDependencies | `typescript` `@types/node` `vitest` `oxlint` | 빌드·테스트·린트. V4에서 `@types/node` 필요 실증 |
| engines | `node >= 20.12` | `process.loadEnvFile` 하한 (NFR-2) |

### 2.4 원본 대비 의도된 행위 차이 (전수 — 이 목록 밖의 차이는 회귀다)

| # | 차이 | 근거 |
|---|------|------|
| ① | git pathspec·스캔 뿌리 `docs/PDCA` → `docs` | FR-10·FR-11, 형 지적 ① |
| ② | 파서 비매칭 경로를 skip하지 않고 `kind='general'`로 업로드. title은 첫 헤딩→파일명 | FR-18·FR-19 |
| ③ | `--path` 모드 신설 (git 우회·무조건·배타) | FR-12, 형 지적 ② |
| ④ | 레포 루트를 스크립트 위치가 아니라 실행 컨텍스트에서 판정 + 판정 결과 출력 | D-1·D-11, F3 |
| ⑤ | `.env.local`을 CLI가 직접 로딩 + 로딩 경로 출력 | D-8, F8 |
| ⑥ | `.pdcarc.json` 설정원 추가 (우선순위 최하위) + pat 키 경고 | FR-3~FR-5 |
| ⑦ | usage 문자열 `npm run docs:upload --` → `npx pdcaw upload` | F4(B-4) |
| ⑧ | git 태그 부재 에러 안내에 `--path` 대안 추가 (원본은 `--all`만 안내) | FR-12 파생 |
| ⑨ | 대상 목록 출력에 kind 컬럼 추가 | FR-17 |

**변하지 않는 것**: 파서 정규식·왕복 규칙(D-3), diff/status 해석, JSON-RPC 봉투 해석,
401·409 처리, 멱등 재실행 의미, `--cycle`/`--version` 결합 규칙(F12), 삭제·rename 경고,
빈 파일 skip, 실패 격리와 exit 규칙, PAT 비로깅.

---

## 3. 데이터 모델

DB 없음 — CLI 내부 타입이 전부다. 이식 타입은 원본 그대로, 신규 타입은 아래 3개.

```typescript
// lib/root.ts
export type RepoRoot = {
  root: string               // 절대경로
  source: 'pdcarc' | 'git' | 'cwd'   // 판정 근거 — 출력에 포함 (RK-4)
  envFile?: string           // 로딩한 .env.local 절대경로 (없으면 undefined)
}

// lib/config.ts
export type ResolvedConfig = {
  baseUrl: string            // 인자 > env > .pdcarc > 기본값(prod)
  pat: string                // env 전용 (D-9)
  projectId?: string         // 인자 > env > .pdcarc > undefined(→ project_list 해석)
}

// lib/classify.ts — 업로드 페이로드의 결정 인자
export type Classified =
  | { kind: 'pdca'; stage: PdcaStage; title: string }   // title = 사이클명 (D-59 계승)
  | { kind: 'general'; title: string }                   // title = 첫 헤딩 → 파일명 (D-13)
```

이식 타입(무수정): `ChangedPath`·`ChangeKind`(git-changes), `Api`·`ToolResult`(workspace-api),
`ParsedCyclePath`·`PdcaStage`(cycle-path).

---

## 4. 소비 API 사양

이 CLI는 서버를 만들지 않는다 — 워크스페이스 서버의 기존 API 3개를 소비한다(전부 원본과
동일, 무변경).

| # | 호출 | 형태 | 용도 |
|---|------|------|------|
| 1 | `POST {base}/api/mcp` — `tools/call` `document_write` | JSON-RPC, `Authorization: Bearer <PAT>` | 문서 upsert. `kind='general'`이면 `pdcaStage` 필드 **미포함**(서버 refine 규칙, F5) |
| 2 | `POST {base}/api/projects/{id}/cycles` | REST | `--version` 시 사이클 생성. 409 target=version → 성공 취급 |
| 3 | `tools/call` `project_list` | JSON-RPC | projectId 미지정 시 자동 해석 |

`document_write` 전송 페이로드(경로별):

```
{ projectId, path: <루트 상대 경로>, title: <Classified.title>,
  kind: <Classified.kind>, pdcaStage?: <pdca일 때만>, content: <파일 원문> }
```

---

## 5. CLI 인터페이스 사양 (UI 대체)

### 5.1 명령·옵션

```
pdcaw upload [--cycle <이름>] [--version vX.Y.Z] [--all]
             [--path <파일|폴더>]... [--project <uuid>] [--base-url <url>]
```

| 옵션 | 의미 | 제약 |
|------|------|------|
| `--cycle` | 부분 동기화 필터(단독) / 릴리즈 연결 열쇠(`--version`과) | `--path`와 배타 |
| `--version` | 사이클 생성 + 전체 동기화 | `--cycle` 필수(원본 D-64), `--path`와 배타 |
| `--all` | git 없이 `docs/` 전체 스캔 | `--path`와 배타 |
| `--path` | 핀포인트 — 지정한 것만, git 우회, 무조건 | **반복 가능(합집합)**. 다른 모드 옵션과 배타(D-12) |
| `--project` / `--base-url` | 설정 최우선 순위 | — |

**D-12 (V3 결정 — 완전 배타)**: `--path`는 `--all`·`--cycle`·`--version` 어느 것과도 동시
지정 불가 — usage 에러. 순수 핀포인트 전용으로 시작하고, 조합이 필요해지면 나중에 허용으로
푼다(역방향은 호환 파괴).

**D-17 (--path 해석)**: 값은 **cwd 기준 상대**(절대경로 허용)로 해석한 뒤 루트 상대로
정규화한다 — 서버 `path` 필드가 루트 상대이기 때문. 루트 밖으로 나가면 에러.

**D-18 (--path 존재 검증)**: 대상 확정 단계에서 전 경로의 존재를 검증하고, 하나라도 없으면
**서버 요청 전에** UsageError로 전체 중단한다. 콕 찍었는데 없다 = 오타 확률이 높고, 이
시점은 아직 아무것도 전송하지 않아 중단이 안전하다. 폴더면 하위 `.md` 재귀 수집, 파일인데
`.md`가 아니면 사유와 함께 건너뛴다(FR-13·Q3).

### 5.2 출력 사양

원본 출력 형식을 유지하고(무회귀 — C3에서 로그 대조), 신규 3줄만 추가한다:

```
루트: /path/to/repo (.pdcarc)          ← 신규 — 판정 근거 포함 (RK-4)
env:  /path/to/repo/.env.local          ← 신규 — 로딩했을 때만 (RK-8)
→ http://localhost:3001
기준: v0.1.6 이후 + 작업트리            ← --path 모드에선 "기준: --path 지정 N건"
대상 3건:
  refine-cycle-closing  plan     (docs/PDCA/2026-08/refine-cycle-closing/….plan.md)
  general               -        (docs/RULE.md)                    ← kind 컬럼 신규
project=xxxx
  ok    docs/… 덮어씀 (이전 1234자)
  warn  docs/….tmp — .md 아님, 건너뜀
문서: 신규 1 / 덮어씀 2 / 실패 0
```

### 5.3 종료 코드

| 코드 | 조건 |
|------|------|
| 0 | 전건 성공, 또는 대상 0건(FR-16), 또는 빈 파일 skip만 발생 |
| 1 | UsageError(인자·설정·경로 오류) / 업로드 실패 ≥ 1건 / 사이클 생성 실패(409 name) |

---

## 6. 에러 처리

| 상황 | 메시지 방침 | FR |
|------|-------------|-----|
| PAT 미설정 | 원본 3줄 안내 유지(발급 위치 → 저장 위치 → 브랜치 주의) | FR-7 |
| `.pdcarc`에 pat 류 키 | `warn: .pdcarc.json의 'pat' 키는 무시됩니다 — PAT는 PDCAW_PAT 환경변수로만` (값 비출력) | FR-5 |
| 설정 전무 | 무엇을 어디에(.pdcarc 스키마 예시 + env 변수명) 넣는지 안내 | C6 |
| git 태그 없음(기본 모드) | 원본 메시지 + **`--all` 또는 `--path`로 대상을 지정하라** 안내 | §2.4 ⑧ |
| `--path` 경로 없음 | 없는 경로 전부 나열 후 중단 (서버 요청 전) | D-18 |
| 옵션 충돌 | `--path는 --all/--cycle/--version과 함께 쓸 수 없습니다` + usage | D-12 |
| HTTP 401 | 원본 유지 — PAT·서버 브랜치 짝 지목 | FR-23 |
| 개별 파일 실패 | 원본 유지 — 축적 후 계속, 말미 집계, exit 1 | FR-21 |

**UsageError 계층**(원본 계승): 사용자 안내는 스택 없이 메시지만, 그 외 예외는 원인 추적을
위해 그대로 노출. 어느 경로에도 PAT 미등장(FR-24).

---

## 7. 보안 고려사항

- [x] **PAT 유일 경로 = 환경변수** — `.pdcarc`의 pat 류 키는 경고 후 무시(D-9), 값 비출력
- [x] **PAT 비로깅** — `workspace-api.ts`가 헤더에만 사용(원본 구조 보존). C8이 `grep pdcaw_`로 실증
- [x] **`.gitignore`가 `.env*` 차단** — 레포에 이미 반영(2026-08-09), `.env.local.example`만 허용
- [x] **HTTPS** — 기본 base-url이 https(prod). localhost는 개발 검증 전용
- [ ] 입력 검증 — 서버 측 zod가 담당(경로·버전 형식은 CLI가 1차 검증: `/^v\d+\.\d+\.\d+$/` 유지)

---

## 8. 테스트 계획

> 테스트 코드는 Do 단계에서 구현과 한 세트로 작성한다. Check 단계는 실행만 한다.

### 8.1 범위

| 층 | 대상 | 도구 | 케이스 |
|----|------|------|--------|
| 단위(이식) | git-changes·workspace-api·cycle-path 순수 함수 | vitest | **19케이스 원본 ID 그대로** (C1) |
| 단위(신규) | config·classify·targets 순수 부분 | vitest | 아래 8.2 |
| 종단 | 실제 dev 서버 대상 실행 | 수동 + 로그 | 8.3 (C3~C10) |

### 8.2 신규 단위 테스트

| ID | 모듈 | 검증 |
|----|------|------|
| c1~c4 | config | 우선순위 4단(인자>env>.pdcarc>기본값) 각 단 승자 확인 |
| c5 | config | .pdcarc의 `pat`·`token`·`PAT` 키 → 경고 플래그 + 무시 |
| c6 | config | 설정 전무 → 안내 에러 (PAT 없음과 구분) |
| k1~k2 | classify | PDCA 경로 → kind/stage/title(사이클명), 4 stage 전수 |
| k3 | classify | 비매칭 경로 → general + 첫 헤딩 title |
| k4 | classify | **H2로 시작(H1 없음)** → 그 H2가 title (F7 실물 — RULE.md) |
| k5 | classify | 프론트매터 스킵 후 첫 헤딩 (V2 — 실물 28/31) |
| k6 | classify | 코드펜스 안의 `#`은 헤딩 아님 |
| k7 | classify | 헤딩 전무 → 파일명(확장자 제거) |
| k8 | classify | `_INDEX.md` → general (원본 t3의 "null" 기대가 "general"로 승격됨을 명시) |
| p1 | targets | `--path` 파일·폴더 혼합 → 합집합, 중복 제거 |
| p2 | targets | 비`.md` 파일 지정 → 사유와 함께 skip 목록 반환 |
| p3 | targets | 루트 밖 경로 → 에러 |

### 8.3 종단 시나리오 (Success Criteria 대응) — 실행 완료, 결과 기록

| # | 시나리오 | 판정 | 결과 |
|---|----------|------|------|
| E1 | `--path`로 미변경 PDCA 문서(`backlog-with-mcp.plan.md`) 업로드 → 재실행 | **C3(멱등)** | ✅ 1회차 `신규`, 2회차 `덮어씀 (이전 24073자)` |
| E1b | `--all --cycle refine-cycle-closing --version v0.9.9` → 재실행 | **C3(원본 로직 동일 동작)** | ✅ 1회차 사이클 `생성`+문서 31건(신규23/덮어씀8), 2회차 `이미 존재 — 생성 생략`+`덮어씀 31` |
| E2 | `--path`로 general 3건(`docs/RULE.md`·`_INDEX.md`·`deploy/CHECKLIST.md`) 업로드 | **C4** | ✅ `document_read`로 서버 상태 직접 확인 — `kind:"general"`, `pdcaStage:null`, `title:"PDCA 문서"`(RULE.md, H2 첫헤딩 그대로) |
| E3 | 폴더 지정(`docs/PDCA/2026-08/refine-cycle-closing`)으로 4건 일괄 | **C5(폴더 지정)** | ✅ 4건 재귀 수집·업로드 |
| E4 | `config.test.ts` c6 — 빈 디렉터리(설정 전무) | **C6** | ✅ 단위 테스트로 대체 확인(실 fs 사용) — ConfigError + `.pdcarc.json` 안내 문구 |
| E5 | `config.test.ts` c7 — `.pdcarc.json`에 pat 키 | **C7** | ✅ 단위 테스트로 대체 확인 — 경고 후 무시, 값 비유출 |
| E6 | 실 서버 응답이 담긴 stdout/stderr 파일에 `grep -c pdcaw_` | **C8** | ✅ stdout 0건 / stderr 0건 |
| E7 | `npm pack` → 딴 디렉터리에서 `npx file:<tarball> upload --help` | **C10** | ✅ (로컬 `.tgz` 경로는 이 환경의 npx가 shell로 오인해 `file:` 접두 필요 — registry publish 후엔 무관) |

**실행 중 발견한 실측 3건** (Design 작성 시점엔 몰랐던 것):

1. **`PDCAW_BASE_URL` 기본값이 프로덕션이다** — `.env.local`에 dev 주소가 설정돼 있지 않아,
   모든 검증 명령에 `--base-url http://localhost:3001`을 **명시적으로** 붙여야 했다.
   원본 스크립트도 같은 구조라 CLI 고유 결함은 아니지만, 검증 순서에서 실수로 프로덕션을
   건드릴 뻔한 지점이었다 — 매 명령 명시가 유일한 안전장치임을 확인.
2. **dev 서버의 PAT-프로젝트 짝이 PDCA-workspace가 아니었다** — `.env.local`의
   `PDCAW_PROJECT_ID`는 프로덕션 프로젝트 UUID라 dev DB에 없어 `NOT_FOUND`. dev PAT가
   접근 가능한 프로젝트는 별개 프로젝트(카그모/cogmo) 하나뿐이었고, `--project`로 명시
   override해야 했다. 형 승인 후 그 프로젝트에 테스트 문서를 올려 검증을 완주함(dev 전용
   데이터, 실서비스 영향 없음).
3. **`--path`와 `--version`은 완전 배타(D-12)라 E1b는 `--all --cycle --version` 조합으로
   대체 실행** — Design 초안이 `npm link` 기반 `--cycle+--version` 단독 실행을 가정했으나,
   실측하니 최신 태그(v0.1.6)가 이미 실사용에서 반영된 상태라 `docs/PDCA` diff가 0건이었다.
   `--all`로 우회해 사이클 생성·문서 upsert 메커니즘을 동일하게 검증.

전제(V5 실측 갱신): dev 서버(`npm run dev:local`) 기동 확인 완료. `.env.local`에 PDCAW_* 3종
존재하나 **base-url·project-id 둘 다 dev 대상으로는 override가 필요**함을 실증(위 1·2).

### 8.4 시드 데이터

불필요 — E1이 실존 레포(PDCA-workspace)의 실제 문서 31건을 그대로 쓴다. 멱등 재실행으로
확인하므로 `hns-` 격리 픽스처도 불필요(Plan C3).

---

## 9. Clean Architecture

### 9.1 계층 구조

| 계층 | 책임 | 파일 |
|------|------|------|
| Presentation | 인자 파싱·출력·exit 코드 | `cli.ts`, `commands/upload.ts` |
| Application | 대상 선정·분류 오케스트레이션 | `commands/upload.ts` (thin) |
| Domain (순수) | 경로 파싱·봉투 해석·분류·설정 우선순위 | `cycle-path.ts`, `classify.ts`, `config.ts`(해석부), `git-changes.ts`(파싱부), `targets.ts`(해석부) |
| Infrastructure (I/O) | git 실행·fs·HTTP·env 로딩 | `git-changes.ts`(runGit), `workspace-api.ts`(fetch), `root.ts`, `targets.ts`(readdir) |

원본 D-65의 "한 파일 안에서 [순수]/[I/O] 주석으로 분리" 관례를 계승한다 — git-changes·
targets는 파일 분리 대신 함수 수준에서 분리하고, **단위 테스트는 순수 함수만** 문다.

### 9.2 의존 규칙

```
cli.ts → commands/upload.ts → lib/*
lib 내부:  targets → git-changes    (변경 탐지 위임)
           classify → cycle-path    (파서 위임)
           그 외 상호 의존 금지 — config·root·workspace-api는 잎(leaf)
```

`cycle-path.ts`는 아무것도 import하지 않는다(원본과 동일) — 단일 원천 통합(이월) 시 그대로
들어낼 수 있는 조건.

---

## 10. 컨벤션

| 항목 | 규칙 |
|------|------|
| 파일명 | kebab-case (`cycle-path.ts` — 원본 camelCase `cyclePath.ts`에서 변경, 지시서 명시) |
| import | `./x.ts` 확장자 포함(원본 유지) — tsc가 `.js`로 재작성(V4 실증) |
| 주석 | 이식 파일: 원본 주석 보존 + 헤더에 원본 위치 명시. 신규 파일: `Design Ref: §N` 형식으로 이 문서 참조 |
| 커밋 | CLAUDE.md 타입 규칙(제목 한 줄) |
| lint | oxlint (원본과 동일 도구) |

### 10.1 tsconfig 핵심 (V4 실증 기반)

```jsonc
{
  "compilerOptions": {
    "target": "es2023", "lib": ["ES2023"], "types": ["node"],
    "module": "nodenext", "moduleResolution": "nodenext",
    "rewriteRelativeImportExtensions": true,   // .ts import를 .js로 재작성 (V4 ✓)
    "verbatimModuleSyntax": true, "strict": true,
    "outDir": "dist", "rootDir": "src",
    "noUnusedLocals": true, "noUnusedParameters": true, "skipLibCheck": true
  },
  "include": ["src"]
}
```

`package.json` 골격: `"name": "pdcaw"`, `"type": "module"`(V4 — nodenext 필수 조건),
`"bin": { "pdcaw": "dist/cli.js" }`, `"files": ["dist"]`, `"engines": { "node": ">=20.12" }`,
`"scripts"`: `build`(tsc)·`test`(vitest run — **`.test.ts`는 tsconfig include 밖, vitest가 직접
실행**)·`lint`·`prepublishOnly`(build). 테스트 파일이 dist에 새어들지 않게 `include: ["src"]`
+ `"exclude": ["**/*.test.ts"]`.

### 10.2 신규 설계 결정 (Plan D-1~D-10에 이어서)

| ID | 결정 | 근거 |
|----|------|------|
| **D-11** | 루트 판정 3단: `.pdcarc.json` 상향 탐색 → `git rev-parse --show-toplevel` → cwd(경고) | V1 실증. `.pdcarc`가 1순위인 이유: 커밋 대상 파일이라 레포 루트의 결정적 표지이고 **git 없는 환경에서도 성립**(D-4가 요구). 판정 근거를 출력에 포함(RK-4) |
| **D-12** | `--path` 완전 배타 | V3 형 결정. 허용→배타는 호환 파괴지만 배타→허용은 확장이라 안전한 쪽에서 시작 |
| **D-13** | title 추출: 프론트매터 스킵 → 펜스 밖 첫 `#{1,6} ` 헤딩(레벨 무관) → 없으면 파일명 | K4·F7(RULE.md가 H2 시작)·V2(28/31이 프론트매터) |
| **D-14** | 빌드: TS 6 `rewriteRelativeImportExtensions` + nodenext + `"type": "module"` | V4 실증 — 원본 소스의 `.ts` 확장자 import를 **수정 없이** 배포 가능한 유일 조합 |
| **D-15** | `.env.local`은 **기존 환경변수를 덮지 않아야** 한다 — 실 env > .env.local | 우선순위(FR-3)의 일관성. `process.loadEnvFile`의 비덮어쓰기 의미는 **Do에서 확인**하고, 덮는다면 수동 파싱 폴백(구현 확인 항목 ⚠️) |
| **D-16** | 테스트 러너 vitest 유지 | 19케이스를 **문자 그대로** 이식하는 조건 — 러너를 바꾸면 "같은 테스트"라는 주장이 약해진다 |

---

## 11. Implementation Guide

### 11.1 파일 구조 (전체)

```
pdcaw-cli/
├── src/
│   ├── cli.ts
│   ├── commands/upload.ts
│   └── lib/
│       ├── cycle-path.ts        + cycle-path.test.ts   (t1~t7 이식)
│       ├── git-changes.ts       + git-changes.test.ts  (g1~g6 이식)
│       ├── workspace-api.ts     + workspace-api.test.ts(w1~w4 이식)
│       ├── root.ts
│       ├── config.ts            + config.test.ts       (c1~c6 신규)
│       ├── targets.ts           + targets.test.ts      (p1~p3 신규)
│       └── classify.ts          + classify.test.ts     (k1~k8 신규)
├── package.json  tsconfig.json  vitest.config.ts
├── .pdcarc.example.json  .env.local.example
├── README.md  CHANGELOG.md
└── docs/ …
```

### 11.2 구현 순서

Plan §9 마일스톤(M1~M8)과 동일. 각 모듈은 **코드+테스트 한 세트**로 완료 판정.

1. [x] M1 골격 — package.json·tsconfig·`--help`만 뜨는 cli.ts·빌드 확인
2. [x] M2 이식 — lib 3파일 + 테스트 19케이스 green
3. [x] M3 설정 — root.ts·config.ts (+ c1~c7) — **D-15 실측 완료**(process.loadEnvFile은
   기존 셸 환경변수를 덮지 않음 확인, 폴백 불필요)
4. [x] M4 확장 — classify.ts (+ k1~k8)
5. [x] M5 확장 — targets.ts (+ p1~p4) + upload.ts 오케스트레이션 + cli.ts 라우팅
   (구현 중 발견 — `upload --help`가 사각지대였음, main()에서 파싱 전 처리로 수정)
6. [x] M6 테스트 전건(40케이스) + tsc·lint green
7. [x] M7 종단 E1~E7 — §8.3 결과 표 참조, 실측 3건 발견·대응
8. [x] M8 문서 — README·CHANGELOG·example 2종

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 내용 | 예상 규모 |
|--------|-----------|------|:---------:|
| 골격+이식 | `module-1` | M1+M2 — 기계적 복사가 대부분 | ~350줄(이식분 포함) |
| 설정+확장 | `module-2` | M3+M4+M5 — 신규 로직 전부 | ~300줄 |
| 검증+문서 | `module-3` | M6+M7+M8 | 코드 미미 |

#### 권장 세션 분할

| 세션 | 범위 | 비고 |
|------|------|------|
| 1 | `--scope module-1,module-2` | 코드 전체 — 한 세션에 가능한 규모 |
| 2 | `--scope module-3` | 종단 검증은 dev 서버 기동·형 확인이 껴서 분리 권장 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.2 | 2026-08-09 | **구현(module-1,2) + 종단 검증(module-3) 완료.** 신규 파일 17개(lib 8 + test 7 +
골격 3 - root.test 미보유) 작성, `tsc`·`vitest run`(40/40)·`oxlint` 로컬 그린. 구현 중
발견·수정 2건 — ①D-15(process.loadEnvFile 비덮어쓰기) 실측 확인 ②`upload --help` 사각지대
발견 후 main()에서 파싱 전 처리로 수정. 종단 검증 E1~E7을 dev 서버(형이 발급한 세션 한정
PAT, `.env.local`은 무수정) 대상으로 전건 실행 — **Design 초안이 몰랐던 실측 3건**을
§8.3에 기록: ①`PDCAW_BASE_URL` 기본값이 프로덕션이라 전 명령에 `--base-url` 명시 필요
②dev PAT의 프로젝트가 PDCA-workspace가 아니라 별개 프로젝트라 `--project` override
필요(형 승인 후 그 프로젝트에 테스트 업로드로 검증 완주) ③`--path`·`--version` 배타
제약(D-12) 때문에 E1을 `npm link` 단독 대신 `--all --cycle --version` 조합으로 대체 실행.
C4는 `document_read`로 서버 상태를 직접 대조해 `kind`·`pdcaStage`·`title` 필드까지 실증.
C8은 실제 stdout/stderr 캡처 파일에 `grep -c pdcaw_ `로 0건 확인. README·CHANGELOG 작성
완료(영문 — bkit 프로젝트 규칙). **PDCA-workspace 레포는 이번 세션 동안 Read 전용 유지**
(NFR-6, mtime 대조로 재확인). 상태를 "구현+종단 검증 완료"로 갱신 | Claude |
| 0.1 | 2026-08-09 | 최초 작성. V1~V5 실측 완료 — **V1**(루트 판정 3단이 성립: git rev-parse는 하위 디렉터리 OK·비git에서 exit 128 확인) **V2**(실물 31개 중 28개 프론트매터 시작 → D-13이 스킵을 1급 규칙으로) **V4**(TS 6.0.3 `rewriteRelativeImportExtensions` 실증 — 소스 무수정 배포 가능, `"type": "module"`·`@types/node` 필요 발견) **V5**(PDCAW_* 3종 존재 확인, dev 서버는 검증 시점 기동 필요). Checkpoint 3: **형이 Option B(완전 분리) 선택** — 클로드 권고는 C였으나 B에서도 순수 함수 복사본이 무수정이므로 무회귀 증거를 행위 대조(19케이스+C3)로 옮겨 성립시킴, §2.4에 "의도된 행위 차이 전수 목록"을 둬 목록 밖 차이=회귀로 판정 가능하게 함. V3(--path 배타)는 형 결정으로 D-12 확정. 신규 결정 D-11~D-16, 신규 테스트 c1~c6·k1~k8·p1~p3 명세 | Claude |
