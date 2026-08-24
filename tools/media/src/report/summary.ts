import type { RunSummaryRow } from '../models/report'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { formatBytes } from '../lib/format-bytes'

/** Column headings, in the order the summary prints them. */
const HEADINGS: readonly string[] = ['scene', 'asset', 'size', 'budget', 'frames', 'encoder', 'took']

/**
 * Turn one finished scene into the cells its row prints.
 *
 * @param row - The finished scene.
 * @returns One cell per column.
 */
function toCells(row: RunSummaryRow): readonly string[] {
  return [
    row.slug,
    row.asset,
    formatBytes(row.bytes),
    formatBytes(row.maxBytes),
    `${row.frames}`,
    row.encoder,
    `${round(row.elapsedMs / 100) / 10}s`,
  ]
}

/**
 * Render a run as an aligned table.
 *
 * Size and budget sit next to each other on purpose: the number a reader wants
 * after a run is how much headroom is left, not how many bytes were written.
 *
 * @param rows - Every scene the run finished.
 * @returns A table ready to print.
 */
export function renderSummary(rows: readonly RunSummaryRow[]): string {
  const table = [HEADINGS, ...rows.map(toCells)]
  const widths = HEADINGS.map((_heading, column) => table.reduce((widest, cells) => max(widest, (cells[column] ?? '').length), 0))
  return table
    .map((cells) =>
      cells
        .map((cell, column) => cell.padEnd(widths[column] ?? 0))
        .join('  ')
        .trimEnd()
    )
    .join('\n')
}

/**
 * Render a run as machine-readable output.
 *
 * @param rows - Every scene the run finished.
 * @returns A JSON document ready to print.
 */
export function renderJson(rows: readonly RunSummaryRow[]): string {
  return stringify({ scenes: rows }, undefined, 2)
}
