/**
 * The places the development scripts read and write: the workspace, the linter's project and
 * the oracle directory under the git-ignored `_/`.
 *
 * @module scripts/lib/paths
 */

import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** The workspace root, four directories above this file. */
export const WORKSPACE_ROOT: string = resolve(import.meta.dirname, '..', '..', '..', '..')

/** `tools/lint`, the new linter's project. */
export const LINT_ROOT: string = join(WORKSPACE_ROOT, 'tools', 'lint')

/** Where captures, inputs and comparisons live; git ignores `_/`. */
export const ORACLE_DIR: string = join(WORKSPACE_ROOT, '_', 'linting-reimplementation', 'oracle')

/**
 * The directory of one capture label, created on first use.
 *
 * @param label - A short name such as `o0` that groups a capture with its inputs and comparisons
 * @returns The absolute directory
 */
export function labelDir(label: string): string {
  const dir = join(ORACLE_DIR, label)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Writes a line to standard output.
 *
 * @param line - The text, without its newline
 */
export function say(line: string): void {
  process.stdout.write(`${line}\n`)
}
