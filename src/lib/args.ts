// 서브커맨드 공용 인자 파서. 옵션 명세를 받아 flags·positionals로 가른다.
// `--json`은 모든 명령이 받으므로 여기서 항상 인정한다.
export class UsageError extends Error {}

export type FlagKind = 'string' | 'boolean' | 'list'

export type FlagSpec = Record<string, FlagKind>

export type ParsedArgs<S extends FlagSpec> = {
  flags: { [K in keyof S]?: S[K] extends 'boolean' ? boolean : S[K] extends 'list' ? string[] : string }
  json: boolean
  positionals: string[]
}

/** [순수] argv를 명세대로 해석한다. 값이 필요한 옵션에 값이 없거나 모르는 옵션이면 UsageError. */
export function parseFlags<S extends FlagSpec>(argv: string[], spec: S, usage: string): ParsedArgs<S> {
  const flags: Record<string, unknown> = {}
  const positionals: string[] = []
  let json = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--json') {
      json = true
      continue
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    const name = (eq === -1 ? arg : arg.slice(0, eq)).slice(2)
    const kind = spec[name]
    if (!kind) throw new UsageError(`알 수 없는 옵션: ${arg}\n${usage}`)

    if (kind === 'boolean') {
      flags[name] = true
      continue
    }
    let value: string | undefined
    if (eq !== -1) value = arg.slice(eq + 1)
    else {
      value = argv[++i]
      if (value === undefined || value.startsWith('--')) throw new UsageError(`--${name} 에 값이 필요합니다\n${usage}`)
    }
    if (kind === 'list') {
      const list = (flags[name] as string[] | undefined) ?? []
      list.push(value)
      flags[name] = list
    } else {
      flags[name] = value
    }
  }

  return { flags: flags as ParsedArgs<S>['flags'], json, positionals }
}

/** [순수] 쉼표 구분 목록(`a,b, c`)을 배열로. 빈 조각은 버린다. */
export function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
