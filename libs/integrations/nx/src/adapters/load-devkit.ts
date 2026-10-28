/**
 * Loads the `@nx/devkit` a workspace installed, when it has one, without ever importing it
 * statically: the package is resolved from anchors a caller names, so a workspace without it is
 * an expected outcome rather than a failed import.
 *
 * @module adapters/load-devkit
 */

import { createRequire } from 'node:module'
import { join } from 'node:path'

/** The exports of a resolved `@nx/devkit`, read member by member. */
export type DevkitModule = Readonly<Record<string, unknown>>

/** Resolves `@nx/devkit` from an anchor file path; throws when it is not resolvable from there. */
export type DevkitResolver = (anchor: string) => unknown

/** How a load looks for the package. */
export interface LoadDevkitOptions {
  /** Further anchor files tried after the workspace root's `package.json`, such as a plugin's own module path for hoisted layouts. */
  readonly anchors?: readonly string[]
  /** The resolution boundary; defaults to a `createRequire` bound to each anchor. */
  readonly resolve?: DevkitResolver
}

/**
 * Loads `@nx/devkit` through a `createRequire` bound to the anchor.
 *
 * @param anchor - The file path resolution starts from; the file itself need not exist
 * @returns Whatever the resolved module exports
 */
function requireDevkit(anchor: string): unknown {
  return createRequire(anchor)('@nx/devkit')
}

/**
 * Loads the workspace's `@nx/devkit`, trying the workspace root first so the copy matched to the
 * workspace's own `nx` wins, then every further anchor in order.
 *
 * @param workspaceRoot - The absolute root of the workspace
 * @param options - Further anchors and the resolution boundary
 * @returns The module's exports, or null when no anchor resolves a module object
 *
 * @example Formatting with the consumer's devkit when it is installed
 * ```typescript
 * const devkit = loadDevkit(tree.root, { anchors: [pluginModulePath] })
 * const formatFiles = devkit === null ? null : devkitFunction<(tree: Tree) => Promise<void>>(devkit, 'formatFiles')
 * if (formatFiles !== null) await formatFiles(tree)
 * ```
 */
export function loadDevkit(workspaceRoot: string, options: LoadDevkitOptions = {}): DevkitModule | null {
  const resolve = options.resolve ?? requireDevkit
  for (const anchor of [join(workspaceRoot, 'package.json'), ...(options.anchors ?? [])]) {
    let resolved: unknown
    try {
      resolved = resolve(anchor)
    } catch {
      // note: not resolvable from this anchor; the next one may still find it.
      continue
    }
    if (typeof resolved === 'object' && resolved !== null) return resolved as DevkitModule
  }
  return null
}

/**
 * One function of a loaded devkit, when the module exposes it as a function.
 *
 * @param module - The loaded module
 * @param name - The export's name
 * @returns The function, or null when the export is absent or not callable
 */
export function devkitFunction<TFunction extends (...args: never[]) => unknown>(module: DevkitModule, name: string): TFunction | null {
  const member = module[name]
  return typeof member === 'function' ? (member as TFunction) : null
}
