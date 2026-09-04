// 출력 형식 단일 지점. --json이면 stdout에 JSON 한 덩어리만 쓴다(스킬이 파싱한다).
// 사람용 텍스트는 그 밖의 경우에만. 진행 로그(console.log)는 --json 모드에서 stderr로 보낸다.
export type Emitter = {
  json: boolean
  /** 최종 결과. --json이면 JSON, 아니면 textFn() 결과를 stdout에 */
  result: (data: unknown, textFn: () => string) => void
  /** 진행 메시지. --json이면 stderr, 아니면 stdout */
  log: (line: string) => void
}

export function createEmitter(json: boolean): Emitter {
  return {
    json,
    result(data, textFn) {
      if (json) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
      else process.stdout.write(`${textFn()}\n`)
    },
    log(line) {
      if (json) process.stderr.write(`${line}\n`)
      else process.stdout.write(`${line}\n`)
    },
  }
}

/** [순수] 열 너비를 맞춘 간단한 표. 헤더 없음(스킬은 --json을 쓰므로 사람 눈용). */
export function table(rows: string[][]): string {
  if (rows.length === 0) return '(없음)'
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, displayWidth(cell))
    })
  }
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i === row.length - 1 ? cell : cell + ' '.repeat(widths[i] - displayWidth(cell))))
        .join('  '),
    )
    .join('\n')
}

// 한글 등 전각 문자는 2칸으로 센다 — 표 정렬용 근사치.
function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    w += code > 0x2e7f ? 2 : 1
  }
  return w
}
