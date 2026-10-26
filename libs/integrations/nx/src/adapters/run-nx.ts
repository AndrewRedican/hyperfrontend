/**
 * Runs the Nx a checkout installed, headless: no daemon, no cloud runner, no terminal UI and the
 * task-level affected selection on, so a command reads exactly that checkout and prints what it
 * is asked for.
 *
 * @module adapters/run-nx
 */

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJsonFile } from '@hyperfrontend/project-scope/core'

/** Runs one Nx command and returns its standard output. */
export type NxCommandRunner = (args: readonly string[]) => string

/** Runs an executable with arguments and returns its standard output; `execFileSync` with `encoding: 'utf8'` is one. */
export type ExecFile = (file: string, args: readonly string[], options: ExecFileOptions) => string

/** What the runner passes to the executable. */
export interface ExecFileOptions {
  /** The directory the command runs in. */
  readonly cwd: string
  /** The output encoding; always `utf8`. */
  readonly encoding: 'utf8'
  /** How much output the command may print. */
  readonly maxBuffer: number
  /** Standard input ignored, output and errors piped. */
  readonly stdio: readonly ['ignore', 'pipe', 'pipe']
  /** The environment, with the headless settings applied. */
  readonly env: Readonly<Record<string, string | undefined>>
}

/** How a runner is built. */
export interface NxRunnerOptions {
  /** Environment entries set on top of the process environment and the headless settings. */
  readonly env?: Readonly<Record<string, string>>
  /** The process boundary; defaults to `execFileSync`. */
  readonly exec?: ExecFile
  /** How much output one command may print; 64 MiB by default. */
  readonly maxBuffer?: number
}

/** The fields of Nx's own manifest the runner reads. */
interface NxManifest {
  /** The executables, by name. */
  readonly bin?: Readonly<Record<string, string>>
}

/** The environment that keeps an Nx command headless and on the task-level selection. */
export const HEADLESS_NX_ENV = freeze({ NX_DAEMON: 'false', NX_LEGACY_AFFECTED: 'false', NX_NO_CLOUD: 'true', NX_TUI: 'false' })

/** How much output one Nx command may print before the runner gives up. */
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024 * 1024

/**
 * The Nx executable a checkout installed, read from Nx's own manifest.
 *
 * @param checkout - The absolute path of the checkout
 * @returns The absolute path of the executable
 */
export function nxExecutable(checkout: string): string {
  const nx = join(checkout, 'node_modules', 'nx')
  return join(nx, readJsonFile<NxManifest>(join(nx, 'package.json')).bin?.['nx'] ?? 'bin/nx.js')
}

/**
 * A runner for the Nx installed under a checkout's `node_modules`.
 *
 * @param checkout - The absolute path of the checkout
 * @param options - Environment, process boundary and output limit
 * @returns A runner whose output is the command's standard output
 *
 * @example Listing the affected projects of a checkout
 * ```typescript
 * const run = nxRunner(checkout)
 * const projects = runNxJson<string[]>(run, ['show', 'projects', '--affected', '--json'])
 * ```
 */
export function nxRunner(checkout: string, options: NxRunnerOptions = {}): NxCommandRunner {
  const exec = options.exec ?? (execFileSync as unknown as ExecFile)
  const bin = nxExecutable(checkout)
  return (args) =>
    exec(process.execPath, [bin, ...args], {
      cwd: checkout,
      encoding: 'utf8',
      maxBuffer: options.maxBuffer ?? DEFAULT_MAX_OUTPUT_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...HEADLESS_NX_ENV, ...options.env },
    })
}

/**
 * Runs an Nx command that prints JSON and parses what it printed.
 *
 * @param run - The runner
 * @param args - The command's arguments, which must make it print JSON
 * @returns The parsed output
 * @throws {Error} When the output is not JSON
 */
export function runNxJson<TValue>(run: NxCommandRunner, args: readonly string[]): TValue {
  const output = run(args)
  try {
    return parse(output) as TValue
  } catch {
    throw createError(`nx ${args.join(' ')} did not print JSON: ${output.slice(0, 200)}`)
  }
}
