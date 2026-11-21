/**
 * Loads a workspace's hooks: `hooks.config.ts` at its root and, where a clone keeps one, the
 * untracked `hooks.local.config.ts` beside it.
 *
 * @module git-hooks/load
 */

import type { HooksConfig, LocalHooksConfig } from './config'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describeError, refusal } from '../runner/refusal'
import { checkHooks, checkLocalHooks } from './config'

/** The file holding a workspace's hooks, at its root. */
export const HOOKS_CONFIG = 'hooks.config.ts'

/** The file holding one clone's preferences, at the workspace root and never tracked. */
export const LOCAL_HOOKS_CONFIG = 'hooks.local.config.ts'

/** A workspace's hooks and what this clone changes about them. */
export interface LoadedHooks {
  /** The steps of each hook. */
  readonly config: HooksConfig
  /** This clone's preferences; none where it keeps no local file. */
  readonly local: LocalHooksConfig
}

/** A configuration module, as it is imported. */
interface ConfigModule {
  /** What the file exports by default. */
  readonly default?: unknown
}

/**
 * Imports a configuration file and reads its default export.
 *
 * @param root - The workspace root, absolute
 * @param file - The file's name
 * @param check - Reads the export
 * @returns What the file declares
 * @throws {Error} A refusal naming the file, when it cannot be loaded or declares something else
 */
async function imported<Config>(root: string, file: string, check: (value: unknown) => Config): Promise<Config> {
  try {
    return check(((await import(/* hf-graph: opaque */ pathToFileURL(join(root, file)).href)) as ConfigModule).default)
  } catch (error) {
    throw refusal(`${file}: ${describeError(error)}`)
  }
}

/**
 * Loads the hooks of a workspace.
 *
 * @param root - The workspace root, absolute
 * @returns The configuration, and the local preferences when the clone has any
 * @throws {Error} A refusal when the workspace has no `hooks.config.ts`, or when a file cannot be loaded or read
 *
 * @example Listing the steps a push runs here
 * ```typescript
 * import { loadHooks } from '@hyperfrontend/workspace/git-hooks'
 *
 * const { config, local } = await loadHooks(process.cwd())
 * const skipped = local.skip ?? []
 * (config['pre-push'] ?? []).filter((step) => !skipped.includes(step.name)).map((step) => step.name)
 * // => ['binary-budget', 'audit', 'version-check'] in a clone whose local file skips 'pipeline'
 * ```
 */
export async function loadHooks(root: string): Promise<LoadedHooks> {
  if (!existsSync(join(root, HOOKS_CONFIG))) {
    throw refusal(`no ${HOOKS_CONFIG} at the workspace root: npx hf generate hooks writes one`)
  }
  return {
    config: await imported(root, HOOKS_CONFIG, checkHooks),
    local: existsSync(join(root, LOCAL_HOOKS_CONFIG)) ? await imported(root, LOCAL_HOOKS_CONFIG, checkLocalHooks) : {},
  }
}
