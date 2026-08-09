// Design Ref: §8.2 — 신규 단위 테스트 c1~c7
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigError, mergeConfig, resolveConfig } from './config.ts'

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

  it('c4: 전부 없으면 baseUrl은 기본값(prod), projectId는 undefined', () => {
    const { config } = mergeConfig({}, {}, {})
    expect(config.baseUrl).toBe('https://pdca-workspace.vercel.app')
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

describe('resolveConfig — I/O 포함 통합 테스트', () => {
  it('c6: 설정 전무(빈 디렉터리, env 없음) → ConfigError, .pdcarc 안내 문구 포함', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pdcaw-test-'))
    const savedPat = process.env.PDCAW_PAT
    delete process.env.PDCAW_PAT
    try {
      expect(() => resolveConfig(dir)).toThrow(ConfigError)
      try {
        resolveConfig(dir)
      } catch (err) {
        expect((err as Error).message).toContain('.pdcarc.json')
      }
    } finally {
      if (savedPat !== undefined) process.env.PDCAW_PAT = savedPat
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('c7: .pdcarc.json에 pat 키가 있으면 경고 후 무시(값은 config에 안 실림)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pdcaw-test-'))
    writeFileSync(path.join(dir, '.pdcarc.json'), JSON.stringify({ pat: 'pdcaw_leak', projectId: 'x' }))
    const savedPat = process.env.PDCAW_PAT
    process.env.PDCAW_PAT = 'pdcaw_real'
    try {
      const config = resolveConfig(dir)
      expect(config.pat).toBe('pdcaw_real')
      expect(config.projectId).toBe('x')
    } finally {
      if (savedPat === undefined) delete process.env.PDCAW_PAT
      else process.env.PDCAW_PAT = savedPat
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
