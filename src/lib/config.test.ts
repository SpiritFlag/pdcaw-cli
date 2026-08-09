// Design Ref: §8.2 — 신규 단위 테스트 c1~c11
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildMissingConfigMessage, ConfigError, mergeConfig, resolveConfig } from './config.ts'

describe('mergeConfig — 우선순위 CLI 인자 > 환경변수 > .pdcarc > 기본값', () => {
  it('c1: CLI 인자가 있으면 항상 승리한다', () => {
    const { config } = mergeConfig(
      { baseUrl: 'https://cli.example', projectId: 'cli-id' },
      { PDCAW_BASE_URL: 'https://env.example', PDCAW_PROJECT_ID: 'env-id' },
      { baseUrl: 'https://rc.example', projectId: 'rc-id' },
    )
    expect(config).toEqual({ baseUrl: 'https://cli.example', projectId: 'cli-id' })
  })

  it('c2: CLI 인자가 없으면 환경변수가 승리한다', () => {
    const { config } = mergeConfig(
      {},
      { PDCAW_BASE_URL: 'https://env.example', PDCAW_PROJECT_ID: 'env-id' },
      { baseUrl: 'https://rc.example', projectId: 'rc-id' },
    )
    expect(config).toEqual({ baseUrl: 'https://env.example', projectId: 'env-id' })
  })

  it('c3: CLI·환경변수 둘 다 없으면 .pdcarc가 승리한다', () => {
    const { config } = mergeConfig({}, {}, { baseUrl: 'https://rc.example', projectId: 'rc-id' })
    expect(config).toEqual({ baseUrl: 'https://rc.example', projectId: 'rc-id' })
  })

  it('c4: 전부 없으면 baseUrl은 undefined(기본값 없음), projectId도 undefined', () => {
    const { config } = mergeConfig({}, {}, {})
    expect(config.baseUrl).toBeUndefined()
    expect(config.projectId).toBeUndefined()
  })

  it('c5: PAT는 환경변수(PDCAW_PAT)에서만 읽는다 — .pdcarc·CLI에 값이 있어도 무시', () => {
    const { pat } = mergeConfig(
      {},
      { PDCAW_PAT: 'pdcaw_from_env' },
      { pat: 'pdcaw_from_rc' } as Record<string, unknown>,
    )
    expect(pat).toBe('pdcaw_from_env')
  })

  it('c5b: 환경변수에 PDCAW_PAT가 없으면 pat는 undefined', () => {
    const { pat } = mergeConfig({}, {}, {})
    expect(pat).toBeUndefined()
  })
})

describe('buildMissingConfigMessage — 누락 필드 합성(순수)', () => {
  it('m1: pat만 누락, hasAnyConfig=true → pat 가이드만, 도입부 없음', () => {
    const msg = buildMissingConfigMessage(['pat'], true)
    expect(msg).toContain('PDCAW_PAT가 설정되지 않았습니다')
    expect(msg).not.toContain('PDCAW_BASE_URL이 설정되지 않았습니다')
    expect(msg).not.toContain('설정을 찾을 수 없습니다')
  })

  it('m2: baseUrl만 누락, hasAnyConfig=true → baseUrl 가이드만', () => {
    const msg = buildMissingConfigMessage(['baseUrl'], true)
    expect(msg).toContain('PDCAW_BASE_URL이 설정되지 않았습니다')
    expect(msg).not.toContain('PDCAW_PAT가 설정되지 않았습니다')
  })

  it('m3: 둘 다 누락, hasAnyConfig=false → 도입부 + pat + baseUrl 순서로 모두 포함', () => {
    const msg = buildMissingConfigMessage(['pat', 'baseUrl'], false)
    expect(msg).toContain('설정을 찾을 수 없습니다')
    const patIdx = msg.indexOf('PDCAW_PAT가 설정되지 않았습니다')
    const baseUrlIdx = msg.indexOf('PDCAW_BASE_URL이 설정되지 않았습니다')
    expect(patIdx).toBeGreaterThan(-1)
    expect(baseUrlIdx).toBeGreaterThan(patIdx)
  })
})

describe('resolveConfig — I/O 포함 통합 테스트', () => {
  it('c6: 설정 전무(빈 디렉터리, env 없음) → ConfigError, PAT·baseUrl 안내 모두 포함', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pdcaw-test-'))
    const savedPat = process.env.PDCAW_PAT
    const savedBaseUrl = process.env.PDCAW_BASE_URL
    delete process.env.PDCAW_PAT
    delete process.env.PDCAW_BASE_URL
    try {
      expect(() => resolveConfig(dir)).toThrow(ConfigError)
      try {
        resolveConfig(dir)
      } catch (err) {
        const message = (err as Error).message
        expect(message).toContain('.pdcarc.json')
        expect(message).toContain('PDCAW_PAT가 설정되지 않았습니다')
        expect(message).toContain('PDCAW_BASE_URL이 설정되지 않았습니다')
      }
    } finally {
      if (savedPat !== undefined) process.env.PDCAW_PAT = savedPat
      if (savedBaseUrl !== undefined) process.env.PDCAW_BASE_URL = savedBaseUrl
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('c7: .pdcarc.json에 pat 키가 있으면 경고 후 무시(값은 config에 안 실림)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pdcaw-test-'))
    writeFileSync(
      path.join(dir, '.pdcarc.json'),
      JSON.stringify({ pat: 'pdcaw_leak', projectId: 'x', baseUrl: 'https://self-hosted.example' }),
    )
    const savedPat = process.env.PDCAW_PAT
    process.env.PDCAW_PAT = 'pdcaw_real'
    try {
      const config = resolveConfig(dir)
      expect(config.pat).toBe('pdcaw_real')
      expect(config.projectId).toBe('x')
      expect(config.baseUrl).toBe('https://self-hosted.example')
    } finally {
      if (savedPat === undefined) delete process.env.PDCAW_PAT
      else process.env.PDCAW_PAT = savedPat
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('c8b: baseUrl만 설정되고 PAT가 없으면 pat 가이드만 담긴 ConfigError (Design §8.2 #7, c8의 대칭 케이스)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pdcaw-test-'))
    const savedPat = process.env.PDCAW_PAT
    const savedBaseUrl = process.env.PDCAW_BASE_URL
    delete process.env.PDCAW_PAT
    process.env.PDCAW_BASE_URL = 'https://self-hosted.example'
    try {
      try {
        resolveConfig(dir)
        expect.unreachable('ConfigError를 던져야 한다')
      } catch (err) {
        const message = (err as Error).message
        expect(message).toContain('PDCAW_PAT가 설정되지 않았습니다')
        expect(message).not.toContain('PDCAW_BASE_URL이 설정되지 않았습니다')
      }
    } finally {
      if (savedPat !== undefined) process.env.PDCAW_PAT = savedPat
      if (savedBaseUrl === undefined) delete process.env.PDCAW_BASE_URL
      else process.env.PDCAW_BASE_URL = savedBaseUrl
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('c8: baseUrl만 없으면(PAT는 있음) baseUrl 가이드만 담긴 ConfigError', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pdcaw-test-'))
    const savedPat = process.env.PDCAW_PAT
    const savedBaseUrl = process.env.PDCAW_BASE_URL
    process.env.PDCAW_PAT = 'pdcaw_real'
    delete process.env.PDCAW_BASE_URL
    try {
      try {
        resolveConfig(dir)
        expect.unreachable('ConfigError를 던져야 한다')
      } catch (err) {
        const message = (err as Error).message
        expect(message).toContain('PDCAW_BASE_URL이 설정되지 않았습니다')
        expect(message).not.toContain('PDCAW_PAT가 설정되지 않았습니다')
      }
    } finally {
      if (savedPat === undefined) delete process.env.PDCAW_PAT
      else process.env.PDCAW_PAT = savedPat
      if (savedBaseUrl !== undefined) process.env.PDCAW_BASE_URL = savedBaseUrl
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('c9: PAT·baseUrl 모두 있으면 정상 반환, baseUrl의 trailing slash는 제거된다', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pdcaw-test-'))
    const savedPat = process.env.PDCAW_PAT
    const savedBaseUrl = process.env.PDCAW_BASE_URL
    process.env.PDCAW_PAT = 'pdcaw_real'
    process.env.PDCAW_BASE_URL = 'https://self-hosted.example///'
    try {
      const config = resolveConfig(dir)
      expect(config.baseUrl).toBe('https://self-hosted.example')
    } finally {
      if (savedPat === undefined) delete process.env.PDCAW_PAT
      else process.env.PDCAW_PAT = savedPat
      if (savedBaseUrl === undefined) delete process.env.PDCAW_BASE_URL
      else process.env.PDCAW_BASE_URL = savedBaseUrl
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
