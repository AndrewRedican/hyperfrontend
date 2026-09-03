import type { CoverageThresholds } from '../runner/config.ts'
import type { FileCoverage, Metric } from './lcov.ts'
import { fileTotals, overallTotals, percentOf, uncoveredRanges } from './lcov.ts'

/**
 * One rendered row of the coverage table.
 */
type Row = {
  /** The file's path, or the label of the totals row. */
  file: string
  /** Percentage of lines executed. */
  lines: string
  /** Percentage of branches taken. */
  branches: string
  /** Percentage of functions entered. */
  functions: string
  /** The lines the file never ran, as ranges. */
  uncovered: string
}

/** The columns in the order they render. */
const ORDER = ['file', 'lines', 'branches', 'functions', 'uncovered'] as const

/** What each column is headed with, which is also its minimum width. */
const HEADINGS: Row = { file: 'file', lines: 'line %', branches: 'branch %', functions: 'funcs %', uncovered: 'uncovered lines' }

/**
 * Renders the per-file coverage table, closing with the project's totals.
 *
 * @param files - The merged files, in any order.
 * @returns The table, one string per line.
 */
export function renderCoverageTable(files: readonly FileCoverage[]): string[] {
  const rows = [...files]
    .sort((left, right) => (left.path < right.path ? -1 : 1))
    .map((file) => {
      const totals = fileTotals(file)
      return {
        file: file.path,
        lines: percent(totals.lines),
        branches: percent(totals.branches),
        functions: percent(totals.functions),
        uncovered: uncoveredRanges(file).join(' '),
      }
    })

  const overall = overallTotals(files)
  const summary: Row = {
    file: 'all files',
    lines: percent(overall.lines),
    branches: percent(overall.branches),
    functions: percent(overall.functions),
    uncovered: '',
  }

  const all = [...rows, summary]
  const widths: Record<(typeof ORDER)[number], number> = {
    file: widthOf(all, 'file'),
    lines: widthOf(all, 'lines'),
    branches: widthOf(all, 'branches'),
    functions: widthOf(all, 'functions'),
    uncovered: widthOf(all, 'uncovered'),
  }
  const rule = '-'.repeat(ORDER.reduce((total, key) => total + widths[key] + 3, -3))

  return [line(HEADINGS, widths), rule, ...rows.map((row) => line(row, widths)), rule, line(summary, widths), rule]
}

/**
 * Measures how wide a column has to be to hold its heading and every cell.
 *
 * @param rows - Every row the table will render.
 * @param key - The column to measure.
 * @returns The column's width.
 */
function widthOf(rows: readonly Row[], key: (typeof ORDER)[number]): number {
  return Math.max(HEADINGS[key].length, ...rows.map((row) => row[key].length))
}

/**
 * Renders one row, left-aligning the path and right-aligning every percentage.
 *
 * @param row - The row's cells.
 * @param widths - Each column's width.
 * @returns The rendered row.
 */
function line(row: Row, widths: Record<(typeof ORDER)[number], number>): string {
  return ORDER.map((key) => (key === 'file' ? row[key].padEnd(widths[key]) : row[key].padStart(widths[key]))).join(' | ')
}

/**
 * Renders a metric to two decimal places.
 *
 * @param metric - The metric's totals.
 * @returns The percentage as text.
 */
function percent(metric: Metric): string {
  return percentOf(metric).toFixed(2)
}

/**
 * Reports which declared thresholds a report falls short of.
 *
 * The comparison is against the project as a whole, which is what a Jest `global`
 * threshold meant.
 *
 * @param files - The merged files.
 * @param thresholds - The percentages the project requires.
 * @returns One message per threshold missed, empty when all are met.
 */
export function findThresholdShortfalls(files: readonly FileCoverage[], thresholds: CoverageThresholds | undefined): string[] {
  const overall = overallTotals(files)
  const declared = [
    { name: 'line', actual: overall.lines, required: thresholds?.lines },
    { name: 'branch', actual: overall.branches, required: thresholds?.branches },
    { name: 'function', actual: overall.functions, required: thresholds?.functions },
  ]

  return declared
    .filter((entry) => entry.required !== undefined && percentOf(entry.actual) < entry.required)
    .map((entry) => `${percentOf(entry.actual).toFixed(2)}% ${entry.name} coverage does not meet threshold of ${entry.required}%`)
}
