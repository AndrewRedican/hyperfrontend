/**
 * The JSON report: one object per file with its messages, counts and, when fixes were applied in
 * a dry run, the fixed text. The shape is the one the parity harness reads.
 *
 * @module output/json
 */

import type { FileResult, Message } from '../engine/report'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** A fix as printed: the replaced range as a pair of offsets. */
interface JsonFix {
  /** The start and end offsets replaced. */
  readonly range: readonly [number, number]
  /** The replacement. */
  readonly text: string
}

/** A suggestion as printed. */
interface JsonSuggestion {
  /** What applying it does, in words. */
  readonly desc: string
  /** The replacement. */
  readonly fix: JsonFix
}

/** A message as printed. */
interface JsonMessage {
  /** The rule id, or null for a fatal problem. */
  readonly ruleId: string | null
  /** 1 for a warning, 2 for an error. */
  readonly severity: 1 | 2
  /** The text shown to the user. */
  readonly message: string
  /** The 1-based start line, when the problem has a position. */
  readonly line?: number
  /** The 1-based start column, when the problem has a position. */
  readonly column?: number
  /** The 1-based end line, when the problem has a range. */
  readonly endLine?: number
  /** The 1-based end column, when the problem has a range. */
  readonly endColumn?: number
  /** Present, and true, for a fatal problem. */
  readonly fatal?: true
  /** The fix, when one was offered. */
  readonly fix?: JsonFix
  /** The suggestions, when any were offered. */
  readonly suggestions?: readonly JsonSuggestion[]
}

/**
 * Formats results as JSON.
 *
 * @param results - One result per file
 * @returns One line of JSON
 *
 * @example Print a report for another tool to read
 * ```ts
 * import { formatJson, lint } from '@hyperfrontend/linter'
 *
 * const { results } = await lint({ cwd: process.cwd() })
 * process.stdout.write(`${formatJson(results)}\n`)
 * ```
 */
export function formatJson(results: readonly FileResult[]): string {
  return stringify(
    results.map((result) => {
      const messages = result.messages.map(toJsonMessage)
      const errors = result.messages.filter((message) => message.severity === 2)
      const warnings = result.messages.filter((message) => message.severity === 1)
      return {
        filePath: result.filePath,
        messages,
        suppressedMessages: [],
        errorCount: errors.length,
        fatalErrorCount: errors.filter((message) => message.fatal).length,
        warningCount: warnings.length,
        fixableErrorCount: errors.filter((message) => message.fix !== null).length,
        fixableWarningCount: warnings.filter((message) => message.fix !== null).length,
        ...(result.output === null ? {} : { output: result.output }),
      }
    })
  )
}

/**
 * A message as printed: optional parts left out when absent.
 *
 * @param message - A problem as the engine answered it
 * @returns The same problem as the report prints it
 */
function toJsonMessage(message: Message): JsonMessage {
  return {
    ruleId: message.ruleId,
    severity: message.severity,
    message: message.message,
    ...(message.line === null || message.column === null ? {} : { line: message.line, column: message.column }),
    ...(message.endLine === null || message.endColumn === null ? {} : { endLine: message.endLine, endColumn: message.endColumn }),
    ...(message.fatal ? { fatal: true } : {}),
    ...(message.fix === null ? {} : { fix: { range: [message.fix.start, message.fix.end] as const, text: message.fix.text } }),
    ...(message.suggestions.length === 0
      ? {}
      : {
          suggestions: message.suggestions.map((suggestion) => ({
            desc: suggestion.message,
            fix: { range: [suggestion.fix.start, suggestion.fix.end] as const, text: suggestion.fix.text },
          })),
        }),
  }
}
