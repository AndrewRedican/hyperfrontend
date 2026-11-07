/**
 * The other half of the shared `hf` name. `@hyperfrontend/features` publishes an `hf` executable
 * too, and npm links only one of the two; so each command line passes a command it does not own
 * to the other, when the other is installed, and both answer the same whichever was linked.
 *
 * @module cli/handover
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The entry of the features package that runs its command line. */
export const FEATURES_CLI = '@hyperfrontend/features/cli'

/** Somewhere text is written. */
export interface TextSink {
  /** Writes text. */
  write(text: string): unknown
}

/** One run of a command line, as both packages take it. */
export interface Invocation {
  /** The arguments after the executable's name. */
  readonly argv: readonly string[]
  /** The directory the command line was started in. */
  readonly cwd: string
  /** Where results go. */
  readonly stdout: TextSink
  /** Where the command line's own lines go. */
  readonly stderr: TextSink
  /** Set by the command line that passed this run on, so it is not passed back. */
  readonly handedOver?: boolean
}

/** The features package's command line, as far as this one calls it. */
export interface FeaturesCli {
  /** Runs the features command line and resolves to its exit code. */
  readonly runFeaturesCli: (invocation: Invocation) => Promise<number>
}

/** How the other command line is found and loaded. */
export interface HandoverHost {
  /** The file of the features command line as a directory resolves it, or null when the package is not installed. */
  readonly resolve: (cwd: string) => string | null
  /** Loads the features command line from its file. */
  readonly load: (file: string) => Promise<FeaturesCli>
}

/**
 * The handover host of the running process: the features command line is resolved from the
 * directory the command was run in, the way Node resolves any installed package.
 *
 * @param entry - The package entry that holds the command line
 * @returns How this process resolves and loads that entry
 *
 * @example Resolving the features command line from where the command was run
 * ```typescript
 * const host = processHost()
 * host.resolve('/repo/apps/shell') // => '/repo/node_modules/@hyperfrontend/features/cli/index.js', or null when the package is not installed
 * ```
 */
export function processHost(entry: string = FEATURES_CLI): HandoverHost {
  return {
    resolve: (cwd) => {
      try {
        return createRequire(join(cwd, 'package.json')).resolve(entry)
      } catch {
        return null
      }
    },
    load: (file) => import(pathToFileURL(file).href) as Promise<FeaturesCli>,
  }
}

/**
 * Passes a run on to the features command line, when `@hyperfrontend/features` is installed
 * where the command was run.
 *
 * @param invocation - The run, passed on as it was received
 * @param host - How the features command line is found and loaded
 * @returns The exit code of the features command line, or null when the package is not installed
 *
 * @example Letting the other command line answer a command this one does not own
 * ```typescript
 * import { handOver, processHost } from '@hyperfrontend/workspace/cli'
 *
 * const code = await handOver({ argv: ['pack', '.'], cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr }, processHost())
 * // => the features exit code, or null when @hyperfrontend/features is not installed where the command was run
 * ```
 */
export async function handOver(invocation: Invocation, host: HandoverHost): Promise<number | null> {
  const file = host.resolve(invocation.cwd)
  if (file === null) return null
  const { runFeaturesCli } = await host.load(file)
  return runFeaturesCli({ ...invocation, handedOver: true })
}
