/**
 * The path aliases of a workspace: the `paths` of its `tsconfig.base.json`, each with the first
 * source file it maps to, read once per workspace root.
 *
 * @module rules/workspace/shared/aliases
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** One alias of the base configuration. */
export interface PathAlias {
  /** The alias as imports write it, such as `@scope/pkg/sub`. */
  readonly alias: string
  /** The absolute path of the first file the alias maps to, or null when it maps to none. */
  readonly source: string | null
}

/** The fields of the base configuration the reader uses. */
interface BaseConfig {
  /** The compiler options. */
  readonly compilerOptions?: Readonly<Record<string, unknown>>
}

/** The file that holds the aliases. */
export const BASE_CONFIG = 'tsconfig.base.json'

const aliasesByRoot = createMap<string, readonly PathAlias[]>()
const rootsByDirectory = createMap<string, string | null>()

/**
 * The nearest directory at or above another that holds a `tsconfig.base.json`.
 *
 * @param directory - Where to start
 * @returns That directory, or null when none holds the file
 */
export function baseConfigRootOf(directory: string): string | null {
  const known = rootsByDirectory.get(directory)
  if (known !== undefined) return known
  let current = directory
  let found: string | null = null
  for (;;) {
    if (existsSync(join(current, BASE_CONFIG))) {
      found = current
      break
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  rootsByDirectory.set(directory, found)
  return found
}

/**
 * The aliases a workspace's base configuration declares, in declaration order.
 *
 * @param workspaceRoot - The directory holding `tsconfig.base.json`
 * @returns The aliases, none when the file is missing, unreadable or declares no paths
 */
export function pathAliases(workspaceRoot: string): readonly PathAlias[] {
  const known = aliasesByRoot.get(workspaceRoot)
  if (known !== undefined) return known
  const aliases = readAliases(workspaceRoot)
  aliasesByRoot.set(workspaceRoot, aliases)
  return aliases
}

/**
 * Reads the aliases of a base configuration.
 *
 * @param workspaceRoot - The directory holding the file
 * @returns The aliases found
 */
function readAliases(workspaceRoot: string): PathAlias[] {
  let config: BaseConfig
  try {
    config = parse(readFileSync(join(workspaceRoot, BASE_CONFIG), 'utf8')) as BaseConfig
  } catch {
    return []
  }
  const paths = config.compilerOptions?.['paths']
  if (typeof paths !== 'object' || paths === null || isArray(paths)) return []
  return entries(paths as Record<string, unknown>).map(([alias, targets]) => {
    const first = isArray(targets) ? targets[0] : undefined
    return { alias, source: typeof first === 'string' ? join(workspaceRoot, first) : null }
  })
}
