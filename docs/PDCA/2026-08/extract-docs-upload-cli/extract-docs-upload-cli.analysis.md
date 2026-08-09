---
template: analysis
version: 1.3
---

# extract-docs-upload-cli 분석 보고서

> **분석 유형**: Gap Analysis (Design vs 구현) — API/DB/UI 항목은 이 프로젝트(CLI, 서버 없음)에
> 해당 없어 생략하고, FR/D 결정·Clean Architecture·컨벤션·종단 검증 위주로 구성한다.
>
> **프로젝트**: pdcaw-cli
> **분석자**: Claude
> **작성일**: 2026-08-09
> **Design 문서**: [extract-docs-upload-cli.design.md](./extract-docs-upload-cli.design.md) (v0.2)
> **Plan 문서**: [extract-docs-upload-cli.plan.md](./extract-docs-upload-cli.plan.md) (v0.4)
> **상태**: GAP-1·GAP-2 수정 완료(2026-08-09, Checkpoint 5 — 형 "지금 모두 수정" 결정). 아래 표는
> 발견 시점 기록이며, 수정 결과는 §Version History 참조

---

## Context Anchor

> Design v0.2에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | ①검증 끝난 도구가 한 레포에 묶여 재사용 불가 ②`docs/PDCA` 밖 문서가 서버에 반영된 적 없음(실측 3건) ③호출자가 이미 아는 변경 목록을 CLI가 중복 계산 |
| **WHO** | 클로드(유일한 상시 호출자) / 형(승인·PAT·npm 배포) |
| **RISK** | RK-1(의도치 않은 업로드) RK-3(무회귀 판정 기준 소실) RK-4(루트 판정 흔들림) RK-6(두 벌 공존) RK-5(빌드 산출물 누락) |
| **SUCCESS** | C1~C10 — 이식 무회귀(C1·C3)와 확장 실증(C4·C5) 분리 판정 |
| **SCOPE** | 7건(S1~S7). 파서 통합·원본 제거·`docsDir`·삭제 반영 등은 이월 |

---

## Strategic Alignment Check

PRD 없음(Plan §RULE.md 경량 트랙 — pm 단계 생략, 형 지시로 Plan부터 착수). PRD 대조는 해당 없음.

### Success Criteria Status (Plan §4)

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C1 | 이식 19케이스 전건 green | ✅ Met | `vitest run` 40/40, 이식분 ID(g1~g6,w1~w4,t1~t7) 원본과 동일 — [cycle-path.test.ts](../../../../src/lib/cycle-path.test.ts) 등 |
| C2 | 신규 테스트 green | ✅ Met | config(c1~c7)·classify(k1~k8)·targets(p1~p4) 전건 통과 |
| C3 | 원본 무회귀(PDCA 경로 문서) | ⚠️ Partial | 아래 §Decision Record Verification·§2.7 참조 — 메시지 문자열·필드 매핑은 원본과 동일 확인, 단 "원본 스크립트와 나란히 실행해 diff" 방식은 아니고 간접 증거(코드 대조+서버 상태 대조)로 대체됨 |
| C4 | general 문서 업로드 | ✅ Met | `document_read`로 서버 상태 직접 확인 — `kind:"general"`, `pdcaStage:null`, `title:"PDCA 문서"`(RULE.md) |
| C5 | `--path` 핀포인트 | ✅ Met | 기능 동작 확인(미변경 문서·폴더 지정 라이브 테스트) + **GAP-1 수정 완료**로 D-17(cwd 기준 해석)까지 충족 — §2.1 참조 |
| C6 | 설정 없을 때 안내 에러 | ✅ Met | `config.test.ts` c6, 실 fs 사용 |
| C7 | `.pdcarc` PAT 거부 | ✅ Met | `config.test.ts` c7 |
| C8 | PAT 로그 누출 0건 | ✅ Met | stdout/stderr 캡처 후 `grep -c pdcaw_` = 0 |
| C9 | tsc·lint green | ✅ Met | 로컬 실행 로그(본 분석 중 재확인) |
| C10 | npx 실행 형태 | ✅ Met | `npm pack` + 딴 디렉터리 `npx file:<tgz>` 실행 성공(환경 특성상 `file:` 접두 필요, registry publish 후엔 무관) |

**Success Rate**: 9/10 Met, 1/10 Partial (C3 — GAP-1 수정과 무관한 별개 사유, §2.1 GAP-3 참조)

### Decision Record Verification

| 출처 | 결정 | 이행? | 편차 |
|------|------|:---:|------|
| [Plan] D-1 루트는 실행 위치 기준 판정 | ✅ | — |
| [Plan] D-3 파서 무수정 | ✅ | — cycle-path.ts는 원본과 완전히 동일(빈 diff) |
| [Plan] D-4 `--path`는 git 우회·무조건 | ✅ | — |
| [Plan] D-9 PAT는 환경변수 경로만 | ✅ | — |
| [Design] D-11 루트 판정 3단(.pdcarc→git→cwd) | ✅ | — 라이브 확인(PDCA-workspace에서 `git` source로 판정) |
| [Design] D-12 `--path` 완전 배타 | ✅ | 코드상 정확 구현되었으나 **테스트 커버리지 0** — §2.7 GAP-2 |
| [Design] D-13 title 추출(프론트매터 스킵·펜스 제외) | ✅ | k4~k6 테스트 + 라이브 확인 |
| [Design] D-15 `.env.local`이 기존 env 안 덮음 | ✅ | 별도 node 실험으로 실측 확인(root.ts 주석에 기록) |
| [Design] D-17 `--path`는 **cwd 기준** 상대경로 해석 | ✅ | GAP-1로 발견 후 즉시 수정 완료 — `resolvePathTargets`가 이제 `cwd` 파라미터를 받는다 |
| [Design] D-18 `--path` 존재 검증, 서버 요청 전 중단 | ✅ | targets.test.ts p4 |

---

## 1. Analysis Overview

### 1.1 목적

Do 단계 구현(module-1,2)과 종단 검증(module-3)이 Design v0.2·Plan v0.4의 결정을 얼마나
정확히 구현했는지 코드 직접 대조로 검증한다. Design 문서 자체가 이미 §8.3에 종단 검증
결과를 기록해뒀으므로, 이 분석은 **Design 작성자(클로드)의 자기 검증을 다시 코드 레벨에서
독립적으로 재검증**하는 데 집중한다 — 특히 "실행해서 성공했다"와 "Design이 명시한 그대로
구현됐다"는 서로 다른 질문이다.

### 1.2 분석 범위

- **Design 문서**: `docs/PDCA/2026-08/extract-docs-upload-cli/extract-docs-upload-cli.design.md` (v0.2)
- **구현 경로**: `src/` 전체(9개 모듈) + `package.json`·`tsconfig.json`
- **분석 방법**: Design의 결정 항목(D-1~D-18, FR-1~FR-24, NFR-1~NFR-6) 각각을 실제 소스
  코드 줄 단위로 대조. 서버 상태는 `document_read` MCP 호출로 별도 확인(코드 읽기가 아닌
  실제 실행 결과)

---

## 2. Gap Analysis (Design vs 구현)

### 2.1 발견된 갭

| # | 항목 | Design | 구현 | 상태 | 심각도 |
|---|------|--------|------|:---:|:---:|
| **GAP-1** | `--path` 상대경로 해석 기준 | D-17: "값은 **cwd 기준** 상대(절대경로 허용)로 해석" | (발견 당시) `targets.ts:35` — `path.resolve(repoRoot, raw)` — **repoRoot 기준**으로 해석, 함수가 `cwd`를 받지 않음 | ✅ **수정 완료** — `resolvePathTargets(repoRoot, cwd, rawPaths)`로 시그니처 변경, p5 회귀 테스트 추가 | 🟡 Important → 해소 |
| **GAP-2** | `--path` 배타 조합(D-12) 테스트 커버리지 | Design §5.1: "다른 모드 옵션과 배타" | (발견 당시) 로직은 정확했으나 `parseArgs` 전용 테스트 파일 부재 | ✅ **수정 완료** — `upload.test.ts` 신설, a1~a9(배타 3케이스 포함) | 🟢 Minor → 해소 |
| **GAP-3** | C3 검증 방법론 | Design §8.3 E1: "npm link 후 ... 원본 npm run docs:upload 실행과 동일한 결과" (원본과 pdcaw를 **나란히 실행**해 대조하는 방법을 전제) | 실측 중 최신 태그가 이미 `v0.1.6`이라 원본 스크립트를 실행해도 대상이 0건이 되는 상황이 발견됨(§8.3 실측 3번) → **원본을 실제로 실행하지 않고** 코드 대조(메시지 문자열 동일·필드 매핑 동일)로 대체 | ⚠️ 방법론 대체 | 🟢 Minor |
| **GAP-4** | `resolveProjectId` 자동 해석(FR-8) 경로의 종단 실행 | Design §8.1: "종단 검증 — 실제 dev 서버 대상 실행" | 모든 라이브 테스트에서 `PDCAW_PROJECT_ID` 또는 `--project`가 항상 지정돼 있어, `config.projectId`가 `undefined`로 `resolveProjectId`에 전달되는 경로가 **CLI 자체로는** 한 번도 실행되지 않음(별도 curl로 서버 동작만 확인) | ⚠️ Untested (코드는 원본과 바이트 동일) | 🟢 Minor |

### 2.2 구조 대조 (Design §2.1 모듈 구성도)

| Design 모듈 | 구현 파일 | 상태 |
|-------------|-----------|:---:|
| `cli.ts` | [`src/cli.ts`](../../../../src/cli.ts) | ✅ Match |
| `commands/upload.ts` | [`src/commands/upload.ts`](../../../../src/commands/upload.ts) | ✅ Match |
| `lib/cycle-path.ts` [복사본·무수정] | [`src/lib/cycle-path.ts`](../../../../src/lib/cycle-path.ts) | ✅ Match — 원본과 로직 동일(주석 헤더만 추가) |
| `lib/git-changes.ts` [복사본, pathspec만 변경] | [`src/lib/git-changes.ts`](../../../../src/lib/git-changes.ts) | ✅ Match — `docs/PDCA`→`docs` 2곳만(§2.4①) |
| `lib/workspace-api.ts` [복사본·무수정] | [`src/lib/workspace-api.ts`](../../../../src/lib/workspace-api.ts) | ✅ Match |
| `lib/root.ts` [신규] | [`src/lib/root.ts`](../../../../src/lib/root.ts) | ✅ Match |
| `lib/config.ts` [신규] | [`src/lib/config.ts`](../../../../src/lib/config.ts) | ✅ Match |
| `lib/targets.ts` [신규] | [`src/lib/targets.ts`](../../../../src/lib/targets.ts) | ⚠️ Match, GAP-1 포함 |
| `lib/classify.ts` [신규] | [`src/lib/classify.ts`](../../../../src/lib/classify.ts) | ✅ Match |

**구조 일치율**: 9/9 파일 존재(100%), 그중 1개(targets.ts)가 세부 로직 1건 편차.

### 2.3 의존 방향 대조 (Design §9.2)

Design: `cli → commands → lib`, lib 내부는 `targets → git-changes`·`classify → cycle-path` 둘뿐,
`config`·`root`·`workspace-api`는 잎(leaf).

실제 import 전수 확인 결과 **100% 일치**:
- `cli.ts` → `commands/upload.ts`만 import
- `commands/upload.ts` → `lib/classify`, `lib/config`, `lib/root`, `lib/targets`, `lib/git-changes`(타입만), `lib/workspace-api`
- `lib/targets.ts` → `lib/git-changes.ts`만
- `lib/classify.ts` → `lib/cycle-path.ts`만
- `lib/root.ts`·`lib/config.ts`·`lib/workspace-api.ts`·`lib/cycle-path.ts`·`lib/git-changes.ts` — 상호 import 없음(잎 노드 확인)

### 2.4 API 계약 검증 (소비 API 3종, Design §4)

| # | API | Design 명세 | 구현 | 서버 실측 |
|---|-----|-------------|------|:---:|
| 1 | `document_write` | `{projectId, path, title, kind, pdcaStage?, content}` — pdcaStage는 pdca일 때만 | `upload.ts:244-251` — 스프레드 조건부로 정확히 구현 | ✅ `document_read`로 확인 — general 문서의 `pdcaStage: null` 서버측 확정 |
| 2 | `createCycle` | `{version, name, yearMonth}`, 409(target=version)→성공 취급 | `upload.ts:222-232` — 원본 `workspace-api.ts` 무수정 재사용 | ✅ 라이브 확인 — 생성 1회차 "생성", 2회차 "이미 존재" |
| 3 | `project_list` | projectId 없을 때 자동 해석 | `workspace-api.ts` 무수정 | ⚠️ 서버 동작만 확인(GAP-4), CLI 경로 자체는 미실행 |

**계약 일치율**: 3/3 형태 일치, 2/3 종단 실행 확인, 1/3(project_list 자동 해석) 정적 확인만.

### 2.5 기능 요구사항(FR) 커버리지

| 구간 | 전건 구현 | 라이브/단위 검증 | 비고 |
|------|:---:|:---:|------|
| FR-1~FR-9 (패키징·설정) | 9/9 | 8/9 (FR-8 정적만, GAP-4) | |
| FR-10~FR-17 (대상 선정) | 8/8 | 8/8 (GAP-1 수정 후 전건) | |
| FR-18~FR-24 (업로드) | 7/7 | 7/7 | 전건 라이브 확인, 서버 상태 대조까지 완료 |
| NFR-1~NFR-6 | 6/6 | 6/6 | `dependencies` 키 자체 없음(빈 배열보다 강한 무의존성 표현) |

### 2.6 신규 발견 실측(Design §8.3에 이미 기록된 3건) 재확인

Design v0.2 §8.3의 실측 3건(프로덕션 기본 base-url, dev PAT-프로젝트 불일치, `--path`+`--version`
배타로 인한 E1 대체 실행)을 재확인 — 전부 Design 문서에 정확히 기록되어 있음. 이 분석에서
추가로 발견한 것은 GAP-1~GAP-4뿐이다.

### 2.7 테스트 커버리지

| 파일 | 테스트 | 케이스 수 |
|------|--------|:---:|
| cycle-path.ts | ✅ | 7 (이식) |
| git-changes.ts | ✅ | 8 (이식) |
| workspace-api.ts | ✅ | 4 (이식) |
| config.ts | ✅ | 8 (신규) |
| classify.ts | ✅ | 9 (신규) |
| targets.ts | ✅ | 5 (신규, p5는 GAP-1 회귀 테스트 — cwd≠repoRoot 케이스를 직접 재현) |
| upload.ts(오케스트레이션) | ✅ | 9 (신규, GAP-2 대응 — `parseArgs` 전용 테스트 파일 신설) |
| root.ts | ❌ | 0 — Design §11.1도 애초에 테스트 파일을 계획하지 않음(의도적, 라이브 검증으로 대체) |
| cli.ts | ❌ | 0 — 라이브 실행으로만 확인(`--help` 등) |

**커버리지 요약**: 50개 테스트(수정 전 40 + GAP-1 회귀 1 + GAP-2 대응 9), 8/9 모듈에 전용 테스트
존재. `root.ts`·`cli.ts`만 Design이 처음부터 종단 검증으로 대체하기로 한 부분(§8.1) — 계획대로다.

### 2.8 Match Rate

런타임 검증이 광범위하게 수행됐으므로(Design §8.3) 런타임 포함 공식 적용. **GAP-1·GAP-2 수정
반영 후** 수치:

```
구조적(Structural):  100%  — 9/9 파일, 의존 방향 100% 일치 (무변경)
기능적(Functional):   97%  — GAP-1(구현 오류) 수정 완료, GAP-2(테스트 부재) 수정 완료.
                              GAP-4(자동 해석 경로 미실행, 코드는 원본과 바이트 동일)만 잔존
계약(Contract):      100%  — API 3종 형태 일치, 서버 상태로 2/3 실행 확인 (무변경)
런타임(Runtime):       90%  — GAP-1은 회귀 테스트(p5)로 확정됐으나 실제 CLI를 통한 라이브
                              네트워크 재검증은 하지 않음(단위 테스트로 충분 판단). GAP-4만 미실행

Overall = (100×0.15) + (97×0.25) + (100×0.25) + (90×0.35)
        = 15 + 24.25 + 25 + 31.5
        = 95.75%  ≈ 96%
```

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  100%                │
│  Functional Match Rate:   97%                │
│  Contract Match Rate:    100%                │
│  Runtime Match Rate:      90%                │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:      96%                │
├─────────────────────────────────────────────┤
│  ✅ Match:          FR/D/NFR 46건 중 46건     │
│  ⚠️ Untested(코드는 원본과 동일): 1건 (GAP-4)  │
│  ❌ Not implemented: 0건                      │
└─────────────────────────────────────────────┘
```

GAP-1(Important)은 Checkpoint 5에서 형이 "지금 모두 수정"으로 결정, **처리 완료**(§9.1).

---

## 3. 코드 품질

### 3.1 복잡도

전 함수 20줄 내외, 최대 함수(`upload.ts main()`)도 선형 흐름 — 분기 depth 낮음. 복잡도 문제 없음.

### 3.2 코드 스멜

| 유형 | 파일 | 위치 | 설명 | 심각도 |
|------|------|------|------|:---:|
| 없음 | — | — | 중복 로직·매직넘버·장문 함수 발견되지 않음 | — |

### 3.3 보안

| 심각도 | 파일 | 위치 | 이슈 | 권고 |
|:---:|------|------|------|------|
| 🟢 | — | — | PAT 경로(D-9)·비로깅(FR-24)·`.gitignore` 차단 전부 확인됨. 신규 이슈 없음 | — |

---

## 4. (해당 없음)

이 프로젝트는 서버·UI가 없는 CLI라 성능(응답시간)·UI 분석 섹션은 생략한다.

---

## 5. 테스트 커버리지

§2.7 참조. `npm test` 기준 정량 커버리지 리포트(statements/branches %)는 별도 설정(`c8` 등)이
없어 도구로 수치화하지 않았다 — 케이스 수 기준으로 §2.7에 정리.

---

## 6. Clean Architecture 준수

> 참조: Design §9

### 6.1 계층 의존 검증

| 계층 | 기대 의존 | 실제 의존 | 상태 |
|------|-----------|-----------|:---:|
| Presentation | Application, Domain | `cli.ts`→`commands/upload.ts`만 | ✅ |
| Application | Domain, Infrastructure | `upload.ts`→`classify`(Domain)·`targets`(Infra 혼재)·`config`·`root`·`workspace-api`(Infra) | ✅ |
| Domain(순수) | 외부 의존 없음 | `cycle-path.ts`(무의존)·`classify.ts`(cycle-path만) | ✅ |
| Infrastructure | Domain만 | `git-changes.ts`(무의존, node builtin만)·`workspace-api.ts`(무의존)·`root.ts`(무의존) | ✅ |

§2.3에서 확인한 대로 100% 일치.

### 6.2 의존 위반

없음.

### 6.3 계층 배치 검증

| 컴포넌트 | 설계 계층 | 실제 위치 | 상태 |
|----------|-----------|-----------|:---:|
| cli.ts | Presentation | `src/cli.ts` | ✅ |
| upload.ts | Application(thin) | `src/commands/upload.ts` | ✅ |
| classify.ts | Domain | `src/lib/classify.ts` | ✅ |
| cycle-path.ts | Domain | `src/lib/cycle-path.ts` | ✅ |
| root.ts/workspace-api.ts/git-changes.ts(I/O부) | Infrastructure | `src/lib/*.ts` | ✅ |

### 6.4 아키텍처 점수

```
┌─────────────────────────────────────────────┐
│  Architecture Compliance: 100%               │
├─────────────────────────────────────────────┤
│  ✅ 올바른 계층 배치: 9/9 파일                │
│  ⚠️ 의존 위반:        0 파일                  │
│  ❌ 잘못된 계층:      0 파일                  │
└─────────────────────────────────────────────┘
```

---

## 7. 컨벤션 준수

### 7.1 네이밍

| 대상 | 규칙 | 검사 대상 | 준수 | 위반 |
|------|------|:---:|:---:|------|
| 파일명(lib) | kebab-case | 9 | 100% | — (원본 `cyclePath.ts`→`cycle-path.ts` 의도적 변경, Plan 지시) |
| 함수 | camelCase | 전수 | 100% | — |
| 타입 | PascalCase | 전수 | 100% | — |

### 7.2 폴더 구조

| 경로 | 존재 | 내용 정합 |
|------|:---:|:---:|
| `src/cli.ts` | ✅ | ✅ |
| `src/commands/` | ✅ | ✅ |
| `src/lib/` | ✅ | ✅ |

### 7.3 주석 규약 (Design §10, Plan §8.2)

- [x] 이식 파일에 원본 주석(`Design Ref:`/`Plan SC:`/`FR-`/`D-`) 보존 — cycle-path.ts·git-changes.ts·workspace-api.ts 확인
- [x] 이식 파일 헤더에 원본 위치 명시 — 전 이식 파일 첫 줄에 `// 원본: PDCA-workspace ...`
- [x] 신규 파일은 `Design Ref: §N` 형식으로 이 Design 문서 참조

### 7.4 환경변수

| 변수 | 컨벤션 | 실제 | 상태 |
|------|--------|------|:---:|
| `PDCAW_PAT` | Design §8.3 | 동일 | ✅ |
| `PDCAW_PROJECT_ID` | Design §8.3 | 동일 | ✅ |
| `PDCAW_BASE_URL` | Design §8.3 | 동일 | ✅ |

### 7.5 컨벤션 점수

```
┌─────────────────────────────────────────────┐
│  Convention Compliance: 100%                 │
├─────────────────────────────────────────────┤
│  네이밍:        100%                         │
│  폴더 구조:      100%                         │
│  주석 규약:      100%                         │
│  환경변수:       100%                         │
└─────────────────────────────────────────────┘
```

---

## 8. 종합 점수

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 96/100                  │
├─────────────────────────────────────────────┤
│  Design Match:           97점 (GAP-4만 잔존) │
│  코드 품질:              100점               │
│  보안:                  100점               │
│  테스트:                 100점 (50/50 green) │
│  Clean Architecture:    100점               │
│  컨벤션:                100점               │
└─────────────────────────────────────────────┘
```

---

## 9. 권고 조치

### 9.1 즉시 (Checkpoint 5 — 형 "지금 모두 수정" 결정, 처리 완료)

| 우선순위 | 항목 | 파일 | 상태 |
|:---:|------|------|:---:|
| 🟡 Important | **GAP-1 수정** — `resolvePathTargets`/`resolveTargets`에 `cwd` 파라미터 추가, 상대경로를 `cwd` 기준으로 해석 후 `repoRoot` 상대로 정규화(Design D-17) | `src/lib/targets.ts`, 호출부 `src/commands/upload.ts` | ✅ **완료** — p5 회귀 테스트 추가(cwd≠repoRoot 시나리오 직접 재현), 50/50 green |
| 🟢 Minor | GAP-2 — `parseArgs`의 배타 에러 경로에 단위 테스트 추가 | `src/commands/upload.test.ts`(신규) | ✅ **완료** — a1~a9 9케이스(D-12 배타 3케이스 포함) |

### 9.2 이월 (다음 필요 시점까지 보류)

| 우선순위 | 항목 | 사유 |
|:---:|------|------|
| 🟢 Minor | GAP-4 — `resolveProjectId` 자동 해석 경로를 CLI로 1회 라이브 실행(PDCAW_PROJECT_ID 미설정 상태) | 코드가 원본과 바이트 동일이라 위험 낮음. 실제 project_list 자동 해석이 필요한 신규 레포 온보딩 시점에 자연히 검증됨 |

### 9.3 장기 (백로그)

| 항목 | 비고 |
|------|------|
| GAP-3류 방법론 이슈 — "원본과 나란히 실행해 diff"가 불가능해지는 상황(태그가 이미 최신) 자체를 Design이 전제로 깔지 않기 | 다음 사이클에서 원본 도구가 아직 살아있는 동안 미리 겪은 문제 — 원본 제거 사이클(Plan §2.2 이월)에서는 이 비교 자체가 불가능해지므로, 그 전에 한 번은 "진짜 나란히 실행" 검증을 해두는 게 안전 |

---

## 10. Design 문서 갱신 필요 사항

- [ ] 없음 — Design 자체는 정확하다(D-17이 옳음). **구현이 Design을 못 따라간 것**이므로
      코드를 고쳐야지 문서를 고칠 일이 아니다.

---

## 11. Next Steps

- [x] **Checkpoint 5** — 형 "지금 모두 수정" 결정 (2026-08-09)
- [x] GAP-1·GAP-2 수정, 회귀 테스트 추가, 50/50 green 재확인
- [ ] `/pdca report` — Match Rate 96%로 report 진행 가능

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.2 | 2026-08-09 | **Checkpoint 5 처리 완료.** 형 결정("지금 모두 수정")에 따라 GAP-1(Important)·GAP-2(Minor)
수정. GAP-1: `resolvePathTargets`/`resolveTargets`에 `cwd` 파라미터 추가, `upload.ts` 호출부
갱신, `targets.test.ts` p5로 cwd≠repoRoot 시나리오 회귀 테스트 추가. GAP-2: `upload.test.ts`
신설(a1~a9, D-12 배타 조합 3케이스 포함). 재빌드·재테스트 50/50 green, lint 0 warning.
Match Rate 94%→**96%**로 갱신(Functional 91→97, Runtime 88→90). GAP-3(방법론)·GAP-4(미실행이나
원본과 바이트 동일 코드)는 이월 유지 — Important 이상 없음 | Claude |
| 0.1 | 2026-08-09 | 최초 작성. Design v0.2·Plan v0.4 대비 구현 전수 코드 대조. **GAP-1**(Important) — `--path` 상대경로 해석이 Design D-17(cwd 기준)과 다르게 repoRoot 기준으로 구현됨, 원인은 `resolvePathTargets` 함수가 cwd를 아예 받지 않는 시그니처. 라이브 테스트가 전부 레포 루트에서 실행돼 cwd===repoRoot였던 우연으로 지금까지 드러나지 않음. 그 외 GAP-2~GAP-4(Minor, 코드는 정확하나 미검증 경로)도 함께 기록. 구조·계약·아키텍처·컨벤션은 전부 100% 일치. Overall Match Rate 94% | Claude |
