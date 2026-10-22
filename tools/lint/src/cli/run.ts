/**
 * The command's flow: parse the arguments, find and load the nearest configuration, pick the
 * files, lint each with the rules in effect for it (loaded on first use), write fixes, print the
 * report and answer with an exit code: 0 clean, 1 problems, 2 the command could not run or a
 * file could not be linted.
 *
 * @module cli/run
 */

import type { FileResult, Message } from '../engine/report.ts'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, posix, relative, resolve, sep } from 'node:path'
import { findConfigFile, loadConfig } from '../config/load.ts'
import { effectiveConfig, isIgnored, projectConfig, selectsFile } from '../config/resolve.ts'
import { errorText } from '../engine/error-text.ts'
import { lintFile } from '../engine/lint-file.ts'
import { loadRules } from '../engine/registry.ts'
import { enumerateFiles } from '../files/enumerate.ts'
import { formatJson } from '../output/json.ts'
import { formatStylish } from '../output/stylish.ts'
import { USAGE, parseArgs } from './args.ts'

/** Where the command runs and how it talks to the world. */
export interface RunEnvironment {
  /** The working directory, which is the project root. */
  readonly cwd: string
  /** Standard input, read when `--stdin` is given. */
  readonly readStdin: () => string
  /** Writes to standard output. */
  readonly write: (text: string) => void
  /** Writes to standard error. */
  readonly writeError: (text: string) => void
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
      ? 'File ignored because of a matching ignore pattern. Use "--no-ignore" to disable file ignore settings or use "--no-warn-ignored" to suppress this warning.'
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
 * Runs the command.
 *
 * @param argv - The arguments after the command
 * @param environment - The working directory and streams
 * @returns The exit code
 */
export async function run(argv: readonly string[], environment: RunEnvironment): Promise<number> {
  const options = parseArgs(argv)
  if ('error' in options) {
    environment.writeError(`${options.error}\n${USAGE}`)
    return 2
  }
  if (options.help) {
    environment.write(USAGE)
    return 0
  }
  const root = resolve(environment.cwd)
  const configFile = options.config === null ? findConfigFile(root) : resolve(root, options.config)
  if (configFile === null) {
    environment.writeError('Could not find config file.\n')
    return 2
  }
  // why: a configuration found by the search is relative to its own directory, one named by `--config` to the working directory, as flat configurations resolve them.
  const base = options.config === null ? dirname(configFile) : root
  let project: ReturnType<typeof projectConfig>
  try {
    project = projectConfig(await loadConfig(configFile))
  } catch (error) {
    environment.writeError(`${errorText(error)}\n`)
    return 2
  }
  let files: readonly LintTarget[]
  if (options.stdin) {
    if (options.stdinFilename === null || options.stdinFilename === '') {
      environment.writeError('--stdin needs --stdin-filename\n')
      return 2
    }
    if (options.fix) {
      environment.writeError('--fix cannot write piped-in code; use --fix-dry-run\n')
      return 2
    }
    files = [{ path: resolve(root, options.stdinFilename), explicit: true, text: environment.readStdin() }]
  } else {
    const enumeration = enumerateFiles(options.patterns.length === 0 ? ['.'] : options.patterns, root)
    if (enumeration.unmatched.length > 0 && options.errorOnUnmatchedPattern) {
      environment.writeError(`No files matching ${enumeration.unmatched[0]} were found.\n`)
      return 2
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
    let outcome: ReturnType<typeof lintFile>
    try {
      const rules = await loadRules([...config.rules.keys()])
      outcome = lintFile(
        { path: file.path, root, relativePath: toPosix(relative(root, file.path)), text: file.text },
        { config, rules, fix: options.fix || options.fixDryRun }
      )
    } catch (error) {
      environment.writeError(`Error while linting ${file.path}: ${errorText(error)}\n`)
      return 2
    }
    if (options.fix && outcome.output !== null) writeFileSync(file.path, outcome.output)
    results.push({ filePath: file.path, messages: outcome.messages, output: options.fixDryRun ? outcome.output : null })
  }
  environment.write(options.format === 'json' ? `${formatJson(results)}\n` : formatStylish(results))
  const errors = results.reduce((sum, result) => sum + result.messages.filter((message) => message.severity === 2).length, 0)
  const warnings = results.reduce((sum, result) => sum + result.messages.filter((message) => message.severity === 1).length, 0)
  return errors > 0 || (options.maxWarnings >= 0 && warnings > options.maxWarnings) ? 1 : 0
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
