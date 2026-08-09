---
template: report
version: 1.1
---

# harden-cli-contract 완료 보고서

> **상태**: Complete (Match Rate 100%, Checkpoint 5 갭 전건 처리 완료)
>
> **프로젝트**: pdcaw
> **버전**: v0.2.0 (예정 — 아직 태그 안 함)
> **작성자**: Claude
> **완료일**: 2026-08-09
> **PDCA Cycle**: harden-cli-contract (이 레포 2번째 사이클)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 사이클명 | harden-cli-contract |
| 착수일 | 2026-08-09 |
| 완료일 | 2026-08-09 (Plan~Check까지 단일 세션 진행) |
| 소요 | 1일(같은 날 착수·완료) |

### 1.2 결과 요약

```
┌─────────────────────────────────────────────┐
│  완료율: 100%  (Match Rate 100%)             │
├─────────────────────────────────────────────┤
│  ✅ 완료:      스코프 7건(FR-01~07) 전건       │
│  ⏳ 사이클 종료 절차 잔여: 커밋·태그·publish   │
│  ❌ 취소:      0건                            │
└─────────────────────────────────────────────┘
```

### 1.3 Value Delivered

| Perspective | Content |
|-------------|---------|
| **Problem** | `pdcaw`가 npm에 배포됐는데도 `DEFAULT_BASE_URL`이 형 소유 프로덕션 서버로 하드코딩돼 있어, 무설정 설치만으로도 형의 서버로 요청이 갈 수 있는 상태였다 — 사용자 범위가 "형만"에서 "누구나"로 넓어진 변화를 코드가 반영하지 못했다. |
| **Solution** | `DEFAULT_BASE_URL` 완전 제거. `mergeConfig`는 이제 `baseUrl: string \| undefined`를 순수하게 반환하고, `resolveConfig`가 `pat`·`baseUrl` 중 누락된 필드를 배열로 모아 `buildMissingConfigMessage()`(Option B, 완전분리 설계)로 한 번에 안내한 뒤 `ConfigError`를 던진다. README·예시 파일에서 형의 실제 서버 URL을 전부 제거하고 self-hosted 전용임을 명시했다. |
| **Function/UX Effect** | 설정 없이 실행하면 이제 프로덕션으로 조용히 요청이 가는 대신 즉시 설정 가이드 에러를 받는다. PAT·baseUrl이 동시에 없을 때도 두 가이드를 한 번에 받아 왕복 없이 바로 고칠 수 있다(단위 테스트 8케이스로 조합 전건 검증). |
| **Core Value** | 배포된 npm 패키지의 실제 동작(self-hosted 서버 종속)과 사용자가 코드·문서에서 받는 신호가 완전히 일치하게 됐다 — 오배포·오사용 가능성을 코드 레벨에서 원천 차단. |

---

## 1.4 Success Criteria Final Status

> Plan §4.1 Definition of Done 기준.

| # | Criteria | Status | Evidence |
|---|---------|:------:|----------|
| SC-1 | `baseUrl` 미설정 시 `ConfigError` 발생 확인 | ✅ Met | `config.test.ts` c6·c8·c8b, `npm test` 56/56 |
| SC-2 | PAT+baseUrl 조합별 에러 메시지 확인 | ✅ Met | m1~m3(순수), c6~c9·c8b(I/O) — 8개 시나리오 전부 1:1 대응 |
| SC-3 | README "defaults to prod" 문구 제거 확인 | ✅ Met | `grep -n "defaults to prod" README.md` → 결과 없음 |
| SC-4 | 예시 파일에 실제 프로덕션 URL 미노출 | ✅ Met | `grep -rn "vercel.app"` → 결과 없음 |
| SC-5 | 전체 테스트 그린 (`npm test`) | ✅ Met | 56/56 passed |
| SC-6 | CHANGELOG v0.2.0 + package.json version bump | ✅ Met | `package.json`/`package-lock.json`/`CHANGELOG.md` 전부 0.2.0 동기화 |

**Success Rate**: 6/6 criteria met (100%)

## 1.5 Decision Record Summary

| Source | Decision | Followed? | Outcome |
|--------|----------|:---------:|---------|
| [Plan] | `baseUrl` 기본값 제거, PAT와 동일하게 필수 처리 | ✅ | 그대로 구현 — `mergeConfig`가 undefined 반환, `resolveConfig`가 에러로 차단 |
| [Plan] | 버전은 v0.2.0(형 결정, RULE.md의 "breaking=major" 원칙과 별개로 0.x 관례 적용) | ✅ | `package.json`/lockfile/CHANGELOG 전부 0.2.0으로 반영 |
| [Design] | Option B(완전분리) — 누락 필드 배열로 모아 `buildMissingConfigMessage()`로 한 번에 안내 | ✅ | 설계 시그니처 그대로 구현, 단위 테스트로 8케이스 검증 |
| [Design] | README는 전체 재작성이 아닌 기존 구조 유지 + 모순 문구 정정 | ✅ | Setup 섹션 표·본문만 수정, 최상단에 self-hosted 경고 blockquote 신설 |
| [Do 이후 후속] | README 경고에 PDCA-workspace 레포 링크 추가(형 요청) | ✅ | `https://github.com/SpiritFlag/PDCA-workspace` 링크 반영 |

---

## 2. Related Documents

| Phase | Document | Status |
|-------|----------|--------|
| Plan | [harden-cli-contract.plan.md](./harden-cli-contract.plan.md) | ✅ Finalized |
| Design | [harden-cli-contract.design.md](./harden-cli-contract.design.md) | ✅ Finalized |
| Check | [harden-cli-contract.analysis.md](./harden-cli-contract.analysis.md) | ✅ Complete (100%) |
| Report | 현재 문서 | ✅ Complete |

---

## 3. Completed Items

### 3.1 Functional Requirements (Plan §3.1)

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| FR-01 | `DEFAULT_BASE_URL` 제거, 미설정 시 `ConfigError` | ✅ Complete | |
| FR-02 | 에러 가이드 문구에 baseUrl 안내 반영 | ✅ Complete | Design Option B로 확장 구현(단순 문구 추가를 넘어 합성 함수화) |
| FR-03 | PAT+baseUrl 둘 다 없을 때 한 번에 안내 | ✅ Complete | `buildMissingConfigMessage` |
| FR-04 | README "optional, defaults to prod" 제거 | ✅ Complete | |
| FR-05 | README self-hosted 경고 추가 | ✅ Complete | 후속으로 PDCA-workspace 링크까지 반영 |
| FR-06 | 예시 파일 프로덕션 URL 플레이스홀더 교체 | ✅ Complete | `.pdcarc.example.json`, `.env.local.example` |
| FR-07 | `config.test.ts` "기본값(prod)" 테스트 교체 | ✅ Complete | c4 교체 + 신규 8케이스(m1~m3, c6~c9, c8b) 추가 |

### 3.2 Non-Functional Requirements (Plan §3.2)

| Item | Target | Achieved | Status |
|------|--------|----------|--------|
| 에러 처리 일관성 | 기존 PAT 패턴과 동일 톤 | `FIELD_GUIDE.baseUrl`이 `FIELD_GUIDE.pat`와 동일 스타일 | ✅ |
| 하위 호환성 | 기존 설정 사용자는 동작 무변화 | c1~c3, c7 회귀 테스트 통과 | ✅ |
| 문서 정합성 | "기본값은 prod" 류 모순 서술 0건 | grep 확인 | ✅ |

### 3.3 Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| 설정 해석 로직 | `src/lib/config.ts` | ✅ |
| 단위 테스트 | `src/lib/config.test.ts` (56 테스트) | ✅ |
| 사용자 문서 | `README.md` | ✅ |
| 예시 설정 파일 | `.pdcarc.example.json`, `.env.local.example` | ✅ |
| 변경 이력 | `CHANGELOG.md` (v0.2.0) | ✅ |
| 버전 메타 | `package.json`, `package-lock.json` (0.2.0) | ✅ |

---

## 4. Incomplete Items

### 4.1 Carried Over to Next Cycle

없음 — Plan에 정의된 스코프(FR-01~07) 전건 완료, Backlog로 이월된 항목 없음(Check 단계 GAP-1도 Checkpoint 5에서 즉시 해소).

### 4.2 Cancelled/On Hold Items

| Item | Reason | Alternative |
|------|--------|-------------|
| - | - | - |

---

## 5. Quality Metrics

### 5.1 Final Analysis Results

| Metric | Target | Final | Change |
|--------|--------|-------|--------|
| Match Rate (정적) | 90% | 100% | +10%p |
| 테스트 수 | 회귀 없음 | 56/56 (기존 50 + 신규 6) | +6 |
| Lint 에러 | 0 | 0 | ✅ |
| Build | 성공 | 성공 (`tsc`) | ✅ |
| Security Issues | 0 Critical | 0 | ✅ |

### 5.2 Resolved Issues

| Issue | Resolution | Result |
|-------|------------|--------|
| `DEFAULT_BASE_URL` 프로덕션 하드코딩 | 완전 제거, 필수 설정으로 전환 | ✅ Resolved |
| README "defaults to prod" 모순 서술 | 문구 정정 + self-hosted 경고 추가 | ✅ Resolved |
| GAP-1 (Check 발견) — Design §8.2 항목 7 테스트 누락 | `c8b` 추가 | ✅ Resolved (Checkpoint 5 중) |
| GAP-2 (Check 발견) — package-lock.json 버전 미동기화 | `npm install --package-lock-only` | ✅ Resolved (Check 중) |

---

## 6. Lessons Learned & Retrospective

### 6.1 What Went Well (Keep)

- **Plan 단계에서 AskUserQuestion으로 에러 처리 구조(A/B/C)와 README 처리 범위를 미리 확정**해둔 덕에, Do 단계 구현이 왕복 질문 없이 한 번에 끝났다.
- **Design §8.2에 단위 테스트 시나리오를 표로 미리 못박아둔 것**이 Check 단계에서 "설계 대비 테스트 커버리지 1:1 대조"를 가능하게 했다 — GAP-1을 코드 리뷰가 아니라 표 대조만으로 정확히 짚어냈다.
- **소규모 구조적 변경에도 PDCA를 생략하지 않고 정식으로 돌린 것**이 유효했다 — RULE.md 기준 "CLI 인자/설정 스키마 breaking change"였고, 실제로 Plan 단계 질문에서 semver 정책(v0.2.0)까지 그 자리에서 결정났다.

### 6.2 What Needs Improvement (Problem)

- Do 단계에서 `package.json` version만 수동으로 바꾸고 `package-lock.json` 재생성을 빠뜨렸다(GAP-2) — 버전 bump가 두 파일에 걸쳐 있다는 걸 Design 단계 체크리스트에 명시하지 않았던 게 원인.
- Design §8.2의 테스트 시나리오 번호와 실제 구현 테스트 이름이 처음엔 1:1로 안 맞았다(GAP-1) — 구현 중 "대칭이니 됐다"고 넘어간 판단이 Check에서야 걸러졌다.

### 6.3 What to Try Next (Try)

- 버전 bump가 필요한 사이클은 Design §11.2 Implementation Order에 "`package.json` + `package-lock.json` 동시 반영" 처럼 두 파일을 한 항목으로 묶어 명시하기.
- Design에 시나리오 표를 쓸 때, Do 단계에서 테스트를 작성하는 즉시 표의 항목 번호를 테스트 이름/주석에 그대로 달아두면 Check 대조가 더 빨라진다.

---

## 7. Process Improvement Suggestions

### 7.1 PDCA Process

| Phase | Current | Improvement Suggestion |
|-------|---------|------------------------|
| Design | 버전 bump 대상 파일이 §11.1 File Structure에 나열만 되고 "쌍으로 묶인 파일"이라는 관계는 표시 안 됨 | package.json/package-lock.json처럼 항상 같이 바뀌어야 하는 파일 쌍을 표기하는 관례 추가 검토 |
| Check | 시나리오 표 vs 테스트 이름 수작업 대조 | 소규모 사이클은 이 정도 수작업이 적당 — 자동화 도입은 과함 |

### 7.2 Tools/Environment

특별한 도구/환경 개선 제안 없음 — 기존 vitest/oxlint/tsc 조합으로 충분했다.

---

## 8. Next Steps

### 8.1 Immediate — 사이클 종료 절차 (RULE.md)

- [ ] `docs/PDCA/_INDEX.md`에 행 추가
- [ ] 최신 태그(`v0.1.0`) 확인 후 다음 버전(`v0.2.0`) 형 확정
- [ ] `npm run docs:upload -- --cycle harden-cli-contract --version v0.2.0` (별도 스크립트 없으면 형과 방식 재확인 — 이 레포엔 `docs:upload` npm script가 없음, PDCA-workspace 쪽 스크립트인지 확인 필요)
- [ ] README.md 최신화 확인(이미 본 사이클에서 반영됨 — 추가 변경 없는지 재확인만)
- [ ] docs 문서 + README.md 커밋 1개 (형 지시 시)
- [ ] 커밋에 `v0.2.0` 태그, 푸시 전 확인
- [ ] 최신 태그~이번 사이클 태그 git diff를 프로젝트 폴더에 txt로 저장(커밋 안 함)

### 8.2 Next PDCA Cycle

| Item | Priority | Expected Start |
|------|----------|----------------|
| (미정) | - | - |

---

## 9. Changelog

이미 `CHANGELOG.md`에 v0.2.0 항목으로 반영 완료 — 본 절은 중복 방지를 위해 생략(§2 Related Documents 및 실제 `CHANGELOG.md` 참조).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-09 | 완료 보고서 최초 작성 (Match Rate 100%) | Claude |
