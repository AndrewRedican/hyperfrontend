import type { FileStats, LegendEntry, LintEntry } from './types'
import { posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { normalizePath } from '@hyperfrontend/project-scope/core/path'

/**
 * Pattern to match ANSI escape sequences (bounded for safety).
 *
 * Matches ESC[...X where ... is up to 20 digits/semicolons and X is a letter.
 */
// lint-disable-next-line no-control-regex -- Required to match ANSI escape codes
const ANSI_PATTERN = /\x1B\[[0-9;]{0,20}[a-zA-Z]/g

/**
 * Strip ANSI escape codes from string.
 *
 * @param str - Input string with potential ANSI codes
 * @returns Clean string without ANSI codes
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, '')
}

/**
 * Parse raw lint output into structured entries.
 *
 * @param raw - Raw output of the lint run
 * @param workspaceRoot - Workspace root path
 * @returns Array of parsed lint entries
 */
export function parseLintOutput(raw: string, workspaceRoot: string): LintEntry[] {
  const stripped = stripAnsi(raw)
  const seen = createSet<string>()
  const entries: LintEntry[] = []
  let currentFile: string | null = null

  for (const line of stripped.split(/\r?\n/)) {
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
 * Read the projects whose lint task the run's summary lists as failed, from lines such as `  failed    lib-a:lint (1.2 s)`.
 *
 * @param raw - Raw output of the lint run
 * @returns Project names in the order the summary lists them
 */
export function parseFailedProjects(raw: string): string[] {
  const projects = createSet<string>()

  for (const line of stripAnsi(raw).split(/\r?\n/)) {
    const [status, task, duration] = line.trim().split(/\s+/)
    if (status === 'failed' && task?.endsWith(':lint') && duration?.startsWith('(')) projects.add(task.slice(0, -':lint'.length))
  }

  return [...projects]
}

/**
 * Find the project owning a file: the one with the deepest root containing it.
 *
 * @param file - File path relative to the workspace root
 * @param projectRoots - Map of project name to its root relative to the workspace root
 * @returns Owning project name, or null when no project contains the file
 */
function findOwner(file: string, projectRoots: Map<string, string>): string | null {
  const normalized = normalizePath(file)
  let owner: string | null = null
  let depth = -1

  for (const [project, root] of projectRoots) {
    const contains = !posix.relative(root, normalized).startsWith('..')
    const rootDepth = root === '.' ? 0 : root.length
    if (contains && rootDepth > depth) {
      owner = project
      depth = rootDepth
    }
  }

  return owner
}

/**
 * Select the failed projects that own none of the parsed lint errors.
 *
 * A lint task that fails without a single error to show for it did not lint:
 * the linter or a rule threw, or the process was killed.
 *
 * @param failedProjects - Projects whose lint task failed
 * @param entries - Parsed lint entries
 * @param projectRoots - Map of project name to its root relative to the workspace root
 * @returns Failed projects without any error entry
 */
export function findCrashSuspects(failedProjects: string[], entries: LintEntry[], projectRoots: Map<string, string>): string[] {
  const withErrors = createSet<string>()

  for (const e of entries) {
    if (e.severity !== 'error') continue
    const owner = findOwner(e.file, projectRoots)
    if (owner !== null) withErrors.add(owner)
  }

  return failedProjects.filter((project) => !withErrors.has(project))
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
