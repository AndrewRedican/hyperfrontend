import type { Tree } from '../../model'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { EXIT_OK, runInit } from '../../../cli'
import { headlessFlags } from '../../shared/flags'

/** Options for the `feature` generator; mirrors `schema.json`. */
interface FeatureGeneratorSchema {
  /** Feature name. */
  name: string
  /** Path to the feature contract file, relative to the target directory. */
  contract: string
  /** Entry file the generated glue import is wired into. */
  entry: string
  /** Directory to scaffold into, relative to the workspace root. Defaults to the root. */
  directory?: string
  /** Feature version string. */
  version?: string
  /** URL the generated shell loads the feature from. */
  url?: string
}

/**
 * Scaffold a hyperfrontend feature by delegating to the SDK's `hf init`.
 *
 * The generator is a thin wrapper: it resolves the target directory from the
 * workspace tree and forwards options to `runInit` in headless mode, which owns
 * config resolution, contract loading, entry wiring, and writing to disk.
 *
 * @param tree - The Nx virtual file-system tree, used only to resolve the root.
 * @param options - Generator options forwarded to the SDK runner.
 * @returns A promise that resolves once scaffolding completes.
 * @throws {Error} When the underlying `hf init` run exits non-zero.
 *
 * @example Scaffold a feature in a project directory
 * ```bash
 * nx generate \@hyperfrontend/features:feature \
 *   --name=clock --contract=./clock.contract.json --entry=./src/main.ts --directory=apps/clock
 * ```
 */
export async function featureGenerator(tree: Tree, options: FeatureGeneratorSchema): Promise<void> {
  const code = await runInit({
    flags: headlessFlags({
      name: options.name,
      contract: options.contract,
      entry: options.entry,
      version: options.version,
      url: options.url,
    }),
    cwd: join(tree.root, options.directory ?? '.'),
    stdout: process.stdout,
    stderr: process.stderr,
  })
  if (code !== EXIT_OK) {
    throw createError(`hf init failed with exit code ${code}.`)
  }
}

export default featureGenerator
