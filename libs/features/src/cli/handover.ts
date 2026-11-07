import type { RunFeaturesCliOptions } from './bin'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { EXIT_ERROR } from './exit-codes'

/** The entry of the workspace package that runs its command line. */
export const WORKSPACE_CLI = '@hyperfrontend/workspace/cli'

/** The oldest Node.js major the workspace command line runs on. */
export const WORKSPACE_NODE_MAJOR = 24

/** The workspace package's command line, as far as this one calls it. */
export interface WorkspaceCli {
  /** Runs the workspace's command line and resolves to its exit code. */
  readonly runWorkspaceCli: (options: RunFeaturesCliOptions) => Promise<number>
}

/** What a handover reads of the process it runs in. */
export interface HandoverHost {
  /** The file of the workspace command line as the working directory resolves it, or null when the package is not installed. */
  readonly resolve: (cwd: string) => string | null
  /** Loads the workspace command line from its file. */
  readonly load: (file: string) => Promise<WorkspaceCli>
  /** The running Node.js version, as `process.versions.node` gives it. */
  readonly nodeVersion: string
}

/**
 * The handover host of the running process: the workspace command line is resolved from the
 * directory the command was run in, the way Node resolves any installed package.
 *
 * @param entry - The package entry that holds the command line.
 * @returns How this process resolves and loads that entry, with its Node.js version.
 *
 * @example Checking whether the workspace package is installed in a project
 * ```typescript
 * const installed = processHost().resolve(process.cwd()) !== null
 * ```
 */
export function processHost(entry: string = WORKSPACE_CLI): HandoverHost {
  return {
    resolve: (cwd) => {
      try {
        return createRequire(join(cwd, 'package.json')).resolve(entry)
      } catch {
        return null
      }
    },
    load: (file) => import(pathToFileURL(file).href) as Promise<WorkspaceCli>,
    nodeVersion: process.versions.node,
  }
}

/**
 * Passes a command this command line does not own to the workspace command line, when
 * `@hyperfrontend/workspace` is installed where the command was run. The two packages share the
 * `hf` name, so whichever executable npm linked answers for both.
 *
 * @param options - The invocation, passed on as it was received.
 * @param host - How the workspace package is found and loaded.
 * @returns The exit code of the workspace command line, an error code when it needs a newer Node.js, or null when the package is not installed.
 *
 * @example Passing `hf run lib-a:test` on to the workspace command line
 * ```typescript
 * const code = await handOver({ argv: ['run', 'lib-a:test'], cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr })
 * if (code === null) process.stderr.write('Unknown command: run\n')
 * ```
 */
export async function handOver(options: RunFeaturesCliOptions, host: HandoverHost = processHost()): Promise<number | null> {
  const file = host.resolve(options.cwd)
  if (file === null) return null
  if (Number(host.nodeVersion.split('.')[0]) < WORKSPACE_NODE_MAJOR) {
    options.stderr.write(`The workspace commands of hf need Node.js ${WORKSPACE_NODE_MAJOR} or later; this is ${host.nodeVersion}.\n`)
    return EXIT_ERROR
  }
  const { runWorkspaceCli } = await host.load(file)
  return runWorkspaceCli({ ...options, handedOver: true })
}
