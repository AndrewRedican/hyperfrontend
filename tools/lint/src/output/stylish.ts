/**
 * The default report: each file's path, then one line per problem with its position, severity,
 * message and rule in aligned columns, then a count. The line shape is the one the workspace's
 * lint report executor parses.
 *
 * @module output/stylish
 */

import type { FileResult } from '../engine/report.ts'

/**
 * Formats results.
 *
 * @param results - One result per file, in the order to print
 * @returns The report, empty when no file has a problem
 */
export function formatStylish(results: readonly FileResult[]): string {
  let errors = 0
  let warnings = 0
  let fixableErrors = 0
  let fixableWarnings = 0
  let out = ''
  for (const result of results) {
    if (result.messages.length === 0) continue
    const rows = result.messages.map((message) => {
      if (message.severity === 2) {
        errors += 1
        if (message.fix !== null) fixableErrors += 1
      } else {
        warnings += 1
        if (message.fix !== null) fixableWarnings += 1
      }
      return {
        position: `${message.line ?? 0}:${message.column ?? 0}`,
        severity: message.severity === 2 ? 'error' : 'warning',
        message: message.message.replace(/([^ ])\.$/, '$1'),
        rule: message.ruleId ?? '',
      }
    })
    const positionWidth = rows.reduce((width, row) => (row.position.length > width ? row.position.length : width), 0)
    const severityWidth = rows.reduce((width, row) => (row.severity.length > width ? row.severity.length : width), 0)
    const messageWidth = rows.reduce((width, row) => (row.message.length > width ? row.message.length : width), 0)
    out += `\n${result.filePath}\n`
    for (const row of rows) {
      out +=
        `  ${row.position.padStart(positionWidth)}  ${row.severity.padEnd(severityWidth)}  ${row.message.padEnd(messageWidth)}  ${row.rule}\n`.replace(
          / +\n$/,
          '\n'
        )
    }
  }
  const total = errors + warnings
  if (total === 0) return ''
  out += `\n✖ ${total} ${total === 1 ? 'problem' : 'problems'} (${errors} ${errors === 1 ? 'error' : 'errors'}, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'})\n`
  if (fixableErrors + fixableWarnings > 0) {
    out += `  ${fixableErrors} ${fixableErrors === 1 ? 'error' : 'errors'} and ${fixableWarnings} ${fixableWarnings === 1 ? 'warning' : 'warnings'} potentially fixable with the \`--fix\` option.\n`
  }
  return out
}
