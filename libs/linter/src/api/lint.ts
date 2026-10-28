/**
 * Linting as a function: find and load the configuration, pick the files, lint each with the
 * rules in effect for it and answer with the results. Nothing is printed and nothing is written;
 * the command builds on this and adds the arguments, the report, the written fixes and the exit
 * code.
 *
 * @module api/lint
 */

import type { FileResult, Message } from '../engine/report'
import { readFileSync } from 'node:fs'
import { dirname, posix, relative, resolve, sep } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { findConfigFile, loadConfig } from '../config/load'
import { effectiveConfig, isIgnored, projectConfig, selectsFile } from '../config/resolve'
import { errorText } from '../engine/error-text'
import { lintFile } from '../engine/lint-file'
import { enumerateFiles } from '../files/enumerate'

/** A text to lint in place of files, as `--stdin` reads it. */
export interface LintText {
  /** The path the text is linted as, relative to the working directory or absolute. */
  readonly path: string
  /** The text. */
  readonly text: string
}

/** What to lint and how. */
export interface LintRequest {
  /** The working directory: the project root the files are linted under, where the configuration search starts and what relative paths are resolved against. */
  readonly cwd: string
  /** Files, directories or globs to lint, relative to `cwd`; absent or empty, `cwd` itself. Ignored when `text` is given. */
  readonly patterns?: readonly string[]
  /** A configuration module to load, relative to `cwd`, in place of the nearest `lint.config.ts`; its globs are then relative to `cwd`. */
  readonly config?: string
  /** Whether to apply fixes; each result's `output` then holds the fixed text, or null when nothing changed. Nothing is written. */
  readonly fix?: boolean
  /** A text to lint in place of files. */
  readonly text?: LintText
  /** Whether a pattern that names no file is an error; true when absent. */
  readonly errorOnUnmatchedPattern?: boolean
}

/** What a lint produced. */
export interface LintReport {
  /** One result per file, in the order the files were linted. */
  readonly results: readonly FileResult[]
  /** The errors across all results. */
  readonly errorCount: number
  /** The warnings across all results. */
  readonly warningCount: number
}

/** One file to lint. */
interface LintTarget {
  /** The absolute path. */
  readonly path: string
  /** True when the file itself was named, so that it is answered for even when ignored. */
  readonly explicit: boolean
  /** The text to lint. */
  readonly text: string
}

/**
 * Lints files, or a text, with the configuration that applies to them.
 *
 * @param request - The working directory, what to lint and how
 * @returns The results and their totals
 * @throws {Error} When no configuration is found or it cannot be loaded, a pattern names no file, or a file cannot be linted
 *
 * @example Lint a project and count its errors
 * ```ts
 * import { lint } from '@hyperfrontend/linter'
 *
 * const report = await lint({ cwd: process.cwd(), patterns: ['src'] })
 * console.log(`${report.errorCount} errors, ${report.warningCount} warnings`)
 * ```
 */
export async function lint(request: LintRequest): Promise<LintReport> {
  const root = resolve(request.cwd)
  const configFile = request.config === undefined ? findConfigFile(root) : resolve(root, request.config)
  if (configFile === null) throw createError('Could not find config file.')
  // why: a configuration found by the search is relative to its own directory, one named explicitly to the working directory, as flat configurations resolve them.
  const base = request.config === undefined ? dirname(configFile) : root
  const project = projectConfig(await loadConfig(configFile))
  let files: readonly LintTarget[]
  if (request.text !== undefined) {
    files = [{ path: resolve(root, request.text.path), explicit: true, text: request.text.text }]
  } else {
    const patterns = request.patterns === undefined || request.patterns.length === 0 ? ['.'] : request.patterns
    const enumeration = enumerateFiles(patterns, root)
    if (enumeration.unmatched.length > 0 && request.errorOnUnmatchedPattern !== false) {
      throw createError(`No files matching ${enumeration.unmatched[0]} were found.`)
    }
    files = enumeration.files
      .filter((file) => file.explicit || selectsFile(project, toPosix(relative(base, file.path))))
      .map((file) => ({ ...file, text: readFileSync(file.path, 'utf8') }))
  }
  const results: FileResult[] = []
  for (const file of files) {
    const configPath = toPosix(relative(base, file.path))
    if (file.explicit && !selectsFile(project, configPath)) {
      results.push({ filePath: file.path, messages: [ignoredFile(isIgnored(project, configPath))], output: null })
      continue
    }
    const config = effectiveConfig(project, configPath)
    try {
      const rules = await project.registry.load([...config.rules.keys()])
      const outcome = lintFile(
        { path: file.path, root, relativePath: toPosix(relative(root, file.path)), text: file.text },
        { config, rules, fix: request.fix === true, knownRule: project.registry.has }
      )
      results.push({ filePath: file.path, messages: outcome.messages, output: outcome.output })
    } catch (error) {
      throw createError(`Error while linting ${file.path}: ${errorText(error)}`, { cause: error })
    }
  }
  return {
    results,
    errorCount: results.reduce((sum, result) => sum + result.messages.filter((message) => message.severity === 2).length, 0),
    warningCount: results.reduce((sum, result) => sum + result.messages.filter((message) => message.severity === 1).length, 0),
  }
}

/**
 * The warning the linter answers for a file it was asked about but does not lint.
 *
 * @param ignored - True when an ignore pattern matched, false when no configuration selects the file
 * @returns The warning message, without a position
 */
function ignoredFile(ignored: boolean): Message {
  return {
    ruleId: null,
    severity: 1,
    message: ignored
      ? 'File ignored because of a matching ignore pattern.'
      : 'File ignored because no matching configuration was supplied.',
    line: null,
    column: null,
    endLine: null,
    endColumn: null,
    fatal: false,
    fix: null,
    suggestions: [],
  }
}

/**
 * A native relative path as a POSIX one.
 *
 * @param path - A path with the platform's separators
 * @returns The same path with `/`
 */
function toPosix(path: string): string {
  return path.split(sep).join(posix.sep)
}
