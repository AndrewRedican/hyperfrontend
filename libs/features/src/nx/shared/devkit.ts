import type { Tree } from '../model'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { currentModuleDir } from '../../server/module-dir'

/** Formats every staged tree change with the consumer's own formatter setup. */
export type FormatFilesFn = (tree: Tree) => Promise<void>

/** Synchronously runs the consumer's package-manager install against the flushed workspace. */
export type InstallPackagesTaskFn = (tree: Tree) => void

/** Resolves the `@nx/devkit` module from an anchor file path; throws when unresolvable. */
export type DevkitResolver = (anchor: string) => unknown

/**
 * The `@nx/devkit` surface the adapter consumes.
 *
 * Members are typed against the adapter's own minimal {@link Tree} shape: the
 * real Nx tree Nx hands to generators satisfies the extra members at runtime.
 */
export interface DevkitApi {
  /** Formats staged tree changes; absent when the resolved module does not expose it as a function. */
  formatFiles?: FormatFilesFn
  /** Runs the consumer's package-manager install; absent when the resolved module does not expose it as a function. */
  installPackagesTask?: InstallPackagesTaskFn
}

/**
 * Default resolver: load `@nx/devkit` through a `createRequire` bound to the anchor.
 *
 * @param anchor - File path resolution starts from; the file itself need not exist.
 * @returns Whatever the resolved module exports.
 */
function requireDevkit(anchor: string): unknown {
  return createRequire(anchor)('@nx/devkit')
}

/**
 * Narrow a resolved module to the {@link DevkitApi} members that are actually functions.
 *
 * @param candidate - The resolved module's exports.
 * @returns The API with each member present only when callable, or `null` when
 * the resolved value is not a module object at all.
 */
function toDevkitApi(candidate: unknown): DevkitApi | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const moduleExports = <Record<string, unknown>>candidate
  const api: DevkitApi = {}
  if (typeof moduleExports['formatFiles'] === 'function') {
    api.formatFiles = <FormatFilesFn>moduleExports['formatFiles']
  }
  if (typeof moduleExports['installPackagesTask'] === 'function') {
    api.installPackagesTask = <InstallPackagesTaskFn>moduleExports['installPackagesTask']
  }
  return api
}

/**
 * Optionally load the consumer workspace's `@nx/devkit`.
 *
 * Resolution is anchored at the consumer's root `package.json` first, so the
 * devkit copy the consumer installed (and version-matched to their `nx`) wins;
 * when that fails, a second anchor beside the running plugin module covers
 * hoisted layouts where devkit sits above the plugin instead of the root.
 * `@nx/devkit` is never a declared dependency of this package, so a `null`
 * result is an expected outcome (pnpm isolated layouts, minimal installs) and
 * callers fall back to built-in equivalents.
 *
 * @param workspaceRoot - Absolute root of the consumer workspace.
 * @param resolveDevkit - Resolution boundary, injectable for tests; defaults to a `createRequire` load.
 * @returns The typed devkit surface, or `null` when no anchor resolves a module object.
 *
 * @example Preferring the consumer's devkit with a built-in fallback
 * ```typescript
 * const devkit = loadDevkit(tree.root)
 * if (devkit?.formatFiles !== undefined) {
 *   await devkit.formatFiles(tree)
 * }
 * ```
 */
export function loadDevkit(workspaceRoot: string, resolveDevkit: DevkitResolver = requireDevkit): DevkitApi | null {
  // how: consumer-root resolution first, then plugin-location resolution for hoisted layouts.
  const anchors = [join(workspaceRoot, 'package.json'), join(currentModuleDir(), 'package.json')]
  for (const anchor of anchors) {
    let resolved: unknown
    try {
      resolved = resolveDevkit(anchor)
    } catch {
      // note: `@nx/devkit` is not resolvable from this anchor; try the next one.
      continue
    }
    const api = toDevkitApi(resolved)
    if (api !== null) {
      return api
    }
  }
  return null
}
