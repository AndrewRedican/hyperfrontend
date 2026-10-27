/**
 * Formats the workspace with prettier, `format --check|--write [--all | --files=<list>]`: every
 * file git tracks or would track under `--all`, the named files under `--files`, and otherwise the
 * files changed from the last commit (staged, unstaged and untracked). Every ignore file of git
 * applies through its listing; prettier also skips what `.prettierignore` lists and any file it
 * has no parser for.
 *
 * @module runner/format
 */

import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** What the command line expects. */
export const FORMAT_USAGE = 'usage: hf format --check|--write [--all | --files=<path[,path]>]'

/** How many files one prettier run receives, so no command line outgrows the platform's limit. */
export const FILES_PER_RUN = 400

/** The mode and the files of one `format` call. */
export interface FormatRequest {
  /** Whether files are rewritten, rather than checked. */
  readonly write: boolean
  /** The files named, every file (`all`), or the changed files (`changed`). */
  readonly scope: 'all' | 'changed' | readonly string[]
}

/**
 * Reads the command line of `format`.
 *
 * @param argv - The arguments after `format`
 * @returns The request
 * @throws {Error} When neither or both of `--check` and `--write` are given, or an argument is unknown
 */
export function parseFormatArgs(argv: readonly string[]): FormatRequest {
  let check = false
  let write = false
  let scope: FormatRequest['scope'] = 'changed'
  for (const arg of argv) {
    if (arg === '--check') check = true
    else if (arg === '--write') write = true
    else if (arg === '--all') scope = 'all'
    else if (arg.startsWith('--files='))
      scope = arg
        .slice('--files='.length)
        .split(',')
        .filter((file) => file !== '')
    else throw createError(`unknown argument ${arg}`)
  }
  if (check === write) throw createError('pass exactly one of --check and --write')
  return { write, scope }
}

/**
 * The paths of a `git status --porcelain -z` listing that still exist as files to format: added,
 * modified, renamed (the new path) and untracked; deleted paths are left out.
 *
 * @param porcelain - The listing, NUL-separated entries
 * @returns The workspace-relative paths
 */
export function changedFiles(porcelain: string): string[] {
  const entries = porcelain.split('\0')
  const files: string[] = []
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index] as string
    if (entry.length < 4) continue
    const status = entry.slice(0, 2)
    // why: a rename or copy lists its source path as the next entry, which is not a file anymore
    if (status.includes('R') || status.includes('C')) index++
    if (status.includes('D')) continue
    files.push(entry.slice(3))
  }
  return files
}

/**
 * The prettier runs of a request, each one's arguments; none when there is nothing to format.
 *
 * @param request - Whether to write and which files
 * @param list - Lists every file (`all`) or the changed files (`changed`), workspace-relative
 * @returns The arguments after `prettier`, one list per run
 */
export function prettierRuns(request: FormatRequest, list: (scope: 'all' | 'changed') => readonly string[]): string[][] {
  const files = typeof request.scope === 'string' ? list(request.scope) : request.scope
  const runs: string[][] = []
  for (let start = 0; start < files.length; start += FILES_PER_RUN) {
    runs.push([
      request.write ? '--write' : '--check',
      '--ignore-unknown',
      '--log-level=warn',
      '--',
      ...files.slice(start, start + FILES_PER_RUN),
    ])
  }
  return runs
}
