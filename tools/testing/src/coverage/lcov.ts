import { readFileSync } from 'node:fs'

/**
 * What one metric's counters add up to.
 */
export type Metric = {
  /** How many of the thing the file contains. */
  found: number
  /** How many were executed at least once. */
  hit: number
}

/**
 * The three metrics a run measures, each reduced to found and hit.
 */
export type MetricTotals = {
  /** Lines executed against lines present. */
  lines: Metric
  /** Branches taken against branches present. */
  branches: Metric
  /** Functions entered against functions declared. */
  functions: Metric
}

/**
 * One source file's merged counters.
 *
 * The counters stay as maps rather than totals because merging is the whole point: two
 * records for the same file have to be combined per line, per function, and per branch
 * before any percentage means anything.
 */
export type FileCoverage = {
  /** The file's path, as the report names it: relative to the project root. */
  path: string
  /** Execution count per line number. */
  lines: Map<number, number>
  /** Execution count per function, keyed by declaration line and name. */
  functions: Map<string, number>
  /** Times taken per branch, keyed by line, block, and branch index. */
  branches: Map<string, number>
}

/**
 * Reads lcov reports and combines every record for the same file into one.
 *
 * A file appears more than once whenever a module was evaluated more than once: after
 * `jest.resetModules` a later import re-runs the module body, and V8 measures each
 * evaluation as a script of its own. Treating those as separate files counts every line
 * of the module once per evaluation while crediting only the evaluation that ran it,
 * which drags the percentages down in proportion to how often a suite reset. Combining
 * them is what Jest's provider did implicitly, by accumulating into counters keyed by
 * file rather than by script.
 *
 * Reports from different environments merge the same way, so a file exercised by one
 * environment and merely imported by another is judged on both.
 *
 * Anything a `node:coverage ignore` comment covers is dropped rather than measured. Node
 * omits an ignored line from the report but still writes out the branches and functions
 * sitting on it, marked untaken, while counting them as covered in its own totals.
 * Dropping them is both what makes the two agree and what `istanbul ignore` used to mean.
 *
 * @param lcovPaths - Paths to the emitted lcov files.
 * @returns One entry per file, keyed by the path the report names.
 */
export function mergeLcov(lcovPaths: readonly string[]): Map<string, FileCoverage> {
  const files = new Map<string, FileCoverage>()

  for (const lcovPath of lcovPaths) {
    for (const record of readFileSync(lcovPath, 'utf8').split('end_of_record')) {
      mergeRecord(files, record.split('\n').map((line) => line.trim()))
    }
  }

  return files
}

/**
 * Merges one lcov record into the file it names.
 *
 * @param files - Every file seen so far, keyed by path.
 * @param lines - The record's lines, trimmed.
 */
function mergeRecord(files: Map<string, FileCoverage>, lines: readonly string[]): void {
  const path = lines.find((line) => line.startsWith('SF:'))?.slice(3)
  if (!path) return

  const file = files.get(path) ?? { path, lines: new Map<number, number>(), functions: new Map<string, number>(), branches: new Map<string, number>() }
  files.set(path, file)

  const measured = new Set<number>()
  for (const line of lines) {
    if (!line.startsWith('DA:')) continue
    const [at, count] = line.slice(3).split(',')
    measured.add(Number(at))
    add(file.lines, Number(at), Number(count))
  }

  // how: lcov writes every declaration before any of their counts, and in the same order, so position is what pairs them up.
  const declarations = lines.filter((line) => line.startsWith('FN:')).map((line) => line.slice(3))
  const counts = lines.filter((line) => line.startsWith('FNDA:')).map((line) => line.slice(5))

  for (const [at, declaration] of declarations.entries()) {
    const separator = declaration.indexOf(',')
    if (!measured.has(Number(declaration.slice(0, separator)))) continue
    const count = counts[at]
    // why: the reporter numbers anonymous functions by discovery order, which shifts between runs and environments, so the same function arrives under different names and two records for it would stay two entries. The declaration line is the identity that holds still.
    const name = declaration.slice(separator + 1).replace(/^anonymous_\d+$/, 'anonymous')
    add(file.functions, `${declaration.slice(0, separator)},${name}`, count === undefined ? 0 : Number(count.slice(0, count.indexOf(','))))
  }

  for (const line of lines) {
    if (!line.startsWith('BRDA:')) continue
    const parts = line.slice(5).split(',')
    if (!measured.has(Number(parts[0]))) continue
    // why: block numbers shift between runs and environments the same way anonymous function names do, so keying on them splits one branch into several entries at random. The line and the branch index are the parts that hold still; distinct blocks sharing both collapse into one entry, which is a deterministic undercount rather than a drifting total.
    // why: an untaken branch is reported as a dash rather than a zero.
    add(file.branches, `${parts[0]},${parts[2]}`, parts[3] === '-' ? 0 : Number(parts[3]))
  }
}

/**
 * Adds a count to a key, creating it when it is new.
 *
 * @param counters - The map to accumulate into.
 * @param key - The key to add under.
 * @param count - The count to add.
 */
function add<TKey>(counters: Map<TKey, number>, key: TKey, count: number): void {
  counters.set(key, (counters.get(key) ?? 0) + count)
}

/**
 * Reduces one file's counters to a found and hit total per metric.
 *
 * @param file - The file's merged counters.
 * @returns How many lines, branches, and functions it has and how many ran.
 */
export function fileTotals(file: FileCoverage): MetricTotals {
  return { lines: totalOf(file.lines), branches: totalOf(file.branches), functions: totalOf(file.functions) }
}

/**
 * Adds up the totals of every file in a report.
 *
 * @param files - The merged files.
 * @returns The report's totals.
 */
export function overallTotals(files: Iterable<FileCoverage>): MetricTotals {
  const overall = { lines: { found: 0, hit: 0 }, branches: { found: 0, hit: 0 }, functions: { found: 0, hit: 0 } }

  for (const file of files) {
    const totals = fileTotals(file)
    for (const name of ['lines', 'branches', 'functions'] as const) {
      overall[name].found += totals[name].found
      overall[name].hit += totals[name].hit
    }
  }

  return overall
}

/**
 * Reduces a set of counters to how many exist and how many ran.
 *
 * @param counters - Execution counts keyed by whatever the metric counts.
 * @returns The metric's totals.
 */
function totalOf(counters: Map<unknown, number>): Metric {
  let hit = 0
  for (const count of counters.values()) if (count > 0) hit += 1
  return { found: counters.size, hit }
}

/**
 * Renders a metric as a percentage.
 *
 * A metric with nothing to measure is complete, which is what Jest reported for a file
 * holding no branches at all.
 *
 * @param metric - The metric's totals.
 * @returns The percentage covered.
 */
export function percentOf(metric: Metric): number {
  return metric.found === 0 ? 100 : (metric.hit / metric.found) * 100
}

/**
 * Lists the lines a file never executed, collapsing runs into ranges.
 *
 * @param file - The file's merged counters.
 * @returns The uncovered ranges, in source order.
 */
export function uncoveredRanges(file: FileCoverage): string[] {
  const missed = [...file.lines.entries()].filter(([, count]) => count === 0).map(([at]) => at).sort((left, right) => left - right)
  const ranges: string[] = []

  for (const at of missed) {
    const last = ranges[ranges.length - 1]
    const end = last === undefined ? undefined : Number(last.split('-')[1] ?? last)
    if (last !== undefined && end === at - 1) ranges[ranges.length - 1] = `${last.split('-')[0]}-${at}`
    else ranges.push(String(at))
  }

  return ranges
}

/**
 * Renders merged files back out as one lcov report.
 *
 * The raw reports are what Node measured, one per environment and one record per
 * evaluation. A consumer reading coverage off disk wants what the gate judged instead:
 * one record per file, with the counts combined. Paths are written as given, so a caller
 * that needs them anchored somewhere other than the project root rebases them first.
 *
 * @param files - The merged files, in any order.
 * @returns The report's text, ending in a newline.
 */
export function renderLcov(files: Iterable<FileCoverage>): string {
  const records: string[] = []

  for (const file of [...files].sort((left, right) => (left.path < right.path ? -1 : 1))) {
    const totals = fileTotals(file)
    const functions = [...file.functions.entries()].map(([key, count]) => ({ at: key.slice(0, key.indexOf(',')), name: key.slice(key.indexOf(',') + 1), count }))
    const lines = [
      'TN:',
      `SF:${file.path}`,
      ...functions.map(({ at, name }) => `FN:${at},${name}`),
      ...functions.map(({ name, count }) => `FNDA:${count},${name}`),
      `FNF:${totals.functions.found}`,
      `FNH:${totals.functions.hit}`,
      // how: the merge keys a branch by line and branch index only, so every branch is written back into block zero.
      ...[...file.branches.entries()].map(([key, count]) => `BRDA:${key.slice(0, key.indexOf(','))},0,${key.slice(key.indexOf(',') + 1)},${count}`),
      `BRF:${totals.branches.found}`,
      `BRH:${totals.branches.hit}`,
      ...[...file.lines.entries()].sort(([left], [right]) => left - right).map(([at, count]) => `DA:${at},${count}`),
      `LF:${totals.lines.found}`,
      `LH:${totals.lines.hit}`,
      'end_of_record',
    ]
    records.push(lines.join('\n'))
  }

  return records.length === 0 ? '' : `${records.join('\n')}\n`
}
