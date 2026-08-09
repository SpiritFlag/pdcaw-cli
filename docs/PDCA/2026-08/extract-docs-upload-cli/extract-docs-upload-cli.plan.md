---
template: plan
version: 1.3
---

# extract-docs-upload-cli 계획 문서

> **한 줄 요약**: PDCA-workspace에 갇혀 있던 `scripts/docs-upload.ts`를 **어느 레포에서나
> `npx pdcaw`로 실행되는 독립 CLI**로 꺼낸다. 이식만 하면 "옮기고 포장하기"로 끝날 일이었으나,
> 형의 두 가지 지적 — ①동기화 대상이 `docs/PDCA`가 아니라 **`docs/` 전체**여야 한다
> ②호출자(클로드)는 이미 `git diff`로 바뀐 파일을 알고 있으니 **경로를 직접 찍어 올릴 수
> 있어야 한다** — 이 스코프를 "이식 + 기능 확장 2건"으로 바꿨다.
>
> **프로젝트**: pdcaw-cli
> **작성자**: Claude
> **작성일**: 2026-08-09
> **상태**: **Approved** (v0.2 — §10 확인 포인트 3건 **전건 결정 완료**, 2026-08-09. §10 참조)
> **PDCA Cycle**: extract-docs-upload-cli (이 레포의 1번째 사이클, `v0.1.0` 예정)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 검증까지 끝난 문서 동기화 도구가 **PDCA-workspace 레포 안에서만 산다**. 다른 레포에서 같은 절차를 쓰려면 스크립트·`package.json`·`tsconfig`를 통째로 베껴야 하고, 그 순간 사본이 갈라진다. 게다가 현 스크립트는 `docs/PDCA` 경로에 딱 맞는 4종 문서만 올린다 — `docs/RULE.md`, `docs/PDCA/_INDEX.md`, `docs/deploy/CHECKLIST.md`는 **한 번도 서버에 올라간 적이 없다**(F6 실측). 마지막으로, 호출자는 이미 무엇이 바뀌었는지 아는데도 CLI가 매번 git 전체를 다시 훑는다. |
| **Solution** | 독립 레포 `pdcaw-cli` + npm 배포판 `pdcaw`. ①원본 4파일을 **로직 변경 없이** 옮기고 레포 결합 8곳(F3·F4·F7·F8)만 끊는다 ②`kind` 분기를 추가해 **`docs/` 아래 모든 `.md`**를 다룬다 — 사이클 경로 파서에 매칭되면 `kind='pdca'`, 아니면 `kind='general'`. 서버가 이미 지원하는 enum이라(F5) 서버 변경이 없고, **파서는 한 글자도 안 고친다**(D-3) ③`--path`로 파일·폴더를 콕 찍으면 git 탐지를 건너뛰고 그것만 올린다 ④런타임 의존성 0을 유지한 채 `tsc`로 빌드해 `npx pdcaw`가 즉시 뜨게 한다. |
| **Function/UX Effect** | 아무 레포에서 `npx pdcaw upload --path docs/RULE.md` 한 줄이면 그 문서 하나가 올라간다. 사이클을 닫을 땐 `npx pdcaw upload --cycle <이름> --version vX.Y.Z` 로 **`docs/` 전체**가 반영된다 — PDCA 4종뿐 아니라 `_INDEX.md`와 배포 체크리스트까지, 지금까지 서버에서 통째로 빠져 있던 문서들이 들어온다. PDCA-workspace의 `npm run docs:upload`는 그대로 살아 있어 이번 사이클 중 회귀가 나도 되돌아갈 곳이 있다. |
| **Core Value** | **"검증된 도구를 레포에 가두지 않는다."** 7차 사이클은 *기억에 의존하던 축을 구조가 강제하는 축으로 옮긴다*는 명제를 세웠지만, 그 구조는 레포 하나에만 설치돼 있었다. 이번 사이클은 그 구조를 **설치 가능한 형태**로 만든다. 동시에 "PDCA 문서만"이라는 7차의 좁은 전제를 형이 실사용에서 깨뜨렸다 — 동기화의 단위는 사이클이 아니라 **`docs/` 라는 폴더 그 자체**다. |

---

## Context Anchor

> Executive Summary에서 생성. Design/Do 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | ①검증 끝난 도구가 한 레포에 묶여 재사용 불가 ②`docs/PDCA` 밖 문서가 서버에 반영된 적 없음(실측 3건) ③호출자가 이미 아는 변경 목록을 CLI가 중복 계산. ②·③은 형이 이 사이클 착수 중에 직접 지목했고, 그 지적이 스코프를 "무회귀 이식"에서 **"이식 + 확장 2건"**으로 바꿨다 — 지시서의 `.tmp` 원문이 전제하던 "이동+패키징이지 재설계가 아니다"는 이 지점에서 **부분 폐기**된다(§1.4). |
| **WHO** | **클로드(Claude Code CLI) — 유일한 상시 호출자.** 7차와 동일하다. 사이클 종료 절차(RULE.md 3번)를 수행하는 주체가 클로드이고, `--path` 모드는 애초에 "클로드가 `git diff` 결과를 그대로 넘긴다"는 사용을 전제로 만들어진다 / **형** — 승인자, PAT 발급 주체(웹 UI가 유일 경로), npm 배포 주체 |
| **RISK** | `docs/` 전면 확대가 **올릴 생각 없던 초안까지 올린다**(RK-1) / 원본과 동작이 갈라져 "무회귀"라는 판정 기준 자체가 사라짐(RK-3) / 실행 위치에 따라 **레포 루트 판정이 흔들림**(RK-4) — 원본은 스크립트 위치로 고정돼 있어 없던 문제 / 원본과 CLI **두 벌 공존**으로 어느 쪽이 진짜인지 혼동(RK-6) / 빌드 산출물 누락 시 npx가 조용히 실패(RK-5) |
| **SUCCESS** | C1~C10 — 이식 무회귀(C1·C3)와 확장 2건(C4·C5)을 **분리해서** 판정한다. C3은 원본 실행 결과와 **PDCA 경로 문서에 한해** 동일해야 하고, general 문서는 증분으로만 확인한다(RK-3 대응). |
| **SCOPE** | 7건(S1 레포 골격·패키징 / S2 원본 4파일 이식 / S3 config 신설 / S4 `docs/` 전체 동기화 / S5 `--path` 핀포인트 / S6 테스트 / S7 문서). **확장 금지** — 파서 단일 원천 통합, 원본 `scripts/` 제거, `upload` 외 서브커맨드, 7차 이월 M-1~M-4·M-7, `docsDir` 설정, 삭제·rename 서버 반영은 전부 §2.2 이월. |

---

## 1. Overview

### 1.1 목적

7차 사이클(`refine-cycle-closing`)의 산출물인 `scripts/docs-upload.ts`를 **독립 npm 패키지**로
꺼내, 어떤 프로젝트 레포에서든 `npx pdcaw upload`로 PDCA 문서 동기화를 수행할 수 있게 한다.

이식만이 목적이었다면 이 문서는 짧았을 것이다. 그러나 착수 실측 과정에서 형이 두 가지를
지적했고, 둘 다 원본 설계의 전제를 건드린다.

1. **대상이 `docs/PDCA`가 아니라 `docs/` 전체여야 한다.** 원본은 `kind: 'pdca'`를 고정으로
   보내고 `pdcaStage`를 필수로 요구하므로, 사이클 경로 파서에 매칭되지 않는 문서는 전부
   건너뛴다. 실측하면 PDCA-workspace의 `docs/` 아래 `.md` 31개 중 **3개가 한 번도 올라간
   적이 없다**(F6). 서버는 이미 `kind='general'`을 지원하므로(F5) 이건 서버 한계가 아니라
   **스크립트 스코프의 한계**였다.
2. **호출자는 이미 무엇이 바뀌었는지 안다.** 클로드는 사이클 종료 절차를 수행하며 `git diff`를
   본다. 그 목록을 CLI에 그대로 넘길 수 있으면 git 재탐색이 통째로 불필요하다. 형의 표현
   그대로 — *"매번 스캔할 필요 없잖아."*

두 지적은 성격이 다르다. ①은 **원본의 결함에 가까운 스코프 누락**이고, ②는 **새로운 사용
경로의 추가**다. 둘 다 이번 사이클에 넣는다(형 결정, §1.4).

### 1.2 배경

`docs-upload.ts`는 7차 사이클의 산출물로, 사이클 종료 시 클로드가 MCP `document_write`를
직접 호출하면 문서 본문을 출력 토큰으로 재타이핑해야 한다는 문제(토큰 누수)와, 대상 선정이
사람의 기억에 의존해 이전 사이클 사후개정분이 서버에 반영되지 않는다는 문제(대상 누수)를
동시에 닫기 위해 만들어졌다. 파일을 그대로 읽어 HTTP로 보내고, 대상은 git 태그가 정한다.

7차는 검증을 마쳤고 RULE.md 종료 절차 3번에 정식 편입됐다. 이 사이클은 그 검증된 코드를
**옮기는** 작업이므로, 로직 자체를 다시 논증하지 않는다 — 확장 2건(S4·S5)만이 새로운 설계
대상이다.

### 1.3 확정 사실 (실측)

착수 전 실측. 추정 없이 원본 파일을 전수 확인한 결과다.

| ID | 사실 | 근거 |
|----|------|------|
| **F1** | **런타임 의존성 0.** 이식 대상 4파일의 import는 `node:fs/promises`, `node:path`, `node:child_process`, `node:util`뿐이고 HTTP는 전역 `fetch`를 쓴다. 서버 전용 의존성(hono·drizzle·neon·zod 등)은 **하나도 딸려오지 않는다** | `docs-upload.ts:7-14`, `git-changes.ts:4-5`, `workspace-api.ts` (import 없음), `cyclePath.ts` (import 없음) |
| **F2** | **테스트 19케이스 구성 확인** — `git-changes.test.ts` 8건(g1~g6, g5·g6은 두 describe에 중복 ID), `workspace-api.test.ts` 4건(w1~w4), `cyclePath.test.ts` 7건(t1~t7) | 3개 `.test.ts` 전수 |
| **F3** | **`REPO_ROOT = path.resolve(import.meta.dirname, '..')`** — 스크립트가 `<repo>/scripts/`에 있다는 위치 가정. CLI에서는 성립하지 않는다(패키지는 `node_modules` 안에 산다) | `docs-upload.ts:17` |
| **F4** | **`docs/PDCA` 문자열이 3곳에 하드코딩** — ①`scanAllDocs`의 스캔 뿌리 ②git `diff`/`status`의 pathspec ③경로 파서 정규식 | `docs-upload.ts:75`, `git-changes.ts:81-82`, `cyclePath.ts:12` |
| **F5** | **서버는 `kind='general'`을 이미 지원한다.** `document_kind` enum은 `['pdca','general']`이고, 교차 규칙은 *"kind가 general이면 pdcaStage를 지정할 수 없다"* 하나뿐 | `server/db/schema.ts:14`, `shared/schema.ts:35,45-47`, `server/mcp/tools.ts:95-97` |
| **F6** | **PDCA-workspace `docs/` 실측** — `.md` 31개 중 사이클 경로 매칭 28개, 비매칭 3개(`docs/RULE.md`, `docs/PDCA/_INDEX.md`, `docs/deploy/CHECKLIST.md`). 이 3건은 현 스크립트로 **업로드 불가**이며, `_INDEX.md`는 테스트 t3가 `null`을 명시적으로 기대한다 | `find docs -name '*.md'`, `cyclePath.test.ts` t3 |
| **F7** | **`docs/RULE.md`는 H1이 없다** — 첫 헤딩이 `## PDCA 문서`(H2). 나머지 2건은 H1 보유 | `head -1` 전수 |
| **F8** | **환경변수 주입을 npm script가 대행한다** — `"docs:upload": "set -a && . ./.env.local && set +a && tsx scripts/docs-upload.ts"`. CLI에는 이 래퍼가 없다 | `package.json` scripts |
| **F9** | **`tsconfig.server.json`은 `noEmit` + `allowImportingTsExtensions`** — tsx 실행 전제라 빌드 산출물이 없다. npm 배포판에는 그대로 쓸 수 없다 | `tsconfig.server.json` |
| **F10** | **Node v22.22.1 / npm 9.2.0**, `"type": "module"`, target es2023 | `node -v`, `npm -v`, `package.json` |
| **F11** | **`cyclePath.ts`는 25줄 전체가 필요하다** — UI 전용 코드 없음. `parseCycleStagePath`는 본체가, `cycleStagePath`·`PDCA_STAGES`·`ParsedCyclePath`는 왕복 테스트(t1·t2)가 쓴다 | `cyclePath.ts` 전문, `cyclePath.test.ts` |
| **F12** | **`--cycle`은 두 역할을 겸한다**(원본 I-4) — 부분 동기화 필터 + `--version` 시 연월을 찾는 열쇠. `--version`이 있으면 업로드 대상에는 필터를 **적용하지 않는다** | `docs-upload.ts:166-173` |
| **F13** | **npm 패키지명 `pdcaw`·`pdcaw-cli` 모두 미선점** (registry 404) | `registry.npmjs.org` 조회 |
| **F14** | vitest alias `@`·`@shared`는 이식 3파일과 무관 — 셋 다 alias를 쓰지 않는다 | `vitest.config.ts`, import 전수 |

### 1.4 Checkpoint 1·2 결정 사항

착수 실측 후 형에게 올린 쟁점과 답이다. **지시서(`.tmp`) 원문 대비 변경된 항목을 명시**한다.

| # | 쟁점 | 형의 결정 | 지시서 대비 |
|---|------|-----------|-------------|
| **K1** | `.pdcarc`의 `docsDir` 설정 vs 파서 정규식의 `docs/PDCA` 하드코딩 충돌 | **`docs` 고정, 설정 자체를 뺀다** | **변경** — 지시서는 `docsDir(기본 "docs/PDCA")`를 스키마에 두라고 했으나, 켜면 조용히 실패하는 설정이므로 제거 |
| **K2** | 동기화 대상 범위 | **`docs/` 아래 모든 `.md`** (확장자로 `.tmp` 자동 배제) | **변경(확장)** — 지시서의 "무회귀 이식" 전제를 부분 폐기 |
| **K3** | 확장을 이번 사이클에 넣을지, v0.2.0으로 뺄지 | **이번 사이클에 같이** | **변경** — v0.1.0이 "이식 + 확장"이 됨 |
| **K4** | 비PDCA 문서의 `title` 도출 | **첫 헤딩(레벨 무관) → 없으면 파일명** | 신규 (F7 때문에 H1 한정은 부적합) |
| **K5** | `.ts` 실행 방식 | **`tsc`로 `dist` 빌드 후 배포** — 런타임 의존성 0 유지 | 신규 |
| **K6** | `.env.local` 로딩 주체 | **CLI가 자동 로딩** (Node 내장 `process.loadEnvFile`) | 신규 (F8 대응) |
| **K7** | `--path` 핀포인트 업로드 | **신설.** git 변경 여부 무관 **무조건 업로드**, 파일·폴더 모두, 여러 번 지정 가능 | **신규 기능** — 지시서에 없던 항목. 근거: 호출자가 이미 `git diff`로 변경 목록을 안다 |

### 1.5 관련 문서

- 원본 코드: PDCA-workspace `scripts/docs-upload.ts`, `scripts/lib/{git-changes,workspace-api}.ts`,
  `src/features/cycle/lib/cyclePath.ts` 및 각 `.test.ts`
- 원본 설계: PDCA-workspace `docs/PDCA/2026-08/refine-cycle-closing/refine-cycle-closing.design.md`
  (§계층 구조만 참조 — 통독하지 않음)
- 경로 규약: 이 레포 `docs/RULE.md` (PDCA-workspace에서 복사)
- 착수 지시서: `.tmp` — **삭제 완료**(2026-08-09, RULE.md 규칙). 내용은 이 문서가 승계한다:
  실측 4건 → §1.3(F1~F14), 산출물 구조 → §7.3·§9, 설정 규칙 → §3.1·§8.3, 스코프 제한 →
  §2.2, 검증 항목 → §4, README 필수 내용 → §8.2. 지시서 대비 **변경된 전제는 §1.4에 전수 기록**

---

## 2. Scope

### 2.1 In Scope — 7건 고정 (확장 금지)

| ID | 항목 | 성격 |
|----|------|------|
| **S1** | **레포 골격 + 패키징** — `package.json`(name `pdcaw`, `bin`), `tsconfig.json`, `tsc` 빌드, `npx` 실행 확인 | 신규 |
| **S2** | **원본 4파일 이식** — `docs-upload.ts` → `commands/upload.ts`, `lib/{git-changes,workspace-api,cycle-path}.ts`. 레포 결합(F3·F4·F8·F9)만 끊고 **로직은 유지** | 이식 |
| **S3** | **`config.ts` 신설** — 설정 우선순위 해석, `.pdcarc.json` 읽기, PAT 가드, `.env.local` 자동 로딩 | 신규 |
| **S4** | **`docs/` 전체 동기화** — `kind` 분기(pdca/general)와 `title` 도출. **파서 무수정** | 확장 |
| **S5** | **`--path` 핀포인트 모드** — 지정 경로만 git 우회 업로드 | 확장 |
| **S6** | **테스트** — 19케이스 그대로 이식 + 신규(config 우선순위, kind 분기, title 도출, path 해석) | 이식+신규 |
| **S7** | **문서** — `README.md`(거버넌스 3줄 포함), `CHANGELOG.md`(v0.1.0), `.pdcarc.example.json` | 신규 |

### 2.2 Out of Scope — 이월 기록

| 항목 | 사유 | 재개 조건 |
|------|------|-----------|
| **파서 단일 원천 통합** (`cycle-path.ts`가 PDCA-workspace 사본으로 남음) | 두 레포에 걸친 패키지 의존 구조를 만들어야 함 — 이번 사이클의 3배 규모 | CLI가 안정화되고 PDCA-workspace가 `pdcaw`를 의존하게 될 때 |
| **원본 `scripts/` 제거** | 회귀 시 되돌아갈 곳이 필요하다. 두 벌 공존을 CHANGELOG·README가 기록한다(RK-6) | CLI로 사이클을 1회 이상 완주한 뒤 |
| **`upload` 외 서브커맨드** | 소비자 없음 | 실제 필요 발생 시 |
| **7차 이월 M-1~M-4·M-7** (사용성 Minor) | 지시서 명시 — 고치지 말 것 | 실사용 회신 7T-4 |
| **`docsDir` 설정** | K1 — 켜면 조용히 실패하는 설정 | `docs` 외 폴더를 쓰는 실제 레포 등장 시 |
| **삭제·rename의 서버 반영** | 원본 FR-88 그대로 경고만. `document_delete` MCP 툴 없음 | 서버에 삭제 툴이 생길 때 |
| **비 `.md` 파일 업로드** | 서버 `content`는 텍스트 — 바이너리가 섞이면 깨짐 | 없음 |
| **`_INDEX.md` 자동 생성** | 별개 관심사 | 없음 |

---

## 3. Requirements

### 3.1 기능 요구사항

**패키징·실행**

| ID | 요구사항 |
|----|----------|
| **FR-1** | `npx pdcaw upload [옵션]` 으로 실행된다. 서브커맨드 라우팅은 `upload` 하나만 두되 확장 여지를 남긴다 |
| **FR-2** | 알 수 없는 서브커맨드·옵션은 usage와 함께 exit 1 |

**설정**

| ID | 요구사항 |
|----|----------|
| **FR-3** | 우선순위: **CLI 인자 > 환경변수(`PDCAW_*`) > `.pdcarc.json` > 에러** |
| **FR-4** | `.pdcarc.json`(실행 레포 루트, 커밋 대상) 스키마: `projectId`, `baseUrl`. **`docsDir`는 두지 않는다**(K1) |
| **FR-5** | `.pdcarc.json`에 `pat`·`token` 류 키가 있으면 **경고 출력 후 무시**한다. 값은 로그에 찍지 않는다 |
| **FR-6** | 실행 레포 루트의 `.env.local`이 있으면 자동 로딩한다(Node 내장). 없으면 조용히 넘어간다. 로딩한 파일 경로는 출력한다(RK-8) |
| **FR-7** | PAT 미설정 시 원본과 동일한 3줄 안내 에러(발급 위치·저장 위치·브랜치 주의) |
| **FR-8** | `.pdcarc.json`도 없고 `PDCAW_PROJECT_ID`도 없으면, 서버 `project_list`로 자동 해석한다(원본 유지). 2개 이상이면 목록과 함께 에러 |
| **FR-9** | `PDCAW_PAT`·`PDCAW_PROJECT_ID`·`PDCAW_BASE_URL`의 의미는 원본과 동일하다(무회귀) |

**대상 선정**

| ID | 요구사항 |
|----|----------|
| **FR-10** | 기본 모드: 최신 git 태그 이후 **`docs/` 변경분**(커밋분 ∪ 작업트리, 같은 경로는 작업트리 우선). 원본의 `docs/PDCA` pathspec을 `docs`로 넓힌다 |
| **FR-11** | `--all`: git 없이 `docs/` 전체 스캔 |
| **FR-12** | `--path <경로>`: **git 탐지를 건너뛰고** 지정 경로만 대상으로 한다. 파일·폴더 모두 허용, **여러 번 지정 가능**(합집합). 변경 여부를 따지지 않는다 |
| **FR-13** | 대상은 **`.md`만** — 모드 무관. `--path`로 직접 찍은 파일도 예외가 아니며, `.md`가 아니면 사유와 함께 건너뛴다(Q3 결정). RULE.md가 정의한 `.tmp` 질문 파일은 이 규칙으로 자동 배제된다 |
| **FR-14** | `--cycle X` 단독 = 부분 동기화 필터(그 사이클 문서만). `--cycle X --version vN` = 필터 없이 전체(원본 I-4·F12 유지) |
| **FR-15** | 삭제·rename은 **경고만** 출력하고 서버 요청을 보내지 않는다(원본 FR-88) |
| **FR-16** | 대상 0건이면 조용히 성공 종료(exit 0) |
| **FR-17** | 업로드 전 대상 목록을 **반드시 출력**한다(경로 + kind + stage) |

**업로드**

| ID | 요구사항 |
|----|----------|
| **FR-18** | 경로가 사이클 파서에 매칭되면 `kind='pdca'` + `pdcaStage`, 매칭되지 않으면 `kind='general'`(pdcaStage 미전송). **파서는 수정하지 않는다** |
| **FR-19** | `title` — pdca는 사이클명(원본 D-59 유지), general은 **첫 헤딩 텍스트(레벨 무관) → 없으면 확장자 뺀 파일명** |
| **FR-20** | 빈 파일(공백만)은 경고 후 건너뛴다. exit 코드에 영향 없음 |
| **FR-21** | 파일 하나가 실패해도 나머지를 계속 처리한다. 실패가 1건 이상이면 exit 1 |
| **FR-22** | `--version` 지정 시 **문서 업로드보다 먼저** 사이클(릴리즈)을 생성한다. 409 `target='version'`은 "이미 존재"로 성공 취급, `target='name'`은 실패 |
| **FR-23** | 실행 시작에 대상 base-url을 출력한다. 401은 원인 지목형 메시지(PAT-브랜치 짝) |
| **FR-24** | **PAT는 어떤 로그·에러 메시지에도 등장하지 않는다** |

### 3.2 비기능 요구사항

| ID | 요구사항 | 판정 |
|----|----------|------|
| **NFR-1** | **런타임 의존성 0** — `dependencies` 비어 있음 | `package.json` |
| **NFR-2** | Node `>=20.12` (`process.loadEnvFile` 하한). `engines`에 명시 | `package.json` |
| **NFR-3** | ESM 단일. CJS 듀얼 빌드 없음(bin 실행 전용, 라이브러리 소비자 없음) | — |
| **NFR-4** | `tsc` 그린 / lint 그린 | CI 아닌 로컬 실행 |
| **NFR-5** | semver 준수. **`.pdcarc` 스키마 또는 인자 체계 호환이 깨지면 메이저** | README 거버넌스 |
| **NFR-6** | PDCA-workspace 레포는 **읽기 전용** — 이번 사이클에서 수정하지 않는다 | git status |

---

## 4. Success Criteria

이식(무회귀)과 확장을 **분리해서** 판정한다. 확장 때문에 무회귀 판정이 흐려지는 것이
RK-3이므로, C3은 PDCA 경로 문서에만 적용한다.

| ID | 기준 | 충족 조건 |
|----|------|-----------|
| **C1** | **이식 19케이스 전건 green** | 원본과 동일한 케이스 ID(g1~g6, w1~w4, t1~t7)로 통과 |
| **C2** | **신규 테스트 green** | config 우선순위, kind 분기, title 도출, `--path` 해석 |
| **C3** | **원본 무회귀** ★ | PDCA-workspace 루트에서 `npm link` 후 `pdcaw upload --cycle refine-cycle-closing --version v0.1.6` 실행 → **PDCA 경로 문서에 한해** 원본 `npm run docs:upload` 실행과 동일한 결과. dev 서버 대상, 멱등 재실행으로 확인(`hns-` 픽스처 불필요) |
| **C4** | **general 문서가 올라간다** ★ | F6의 3건(`docs/RULE.md`, `docs/PDCA/_INDEX.md`, `docs/deploy/CHECKLIST.md`)이 `kind='general'`로 반영. `RULE.md`의 title이 **`PDCA 문서`**(첫 헤딩, H2)인지 확인 — F7이 지목한 실물 사례 |
| **C5** | **`--path` 핀포인트가 동작한다** ★ | **변경되지 않은** 문서 1건을 `--path`로 지정 → 업로드됨(git 탐지 우회 실증). 폴더 지정 시 하위 `.md` 전부, `--path` 2회 지정 시 합집합 |
| **C6** | **설정 없는 곳에서 명확히 실패한다** | `.pdcarc` 없고 환경변수도 없는 디렉터리에서 실행 → 무엇을 어디에 넣어야 하는지 알려주는 에러 |
| **C7** | **`.pdcarc`의 PAT는 거부된다** | `.pdcarc`에 `pat` 키를 넣고 실행 → 경고 출력 + 무시. 값이 로그에 없음 |
| **C8** | **PAT 로그 누출 0건** | 전체 실행 로그에 `grep pdcaw_` 무결과 |
| **C9** | **`tsc`·lint 그린** | 로컬 실행 로그 |
| **C10** | **npx 실행 형태가 성립한다** | `npm pack` 후 **다른 디렉터리**에서 `npx <tarball> upload --help` 실행 성공 — 빌드 산출물 누락(RK-5) 검출 |

### 4.1 Definition of Done

- [x] FR-1~FR-24 전건 구현 — 2026-08-09
- [x] C1~C10 전건 실증 (로그 첨부) — Design §8.3 참조. C1(40케이스 green)·C2·C3·C4·C5·C6·C7·C8·C9·C10 전건
- [x] `tsc` 그린 / lint 0 warning
- [x] PDCA-workspace 레포 `git status` 무변경 (NFR-6) — Read 전용, mtime 대조로 재확인
- [x] `README.md` 거버넌스 3줄 포함. `npx pdcaw` 기준으로 작성
- [x] `CHANGELOG.md` v0.1.0 작성 — 두 벌 공존 상태 명기
- [x] `.tmp` 착수 지시서 삭제 (RULE.md 규칙) — 2026-08-09 완료, 내용은 §1.5가 승계
- [ ] initial commit + `v0.1.0` 태그 — **형 확인 후**

**사이클 종료 절차에 붙는 항목** (RULE.md 절차와 병행, Q2 결정)

- [ ] 태그 push **직후** `npm publish` — **태그·push 승인과 별개로 다시 승인받는다**(비가역)
- [ ] publish 후 **PDCA-workspace 아닌 디렉터리**에서 `npx pdcaw upload --help` 실행 확인
      (C10이 tarball로 실증한 것을 registry 경로로 재확인)

---

## 5. Risks and Mitigation

| ID | 리스크 | 영향 | 가능성 | 완화 |
|----|--------|:----:|:------:|------|
| **RK-1** | **`docs/` 전면 확대가 올릴 생각 없던 문서까지 올린다** — 작업 중 초안, 리뷰 노트, 실험 문서 | High | **High** | ①`.md`만(`.tmp` 자동 배제) ②업로드 전 대상 목록 필수 출력(FR-17) ③**`--path`가 근본 대안** — 정확히 아는 것만 올리는 경로가 생기므로 전체 스캔에 의존할 이유가 줄어든다 |
| **RK-2** | general 문서 대량 유입으로 서버 문서 목록이 지저분해짐 | Medium | Low | 실측 3건뿐(F6). 대상 출력으로 사전 확인 가능 |
| **RK-3** | **확장 때문에 "원본 무회귀" 판정 기준이 사라진다** — 동작이 달라지는 게 정상인 상태에서 회귀를 어떻게 구분하나 | High | Medium | C3을 **PDCA 경로 문서에만** 적용하고 general은 C4에서 증분으로만 확인. 두 기준을 절대 섞지 않는다 |
| **RK-4** | **레포 루트 판정이 실행 위치에 따라 흔들린다** — 원본은 스크립트 위치로 고정(F3)이라 없던 문제. 하위 디렉터리에서 실행하면 `docs/`를 못 찾거나 엉뚱한 곳을 본다 | High | Medium | Design V1에서 판정 방식 확정(`git rev-parse --show-toplevel` vs `cwd`). `--path`는 git 없는 환경도 지원해야 하므로 **git에만 의존할 수 없다**. 결정 후 실행 시작 로그에 판정된 루트를 출력 |
| **RK-5** | 빌드 산출물 누락으로 npx가 조용히 실패 | Medium | Medium | `prepublishOnly` 빌드 + **C10이 `npm pack`으로 실증** (체크박스만 채우지 않는다) |
| **RK-6** | **두 벌 공존** — PDCA-workspace의 `npm run docs:upload`와 `npx pdcaw`가 동시에 살아 있어 어느 쪽이 진짜인지 혼동. 한쪽만 고치면 갈라짐 | Medium | **High** | 의도된 상태(회귀 시 대피처). CHANGELOG·README에 명기하고, **원본 제거를 백로그에 남긴다**. 이번 사이클 중 원본은 읽기 전용(NFR-6) |
| **RK-7** | `title` 첫 헤딩 추출이 코드블록 안의 `#`나 프론트매터를 오인 | Low | Medium | Design V2에서 규칙 확정. 최소한 프론트매터(`---`) 스킵과 펜스(```) 내부 제외는 다룬다 |
| **RK-8** | `.env.local` 자동 로딩이 실행 위치에 따라 다른 파일을 먹는다 | Medium | Medium | 로딩한 파일의 절대경로를 출력(FR-6). RK-4와 같은 뿌리 — 루트 판정에 종속 |
| **RK-9** | 파서 사본이 PDCA-workspace 원본과 갈라진다 | Medium | Low | `cycle-path.ts` 헤더에 **원본 위치 + 단일 원천 통합 시점(이월)** 주석 필수. 이번 사이클에서 파서는 무수정(D-3)이라 갈라질 코드 변경 자체가 없다 |

---

## 6. Impact Analysis

### 6.1 변경 리소스

| 리소스 | 변경 | 비고 |
|--------|------|------|
| `pdcaw-cli/` 전체 | **신규** | 이 레포의 첫 코드 커밋 |
| PDCA-workspace `scripts/**` | **무변경** | NFR-6 — 읽기 전용 |
| PDCA-workspace `src/features/cycle/lib/cyclePath.ts` | **무변경** | 복사만 |
| PDCA-workspace `docs/RULE.md` 종료 절차 3번 | **무변경(이번엔)** | `npm run docs:upload` 표기 유지. CLI 전환은 원본 제거 사이클에서 |
| npm registry `pdcaw` | **v0.1.0 publish** | F13 — 미선점 확인. **사이클 종료 절차에서 태그 push 직후 실행**(Q2 결정). 비가역이므로 **별도 승인** 필요 |

### 6.2 기존 소비자

| 소비자 | 영향 |
|--------|------|
| PDCA-workspace의 `npm run docs:upload` | **없음** — 그대로 동작 |
| 워크스페이스 서버 | **없음** — `kind='general'`은 기존 스키마(F5). 서버 코드·마이그레이션 무변경 |
| 서버 문서 목록 UI | general 문서 3건이 새로 나타남 — 표시 자체는 기존 기능 |

### 6.3 검증 (Design 착수 전)

- **V1** — 레포 루트 판정 방식 실측: `git rev-parse --show-toplevel` 동작 범위, git 없는
  디렉터리에서의 폴백, 하위 디렉터리 실행 시나리오 (RK-4)
- **V2** — `title` 첫 헤딩 추출 규칙 확정: 프론트매터·코드펜스 처리 (RK-7)
- **V3** — `--path`와 `--cycle`/`--all` 동시 지정 시 처리 (배타 에러 vs 우선순위)
- **V4** — `tsc` 빌드 실동작 확인: `rewriteRelativeImportExtensions`로 소스의 `.ts` import를
  수정 없이 `.js`로 내보낼 수 있는지 (TypeScript 6.0 기준)
- **V5** — `npm link` 종단 검증 환경 준비: dev 서버 기동, PAT 짝 확인

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

**Dynamic** — 단일 목적 CLI, 런타임 의존성 0, 서버·프론트 없음. Enterprise 도구(k8s·terraform)
불필요.

### 7.2 핵심 아키텍처 결정 (Decision Record)

| ID | 결정 | 근거 |
|----|------|------|
| **D-1** | **레포 루트는 "실행 위치 기준"으로 판정한다** (구체 방식은 Design V1) | F3 — 원본의 스크립트 위치 기준(`import.meta.dirname/..`)은 npm 패키지에서 성립하지 않는다. 이식에서 **반드시 바뀌어야 하는 유일한 핵심 로직** |
| **D-2** | **`docs/` 전체를 대상으로 하고 `kind`로 분기한다** | F5 — 서버가 이미 지원. 형 지적 ①. 파서 매칭 = pdca, 비매칭 = general |
| **D-3** | **`cycle-path.ts`(파서)는 한 글자도 고치지 않는다** | RK-9 — 확장은 **호출부의 분기**로 흡수한다. 파서가 그대로면 단일 원천 통합(이월)이 나중에 쉬워진다. K1에서 `docsDir`를 뺀 것도 같은 이유 |
| **D-4** | **`--path`는 git을 우회하고 무조건 업로드한다** | 형 지적 ② — *"사용자 측에서는 git diff로 수정된 파일 몇 개인지 알고 있다."* 호출자가 이미 계산한 것을 CLI가 다시 계산하지 않는다. 부수 효과로 **태그 없는 레포·git 아닌 디렉터리에서도 동작**한다 |
| **D-5** | **`title`은 pdca와 general이 서로 다른 규칙을 쓴다** | pdca는 사이클명(원본 D-59, ImportDialog와 정합). general은 사이클이 없으므로 문서 자체에서 뽑는다(K4·F7) |
| **D-6** | **`docsDir` 설정을 두지 않는다** | K1 — 파서가 `docs/PDCA/` 접두를 강제하므로, 뿌리만 바꾸면 모든 문서가 general로 강등되는 조용한 함정이 된다. 없는 설정이 잘못된 설정보다 낫다 |
| **D-7** | **`tsc`로 `dist`를 만들어 배포한다** | K5 — 런타임 의존성 0(NFR-1)을 지키면서 npx 첫 실행을 가볍게 한다. tsx를 dependencies에 넣으면 esbuild(~30MB)가 따라온다 |
| **D-8** | **`.env.local`은 CLI가 직접 읽는다** | K6·F8 — npm script 래퍼가 사라진 자리를 CLI가 메우지 않으면 원본 대비 사용성 회귀다. Node 내장이라 의존성 비용 0 |
| **D-9** | **PAT는 환경변수 경로만 인정한다** | `.pdcarc`는 커밋 대상 파일이다. 경고 후 무시(FR-5)로 **잘못된 습관이 조용히 성립하지 않게** 막는다 |
| **D-10** | **원본 `scripts/`를 남긴다** | RK-6 — 의도된 이중화. 회귀 시 대피처가 있어야 이번 사이클을 안심하고 닫을 수 있다 |

### 7.3 실행 흐름

```
npx pdcaw upload [--cycle X] [--version vN] [--all] [--path P ...] [--project id] [--base-url url]
  │
  ├─ 0. 레포 루트 판정 (D-1) → .env.local 자동 로딩 (D-8) → 판정 결과 출력
  │
  ├─ 1. 설정 해석 (config.ts)
  │      CLI 인자 > PDCAW_* > .pdcarc.json > 에러
  │      .pdcarc에 pat/token 류 있으면 경고 후 무시 (D-9)
  │      PAT 없으면 안내 에러로 종료
  │
  ├─ 2. 대상 선정
  │      --path 있음  → 지정 경로만 (git 우회, 무조건)      … D-4
  │      --all        → docs/ 전체 스캔
  │      기본         → 최신 태그 이후 docs/ 변경분 ∪ 작업트리
  │      공통 필터: .md 만 / 삭제·rename 경고만
  │      --cycle 단독일 때만 사이클 필터 적용 (F12)
  │
  ├─ 3. 분류 (D-2·D-3)
  │      parseCycleStagePath(경로) 매칭 → kind=pdca, stage=파서 결과, title=사이클명
  │                            비매칭 → kind=general,             title=첫 헤딩 → 파일명
  │
  ├─ 4. 대상 목록 출력 (FR-17)  ← 형이 로그로 확인하는 지점
  │
  ├─ 5. --version 있으면 사이클 생성 먼저 (FR-22)
  │
  └─ 6. 파일별 document_write 루프 — 실패 격리, 집계 후 exit 코드 결정
```

---

## 8. Convention Prerequisites

### 8.1 기존 규약 (이 레포에 이미 있음)

- `docs/RULE.md` — PDCA 문서 경로·파일명·종료 절차. PDCA-workspace에서 복사됨
- `CLAUDE.md` — 커밋 메시지 타입(`feat`/`fix`/`optimize`/`refine`/`docs`/`chore`), 제목 한 줄

### 8.2 이번에 정하는 것

- **코드 주석 규약** — 원본의 `Design Ref:` / `Plan SC:` 주석을 **그대로 보존**한다. 참조 번호는
  PDCA-workspace 7차 문서를 가리키므로, `cycle-path.ts`와 이식 파일 헤더에 **"원본 위치 +
  참조 번호는 PDCA-workspace 7차 문서 기준"**을 명시한다(RK-9)
- **거버넌스 2트랙** (README 필수 기재) — 일반 패치는 백로그+커밋+태그+CHANGELOG, **구조
  변경(`.pdcarc` 스키마·인자 체계·프로토콜)만 PDCA 사이클**. semver 준수, 스키마/인자 호환이
  깨지면 메이저

### 8.3 환경변수

| 변수 | 의미 | 원본 대비 |
|------|------|-----------|
| `PDCAW_PAT` | PAT. 웹 UI `/tokens`에서 발급, 서버(Neon 브랜치)별로 다름 | **동일** |
| `PDCAW_PROJECT_ID` | 선택. 없으면 `project_list`로 자동 해석 | **동일** |
| `PDCAW_BASE_URL` | 선택. 없으면 프로덕션 | **동일** |

`.pdcarc.json`(커밋 대상): `projectId`, `baseUrl`. **PAT 금지**(D-9).

---

## 9. [DO] 실행 마일스톤

| # | 모듈 | 내용 | 선행 |
|---|------|------|------|
| **M1** | 골격 | `package.json`·`tsconfig.json`·빌드 파이프라인. `--help`만 뜨는 `cli.ts` | — |
| **M2** | 이식 | 4파일 복사 + 결합 절단(F3·F4·F8·F9). **로직 무변경** | M1 |
| **M3** | 설정 | `config.ts` — 우선순위·`.pdcarc`·PAT 가드·`.env.local` | M1 |
| **M4** | 확장 | `kind` 분기 + `title` 도출 (S4) | M2 |
| **M5** | 확장 | `--path` 핀포인트 (S5) | M2·M3 |
| **M6** | 테스트 | 19케이스 이식 + 신규 4종 | M2~M5 |
| **M7** | 검증 | C1~C10 실증, 로그 수집 | M6 |
| **M8** | 문서 | README·CHANGELOG·`.pdcarc.example.json` | M7 |

---

## 10. Next Steps

1. [x] §10 확인 포인트 3건에 대한 형의 판단 — **전건 결정 완료** (2026-08-09)
2. [ ] Design 문서 작성 — V1~V5 실측 후 결정 확정
3. [ ] M1부터 구현

### 확인 포인트 — 결정 완료

| # | 쟁점 | 클로드 권고 | **형의 답** |
|---|------|-------------|-------------|
| **Q1** | **사이클명이 스코프와 어긋나기 시작했다.** `extract-docs-upload-cli`는 "이식"만 담는 이름인데, 실제 스코프는 이식 + 확장 2건이다 | **유지 권고.** 사이클명은 디렉터리·파일명·서버 사이클 레코드에 박히므로 지금 바꾸면 잃는 게 크다 | **유지.** 확장 2건의 기록 책임은 CHANGELOG v0.1.0과 이 문서 §1.4가 진다 |
| **Q2** | **npm publish를 이번 사이클에 할 것인가?** `pdcaw`는 미선점(F13). `npx pdcaw`가 진짜로 동작하려면 registry에 있어야 하지만 publish는 **비가역**이다 | 이번 사이클엔 하지 않기 권고 — `npm pack`(C10) + `npm link`로 충분 | **하되, analyze까지 마치고 사이클 끝물에.** 형의 이 절충이 권고보다 낫다: ①자동 unpublish 창(72시간)은 **결함이 이미 드러난 뒤**에 열려 있어야 값어치가 있는데, C1~C10과 갭 분석이 끝난 시점이 정확히 그 조건이다 ②README를 처음부터 `npx pdcaw` 기준으로 쓸 수 있어 지시서의 "설치 없이 npx 실행" 요구와 정합한다 — 미publish면 `npm link` 안내를 본문에 넣었다가 나중에 걷어내야 했다 ③**태그 push 직후** 실행하면 태그가 "배포된 것"을 가리킨다(순서를 뒤집으면 registry에는 있는데 태그가 없는 구간이 생긴다). **publish 실행은 태그·push 승인과 별개로 다시 승인받는다** |
| **Q3** | **`--path` 지정 시 `.md` 확장자 필터를 적용할 것인가?** | 파일 직접 지정이면 확장자 무관, 폴더면 `.md`만 (비대칭) — 다만 헷갈리면 전부 `.md`만도 무방 | **`.md` 한정 — 모드 무관.** 권고의 비대칭안을 버리고 단순한 쪽을 택했다. FR-13이 "대상은 `.md`만"이라는 **단일 규칙**이 되어 예외가 사라진다. 서버 `content`가 텍스트라는 제약(§2.2)과도 한 줄로 맞물린다 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.4 | 2026-08-09 | **Do 단계(구현+종단 검증) 완료.** DoD 전 항목 체크 — 상세 근거는 Design v0.2 §8.3·§11.2.
publish(Q2 결정)는 아직 실행하지 않음 — analyze 완료 후 사이클 끝물, 태그 push 직후로
예정대로 대기 중. 커밋도 아직 하지 않음(형 diff 확인 대기, §10 원칙 유지) | Claude |
| 0.3 | 2026-08-09 | **레포 공개 정책 확정에 따른 정합 수정.** 형이 공개 레포를 이유로 `CLAUDE.md`·`docs/*`를 gitignore했다가 실측 지적을 받고 되돌린 건이다 — **`docs/*` 무시가 이 CLI의 기본 대상 선정(FR-10)을 이 레포에서 무력화**하기 때문(ignore된 파일은 `git status --porcelain`에 나오지 않아 `--all`·`--path`로만 동작). 확정: 레포 공개 유지 / `docs/` 추적 / 기본수칙은 전역 `~/.claude/CLAUDE.md`로 이관(레포 사본 삭제) / `.gitignore`는 `.env*`·`dist`·`*.tmp`·루트 `*.txt`를 막고 `.pdcarc.json`은 열어둠(12경로 검증). 문서 변경은 2건 — **§1.5** 착수 지시서 `.tmp` 삭제 완료 및 승계 관계 명시, **DoD** 해당 항목 체크. **스코프·요구사항·성공 기준·결정·리스크 전부 무변경** | Claude |
| 0.2 | 2026-08-09 | **형 결정 3건 반영 — 확인 포인트 전건 종결.** ①**Q1**(사이클명): 유지 — 스코프가 넓어져도 이름을 바꾸지 않고 기록 책임을 CHANGELOG·§1.4로 넘긴다 ②**Q2**(publish 시점): **클로드 권고를 형이 개선.** "안 한다"가 아니라 **"analyze까지 마치고 사이클 끝물에"** — 72시간 unpublish 창이 결함 노출 이후에 열리게 배치하는 절충이다. 파생 변경 3건: §6.1 npm registry 행을 '선점 예정'에서 **'v0.1.0 publish + 별도 승인'**으로, DoD에 **사이클 종료 절차 항목 2건**(태그 push 직후 publish / registry 경로 재확인) 신설, README를 **`npx pdcaw` 기준으로 작성**하도록 DoD에 명시(미publish 전제였다면 `npm link` 안내를 썼다가 걷어내야 했다) ③**Q3**(`--path` 확장자): 권고의 비대칭안(파일=무관, 폴더=`.md`)을 버리고 **`.md` 한정 단일 규칙** — FR-13이 모드 무관 규칙이 되며 FR-12에서 폴더 한정 문구를 제거했다. **스코프 7건·C1~C10·D-1~D-10·RK-1~RK-9는 전부 무변경** — Plan의 논증이 그대로 기준선으로 확정됐다. 상태 Draft → Approved | Claude |
| 0.1 | 2026-08-09 | 최초 작성. 착수 지시서(`.tmp`)의 실측 4건을 F1~F14로 확장 수행 — **F1**(런타임 의존성 0, 서버 의존성 미유입 확인) **F5**(서버가 `kind='general'`을 이미 지원 → 확장이 서버 변경 없이 가능하다는 근거) **F6**(`docs/` 31개 중 3개가 한 번도 업로드된 적 없음 → 형 지적 ①의 실증) **F7**(`RULE.md`에 H1 없음 → K4가 "첫 H1"이 아니라 "첫 헤딩"이 된 이유) **F13**(npm 이름 미선점). 형의 착수 중 지적 2건이 스코프를 바꿈 — ①`docs/` 전체 동기화(K2·K3, S4) ②`--path` 핀포인트(K7, S5). 이로써 지시서의 **"이동+패키징이지 재설계가 아니다"** 전제가 부분 폐기되고, 판정 기준이 "원본 무회귀" 단일에서 **무회귀(C3) + 확장 실증(C4·C5) 분리**로 바뀜(RK-3). Checkpoint 1·2 결정 7건(K1~K7) 반영. §10에 확인 포인트 3건(Q1 사이클명 / Q2 publish 시점 / Q3 `--path` 확장자 필터) 상신 | Claude |
