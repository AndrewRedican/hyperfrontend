/**
 * Finds and loads a configuration: the nearest `lint.config.ts` at or above a directory, a
 * TypeScript module whose default export is the ordered list of blocks, imported with Node's
 * type stripping. A project's file usually spreads the workspace's base blocks into its own.
 *
 * @module config/load
 */

import type { ConfigBlock } from './model'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { errorText } from '../engine/error-text'

/** The name of a configuration file. */
export const CONFIG_FILE = 'lint.config.ts'

/** A module as `import()` returns it. */
interface ConfigModule {
  /** The default export, whatever it is. */
  readonly default?: unknown
}

/**
 * The nearest configuration file at or above a directory.
 *
 * @param directory - The absolute directory the search starts in
 * @returns The absolute path of the file, or null when no directory up to the filesystem root has one
 *
 * @example Find the configuration a project directory uses
 * ```ts
 * findConfigFile('/repo/libs/app/src') // => '/repo/libs/app/lint.config.ts'
 * findConfigFile('/tmp/empty') // => null when no directory up to the root has one
 * ```
 */
export function findConfigFile(directory: string): string | null {
  let current = directory
  while (!existsSync(join(current, CONFIG_FILE))) {
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
  return join(current, CONFIG_FILE)
}

/**
 * Imports a configuration module and checks its shape.
 *
 * @param file - The absolute path of the module
 * @returns Its blocks
 * @throws {Error} When the module cannot be imported or its default export is not a list of blocks
 *
 * @example Load the blocks of a configuration file
 * ```ts
 * const blocks = await loadConfig('/repo/lint.config.ts')
 * blocks.length // => the number of blocks its default export lists
 * ```
 */
export async function loadConfig(file: string): Promise<readonly ConfigBlock[]> {
  let module: ConfigModule
  try {
    module = (await import(pathToFileURL(file).href)) as ConfigModule
  } catch (error) {
    throw createError(`Cannot load the configuration ${file}: ${errorText(error)}`)
  }
  const blocks = module.default
  if (!isArray(blocks) || blocks.some((block) => typeof block !== 'object' || block === null)) {
    throw createError(`The configuration ${file} does not export a list of configuration blocks`)
  }
  return blocks as readonly ConfigBlock[]
}
