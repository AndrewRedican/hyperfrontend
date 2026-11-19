/**
 * What a reader is shown of a task's time and output: its duration in words, where its log is
 * kept, and the part of a failed task's log that explains the failure.
 *
 * @module progress/log
 */

import { posix } from 'node:path'
import { max, round, trunc } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How many lines of a failed task's output are shown. */
export const EXCERPT_LINES = 60

/**
 * A duration as a reader sees it.
 *
 * @param ms - Milliseconds
 * @returns The duration in the largest units that fit
 *
 * @example Tenths under ten seconds, whole seconds under a minute
 * ```typescript
 * import { formatDuration } from '@hyperfrontend/workspace/progress'
 *
 * formatDuration(800) // => '0.8s'
 * formatDuration(47_000) // => '47s'
 * formatDuration(1_097_000) // => '18m 17s'
 * ```
 */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 10) return `${round(seconds * 10) / 10}s`
  if (seconds < 60) return `${round(seconds)}s`
  const minutes = trunc(seconds / 60)
  return `${minutes}m ${round(seconds - minutes * 60)}s`
}

/**
 * The log file of a task, under a log directory.
 *
 * @param id - The task, `<project>:<target>`
 * @param directory - The directory, workspace-relative and POSIX
 * @returns The path, workspace-relative and POSIX
 *
 * @example The colon of a task id never reaches a file name
 * ```typescript
 * import { taskLogPath } from '@hyperfrontend/workspace/progress'
 *
 * taskLogPath('lib-core:build', '.hf/logs') // => '.hf/logs/lib-core__build.log'
 * ```
 */
export function taskLogPath(id: string, directory: string): string {
  return posix.join(directory, `${id.replace(/[^A-Za-z0-9._-]/g, '__')}.log`)
}

/**
 * The part of a failed task's output that explains the failure: from the test runner's list of
 * failing tests up to its coverage table when it printed one, else the last lines.
 *
 * @param log - Everything the task printed
 * @param limit - The most lines kept
 * @returns The lines, or null when the task printed nothing
 *
 * @example The end of the output, unless the test runner listed its failing tests
 * ```typescript
 * import { failureExcerpt } from '@hyperfrontend/workspace/progress'
 *
 * failureExcerpt('one\ntwo\nthree\n', 2) // => 'two\nthree'
 * failureExcerpt('✔ passes\n✖ failing tests:\n✖ breaks\nfile | line %') // => '✖ failing tests:\n✖ breaks'
 * failureExcerpt('') // => null
 * ```
 */
export function failureExcerpt(log: string, limit: number = EXCERPT_LINES): string | null {
  const lines = log.trimEnd().split(/\r?\n/)
  if (lines.length === 1 && lines[0] === '') return null
  const failing = lines.findIndex((line) => /failing tests:\s*$/.test(line))
  if (failing === -1) return lines.slice(max(0, lines.length - limit)).join('\n')
  const coverage = lines.findIndex((line, index) => index > failing && /^file\s+\|/.test(line))
  return lines
    .slice(failing, coverage === -1 ? undefined : coverage)
    .slice(0, limit)
    .join('\n')
}
