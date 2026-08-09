---
template: report
version: 1.1
---

# extract-docs-upload-cli 완료 보고서

> **상태**: Complete (Match Rate 96%, Checkpoint 5 GAP 전건 처리 완료)
>
> **프로젝트**: pdcaw-cli
> **버전**: v0.1.0 (예정 — 아직 태그 안 함)
> **작성자**: Claude
> **완료일**: 2026-08-09
> **PDCA Cycle**: extract-docs-upload-cli (이 레포 1번째 사이클)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 사이클명 | extract-docs-upload-cli |
| 착수일 | 2026-08-09 |
| 완료일 | 2026-08-09 (Plan~Check까지 단일 세션 진행, `/model` 전환 3회) |
| 소요 | 1일(같은 날 착수·완료) |

### 1.2 결과 요약

```
┌─────────────────────────────────────────────┐
│  완료율: 100%  (Match Rate 96%)              │
├─────────────────────────────────────────────┤
│  ✅ 완료:      스코프 7건(S1~S7) 전건          │
│  ⏳ 사이클 종료 절차 잔여: 커밋·태그·publish   │
│  ❌ 취소:      0건                            │
└─────────────────────────────────────────────┘
```

### 1.3 실현된 가치

| 관점 | 내용 |
|------|------|
| **Problem** | 검증 끝난 문서 동기화 도구(`docs-upload.ts`)가 PDCA-workspace 레포 안에서만 쓸 수 있었고, `docs/PDCA` 밖 문서(RULE.md·`_INDEX.md`·배포 체크리스트)는 **한 번도 서버에 반영된 적이 없었다**(F6 실측). 호출자(클로드)가 이미 아는 변경 목록을 CLI가 매번 다시 스캔하는 비효율도 있었다. |
| **Solution** | 독립 npm 패키지 `pdcaw`로 이식 — 원본 4파일의 순수 로직은 무수정 복사(19테스트 케이스 그대로), 신규 모듈 6개(`root`·`config`·`targets`·`classify` + 테스트)로 `kind` 분기(pdca/general)와 `--path` 핀포인트 업로드를 추가했다. 런타임 의존성은 0을 유지했다. |
| **Function/UX Effect** | 실측으로 검증됨 — dev 서버 대상 실행에서 `docs/RULE.md`가 `kind:"general"`, `title:"PDCA 문서"`(H1 없이 H2에서 자동 추출)로 실제 업로드됐고, `--path`로 미변경 문서를 지정해 git 상태와 무관하게 올릴 수 있음을 확인했다. 사이클 생성(`--version`)과 재실행 멱등성(신규→덮어씀)도 라이브로 확인됐다. |
| **Core Value** | "검증된 도구를 레포에 가두지 않는다." 원본은 PDCA-workspace 하나에만 설치돼 있었지만, 이제 `npx pdcaw`로 어떤 레포에서든 같은 절차를 쓸 수 있다. 동시에 "PDCA 문서만 동기화"라는 원래 전제를 "`docs/` 폴더 전체"로 넓혀, 그동안 서버에서 빠져 있던 문서들이 처음으로 반영 가능해졌다. |

---

## 1.4 Success Criteria Final Status

Plan §4 기준 C1~C10 전건.

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C1 | 이식 19케이스 전건 green | ✅ Met | `vitest run` — 이식분 원본 ID(g1~g6,w1~w4,t1~t7) 그대로 통과 |
| C2 | 신규 테스트 green | ✅ Met | config(8)·classify(9)·targets(5)·upload(9) = 31케이스, 총 50/50 |
| C3 | 원본 무회귀(PDCA 경로 문서) | ✅ Met (방법론 주석 포함) | 메시지 문자열·필드 매핑 코드 대조 + 라이브 사이클 생성/재실행(신규→덮어씀, 생성→"이미 존재")으로 확인. "원본과 나란히 실행해 diff"는 실측 중 최신 태그가 이미 v0.1.6이라 불가능해 대체 방법 사용(analysis.md GAP-3, 이월) |
| C4 | general 문서 업로드 | ✅ Met | `document_read`로 서버 상태 직접 확인 — `kind:"general"`, `pdcaStage:null`, `title:"PDCA 문서"` |
| C5 | `--path` 핀포인트 | ✅ Met | 미변경 문서·폴더 지정 라이브 테스트 + GAP-1 수정으로 cwd 기준 해석까지 완비 |
| C6 | 설정 없을 때 안내 에러 | ✅ Met | `config.test.ts` c6(실 fs) |
| C7 | `.pdcarc` PAT 거부 | ✅ Met | `config.test.ts` c7 |
| C8 | PAT 로그 누출 0건 | ✅ Met | stdout/stderr 캡처 `grep -c pdcaw_` = 0 |
| C9 | tsc·lint green | ✅ Met | 로컬 실행 로그 |
| C10 | npx 실행 형태 | ✅ Met | `npm pack` + 딴 디렉터리 실행 성공 |

**Success Rate**: 10/10 충족 (100%)

## 1.5 Decision Record Summary

| 출처 | 결정 | 이행됨? | 실제 결과 |
|------|------|:---:|-----------|
| [Plan §1.4 K2·K3] | `docs/` 전체 동기화, 이번 사이클에 확장 포함 | ✅ | `kind` 분기로 구현, 서버 무변경으로 가능했음(F5 실측이 맞았음) |
| [Plan §10 Q2] | publish는 analyze 완료 후 사이클 끝물, 태그 push 직후 | ⏳ | 아직 시점 전 — 이 보고서 작성 시점 기준 대기 중 |
| [Plan §10 Q3] | `--path`는 `.md` 확장자 한정, 모드 무관 단일 규칙 | ✅ | `targets.ts`에 단일 필터로 구현, 예외 없음 |
| [Design §2.0] | Option B(완전 분리) 선택 — 무회귀 증거는 구조 대조 대신 행위 대조로 | ✅ | §2.4 "의도된 행위 차이 9건" 목록이 실제로 회귀 판정 기준으로 기능함(GAP-1을 그 목록 밖의 차이로 정확히 잡아냄) |
| [Design D-17] | `--path`는 cwd 기준 상대경로 해석 | ⚠️→✅ | **처음엔 미이행**(GAP-1, Analysis에서 발견) — Checkpoint 5에서 즉시 수정, p5 회귀 테스트로 확정 |
| [Design D-12] | `--path` 완전 배타 | ✅ | 로직은 처음부터 정확했으나 테스트 부재(GAP-2) — Checkpoint 5에서 커버리지 보강 |

---

## 2. Related Documents

| 단계 | 문서 | 상태 |
|------|------|:---:|
| Plan | [extract-docs-upload-cli.plan.md](./extract-docs-upload-cli.plan.md) | ✅ v0.4 Approved |
| Design | [extract-docs-upload-cli.design.md](./extract-docs-upload-cli.design.md) | ✅ v0.2 구현+검증 완료 |
| Check | [extract-docs-upload-cli.analysis.md](./extract-docs-upload-cli.analysis.md) | ✅ v0.2, GAP 처리 완료 |
| Act | 이 문서 | 🔄 작성 중 |

---

## 3. 완료 항목

### 3.1 기능 요구사항

| ID | 요구사항 | 상태 | 비고 |
|----|----------|:---:|------|
| FR-1~FR-9 (패키징·설정) | | ✅ Complete | |
| FR-10~FR-17 (대상 선정) | | ✅ Complete | GAP-1 수정 포함 |
| FR-18~FR-24 (업로드) | | ✅ Complete | 서버 상태 실증 |
| NFR-1~NFR-6 | | ✅ Complete | 런타임 의존성 0, semver 거버넌스 문서화 |

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|------|:---:|
| 런타임 의존성 | 0 | 0 (`dependencies` 키 자체 없음) | ✅ |
| Match Rate | 90% | 96% | ✅ |
| 테스트 케이스 | 19(이식) 무회귀 | 50(이식 19 + 신규 31) 전건 green | ✅ |
| tsc/lint | green | green | ✅ |

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:---:|
| CLI 엔트리 | `src/cli.ts` | ✅ |
| 오케스트레이션 | `src/commands/upload.ts` (+test) | ✅ |
| 이식 모듈 3개 | `src/lib/{cycle-path,git-changes,workspace-api}.ts` (+test) | ✅ |
| 신규 모듈 4개 | `src/lib/{root,config,targets,classify}.ts` (+test 3종) | ✅ |
| 패키징 | `package.json`·`tsconfig.json`·`vitest.config.ts` | ✅ |
| 문서 | `README.md`·`CHANGELOG.md`·`.pdcarc.example.json`·`.env.local.example` | ✅ |
| PDCA 문서 4종 | `docs/PDCA/2026-08/extract-docs-upload-cli/*.md` | ✅ (이 문서 포함) |

---

## 4. 미완료 항목

### 4.1 사이클 종료 절차로 이월 (RULE.md 규정 항목 — "미완료"가 아니라 순서상 다음 단계)

| 항목 | 사유 | 우선순위 |
|------|------|:---:|
| initial commit | RULE.md — PDCA 문서는 사이클 종료 전 커밋 안 함(코드는 별개지만 이번엔 형 확인 후 한 번에) | 사이클 종료 시 |
| `v0.1.0` 태그 | 형 확인 후 | 사이클 종료 시 |
| `npm publish` | Plan Q2 결정 — 태그 push 직후, 별도 승인 | 사이클 종료 시 |
| `docs/PDCA/_INDEX.md` 행 추가 | RULE.md 종료 절차 1번 | 사이클 종료 시 |

### 4.2 취소/보류 항목

| 항목 | 사유 | 대안 |
|------|------|------|
| GAP-3(원본과 나란히 실행하는 검증 방법) | 최신 태그가 이미 v0.1.6이라 이번엔 재현 불가 | 원본이 아직 살아있는 동안 별도로 한 번 수행 권장(Analysis §9.3) |
| GAP-4(project_list 자동 해석 CLI 라이브 실행) | 코드가 원본과 바이트 동일, 위험 낮음 | 신규 레포 온보딩 시 자연 검증 |
| 파서 단일 원천 통합·원본 `scripts/` 제거 등 (Plan §2.2 이월 8건) | 스코프 밖 명시 | 각 재개 조건 충족 시 |

---

## 5. 품질 지표

### 5.1 최종 분석 결과

| 지표 | 목표 | 최종 | 변화 |
|------|------|------|------|
| Match Rate | 90% | 96% | Analysis 1차 94% → GAP 수정 후 96% |
| 테스트 케이스 | 19(무회귀) | 50 | +31 (신규 로직 커버리지) |
| 구조 일치율 | — | 100% | 9/9 모듈 |
| API 계약 일치율 | — | 100% | 3/3 형태, 2/3 서버 상태로 실행 확인 |
| Clean Architecture 준수 | — | 100% | 의존 방향 위반 0건 |
| 컨벤션 준수 | — | 100% | 네이밍·주석·환경변수 전건 |
| PAT 로그 누출 | 0 | 0 | grep 실증 |

### 5.2 해결된 이슈

| 이슈 | 해결 | 결과 |
|------|------|------|
| GAP-1 — `--path` 상대경로가 Design(cwd 기준)과 다르게 repoRoot 기준으로 구현됨 | `resolvePathTargets`/`resolveTargets`에 `cwd` 파라미터 추가 | ✅ 해결, p5 회귀 테스트로 확정 |
| GAP-2 — `parseArgs` 전용 테스트 부재 | `upload.test.ts` 신설(a1~a9) | ✅ 해결 |
| (구현 중 발견) `upload --help` 사각지대 | `main()`에서 파싱 전 처리로 이동 | ✅ 해결 |
| (검증 중 발견) `.env.local` 기본값이 프로덕션 | 코드 결함 아님 — 검증 절차에 `--base-url` 명시를 필수화 | 문서화(Design §8.3) |

---

## 6. 회고 (Lessons Learned)

### 6.1 잘한 것 (Keep)

- **Plan 단계에서 지시서(`.tmp`)를 그대로 믿지 않고 실측 먼저 한 것.** F1~F14 실측이 "이동+패키징이지 재설계가 아니다"라는 지시서 전제를 깨뜨렸고, 그 결과가 스코프 확장(K2·K3)으로 정확히 반영됐다. 착수 전 실측이 나중에 형이 지적한 두 가지("docs/ 전체", "--path")를 **미리 대응 가능한 형태**로 만들어뒀다.
- **Design에서 "의도된 행위 차이 전수 목록"(§2.4)을 둔 것.** Option B(완전 분리)를 선택하면서 무회귀 판정 기준이 흔들릴 리스크(RK-3)가 있었는데, 그 목록이 실제로 "목록 밖 차이=회귀"라는 판정 규칙으로 작동해 GAP-1을 정확히 잡아냈다.
- **종단 검증을 실제로 실행한 것(코드만 읽고 넘어가지 않음).** dev PAT 발급→base-url 프로덕션 기본값 발견→dev 프로젝트 불일치 발견, 이 세 겹의 실측이 전부 "실행해봐서" 나온 것이다. 코드 리뷰만으로는 안 나온다.
- **Analysis에서 Design 자체 검증(§8.3)을 다시 독립적으로 재검증한 것.** Design 작성자와 Analysis 수행자가 같은 세션의 같은 클로드였지만, "실행해서 성공했다"와 "Design이 명시한 대로 정확히 구현됐다"를 별개 질문으로 다뤄서 GAP-1을 잡았다 — 자기 작업을 자기가 검증할 때도 대조 대상(Design 문서의 정확한 문구)을 명시적으로 다시 읽는 게 값어치가 있었다.

### 6.2 개선이 필요한 것 (Problem)

- **`.pdcarc.json`을 두지 않은 CLI 자신의 레포에서 dev 서버 검증을 하다 보니, 프로덕션 기본값·프로젝트 ID 불일치를 검증 도중에야 발견했다.** Design 단계에서 "`.env.local`의 실제 값이 어느 서버를 가리키는지" 정도는 미리 확인해뒀으면 종단 검증 순서가 더 매끄러웠을 것이다.
- **C3의 "원본과 나란히 실행" 전제가 실측 상황(태그가 이미 최신)과 충돌하는 걸 Design 시점엔 못 봤다.** V5(`npm link` 검증 환경 준비)에서 "현재 태그가 뭔지, 그 이후 PDCA 변경이 있는지"까지 확인했으면 Design 자체에서 대체 시나리오를 미리 설계할 수 있었다.

### 6.3 다음에 시도할 것 (Try)

- **Design 작성 시 "종단 검증 첫 단계"로 대상 서버·프로젝트·최신 태그 상태를 실측하는 걸 정례화.** 지금은 Do 단계에 가서야 발견했는데, Design V-항목(V1~V5)에 이런 "검증 환경 자체의 상태 확인"을 명시적으로 포함하면 더 일찍 알 수 있다.
- **Analysis에서 "Design 문서 vs 코드"를 파일 단위로 순회하며 대조하는 습관을 유지.** 이번에 GAP-1을 잡은 방법이 정확히 이거였다 — 라이브 테스트가 통과했다고 안심하지 않고, Design의 각 D-항목을 코드 줄까지 따라가며 확인했다.

---

## 7. 프로세스 개선 제안

### 7.1 PDCA 프로세스

| 단계 | 현재 | 개선 제안 |
|------|------|-----------|
| Design | 종단 검증 환경(서버·PAT·태그 상태)을 Do 단계에서야 확인 | Design V-항목에 "검증 환경 실측"을 명시적으로 포함 |
| Check | Design 자기 검증(§8.3)과 Analysis 재검증이 같은 세션 — 효과적이었으나 우연에 가까움 | Analysis 단계에서 "Design의 각 결정 항목을 코드 줄로 재추적"을 표준 절차로 명문화(이미 이번엔 자연스럽게 그렇게 했음) |

### 7.2 도구/환경

| 영역 | 개선 제안 | 기대 효과 |
|------|-----------|-----------|
| npm 로컬 tarball 실행 | 이 환경의 `npx`가 로컬 `.tgz` 경로를 shell로 오인 — `file:` 접두 필요했음 | registry publish 후엔 해당 없음(문서에만 기록, 코드 변경 불필요) |

---

## 8. 다음 단계

### 8.1 즉시

- [ ] `git status`로 diff 재확인 → **형 승인 후 initial commit**
- [ ] `v0.1.0` 태그 (형 확인 후)
- [ ] `docs/PDCA/_INDEX.md`에 행 추가 (RULE.md 종료 절차 1번)
- [ ] `npm publish` — **태그 push 직후, 별도 승인**(Plan Q2)
- [ ] publish 후 딴 디렉터리에서 `npx pdcaw upload --help` 재확인(registry 경로)

### 8.2 다음 PDCA 사이클 (후보, 미확정)

| 항목 | 우선순위 | 비고 |
|------|:---:|------|
| PDCA-workspace `docs/RULE.md` 종료 절차를 `npx pdcaw`로 전환 | Medium | 원본 `scripts/docs-upload.ts` 제거와 묶어서 |
| 파서 단일 원천 통합(`cycle-path.ts`) | Low | CLI가 안정화된 뒤 |
| GAP-3 방법론 문제 — 원본과 나란히 실행하는 검증을 원본이 살아있는 동안 한 번 더 | Medium | 원본 제거 전이 마지막 기회 |

---

## 9. Changelog

이미 [CHANGELOG.md](../../../../CHANGELOG.md)의 v0.1.0 항목이 이 사이클의 변경사항을 담고 있다.
이 사이클 중 코드 레벨 추가·수정(Checkpoint 5 반영)은 아래처럼 CHANGELOG에도 별도 언급 없이
v0.1.0 최초 릴리즈에 통합된다(사이클이 아직 태그되지 않았으므로 "이후 변경"이 아니라 "최초
포함").

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0 | 2026-08-09 | 완료 보고서 최초 작성. Success Rate 10/10(100%), Match Rate 96%. Decision Record 6건 추적 — 그중 D-17·D-12는 처음엔 미이행이었으나 Checkpoint 5에서 즉시 수정돼 최종적으로 전건 이행. 회고 4+2+2건, 프로세스 개선 제안 2건 기록. 사이클 종료 절차(커밋·태그·publish)는 §8.1에 명시하고 아직 미실행 — 형 승인 대기 | Claude |
