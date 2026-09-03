import type { FileStats, LegendEntry, LintEntry } from './types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Pattern to match ANSI escape sequences (bounded for safety).
 *
 * Matches ESC[...X where ... is up to 20 digits/semicolons and X is a letter.
 */
// eslint-disable-next-line no-control-regex -- Required to match ANSI escape codes
const ANSI_PATTERN = /\x1B\[[0-9;]{0,20}[a-zA-Z]/g

/**
 * Strip ANSI escape codes from string.
 *
 * @param str - Input string with potential ANSI codes
 * @returns Clean string without ANSI codes
 */
function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, '')
}

/**
 * Parse raw lint output into structured entries.
 *
 * @param raw - Raw lint output from nx
 * @param workspaceRoot - Workspace root path
 * @returns Array of parsed lint entries
 */
export function parseLintOutput(raw: string, workspaceRoot: string): LintEntry[] {
  const stripped = stripAnsi(raw)
  const seen = createSet<string>()
  const entries: LintEntry[] = []
  let currentFile: string | null = null

  for (const line of stripped.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith(workspaceRoot)) {
      currentFile = trimmed.slice(workspaceRoot.length + 1)
      continue
    }

    if (!currentFile) continue

    const match = trimmed.match(/^(\d+):\d+\s+(error|warning)\s+(.+?)\s+([\w@][\w./-]+)\s*$/)
    if (!match) continue

    const lineNum = match[1]
    const severity = match[2]
    const message = match[3]
    const rule = match[4]

    if (lineNum === undefined || severity === undefined || message === undefined || rule === undefined) {
      continue
    }

    const key = `${currentFile}:${lineNum}:${rule}`
    if (seen.has(key)) continue
    seen.add(key)

    entries.push({
      file: currentFile,
      line: parseInt(lineNum, 10),
      severity: severity as 'error' | 'warning',
      message,
      rule,
    })
  }

  return entries
}

/**
 * Build legend mapping unique (severity+rule+message) to short codes.
 *
 * @param entries - Parsed lint entries
 * @returns Tuple of [legendMap, legendList]
 */
export function buildLegend(entries: LintEntry[]): [Map<string, string>, LegendEntry[]] {
  const legendMap = createMap<string, string>()
  const legendList: LegendEntry[] = []
  let errorCounter = 1
  let warnCounter = 1

  for (const e of entries) {
    const key = `${e.severity}||${e.rule}||${e.message}`
    if (!legendMap.has(key)) {
      const code = e.severity === 'error' ? `E${errorCounter++}` : `W${warnCounter++}`
      legendMap.set(key, code)
      legendList.push({ code, severity: e.severity, rule: e.rule, message: e.message })
    }
  }

  return [legendMap, legendList]
}

/**
 * Group entries by file and compute stats for sorting.
 *
 * @param entries - Parsed lint entries
 * @param legendMap - Map from key to short code
 * @returns Map of file path to FileStats
 */
export function groupByFile(entries: LintEntry[], legendMap: Map<string, string>): Map<string, FileStats> {
  const fileMap = createMap<string, FileStats>()

  for (const e of entries) {
    const code = legendMap.get(`${e.severity}||${e.rule}||${e.message}`)
    if (!code) continue

    let stats = fileMap.get(e.file)

    if (!stats) {
      stats = { file: e.file, errorCount: 0, warningCount: 0, lineCount: 0, codeGroups: createMap<string, number[]>() }
      fileMap.set(e.file, stats)
    }

    if (e.severity === 'error') stats.errorCount++
    else stats.warningCount++

    const lines = stats.codeGroups.get(code)
    if (lines) {
      lines.push(e.line)
    } else {
      stats.codeGroups.set(code, [e.line])
    }
  }

  for (const stats of fileMap.values()) {
    const allLines = createSet<number>()
    for (const lines of stats.codeGroups.values()) {
      for (const l of lines) allLines.add(l)
    }
    stats.lineCount = allLines.size
  }

  return fileMap
}
