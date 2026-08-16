import { createRequire } from 'node:module'
import { dirname, isAbsolute as nodeIsAbsolute, resolve as nodeResolve } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { exists, readJsonFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { join, normalizeToForwardSlashes } from '@hyperfrontend/project-scope/core/path'

/**
 *
 */
interface DepPackageJson {
  /**
   *
   */
  module?: string
  /**
   *
   */
  main?: string
  /**
   *
   */
  types?: string
  /**
   *
   */
  typings?: string
  /**
   *
   */
  exports?: unknown
}

/**
 * Minimal projection used while walking parent directories looking for the
 * `package.json` whose `name` matches the dep we're resolving.
 */
interface MinimalPackageJson {
  /** Package name as declared in `package.json#name`. */
  name?: string
}

/**
 * Inputs to {@link resolveDepEntry}.
 */
export interface ResolveDepEntryOptions {
  /** Dep package name, e.g. `"rollup"` or `"@rollup/plugin-typescript"`. */
  dep: string
  /** Absolute project root (used to anchor the dep's `package.json` lookup). */
  projectRoot: string
  /** Absolute workspace root, used as a secondary lookup root. */
  workspaceRoot: string
  /**
   * Pre-pass kind:
   * - `'js'`: return the dep's runtime entry (`module` / `main`).
   * - `'dts'`: return the dep's types entry (`types` / `typings`).
   */
  kind: 'js' | 'dts'
}

const ROOTS = (projectRoot: string, workspaceRoot: string): string[] => [projectRoot, workspaceRoot]

const findPackageJsonByWalkingUp = (entryPath: string, dep: string): string | undefined => {
  const segments = entryPath.split('/')
  for (let i = segments.length - 1; i > 0; i--) {
    const prefix = segments.slice(0, i).join('/')
    const candidate = `${prefix}/package.json`
    if (!exists(candidate)) continue
    try {
      const meta = readJsonFileIfExists<MinimalPackageJson>(candidate)
      if (meta?.name === dep) return candidate
    } catch {
      // fall through
    }
  }
  return undefined
}

const findPackageJsonViaRequire = (dep: string, fromRoots: string[]): string | undefined => {
  for (const root of fromRoots) {
    try {
      const anchor = join(root, 'package.json')
      if (!exists(anchor)) continue
      const req = createRequire(anchor)
      const direct = `${dep}/package.json`
      try {
        const path = req.resolve(direct)
        if (exists(path)) return path
      } catch {
        // package may restrict ./package.json via exports — fall through to entry-anchored walk
      }
      try {
        const entryPath = req.resolve(dep)
        const found = findPackageJsonByWalkingUp(entryPath, dep)
        if (found) return found
      } catch {
        // entry resolution may also fail (e.g., type-only package); try the next root
      }
    } catch {
      // try next root
    }
  }
  return undefined
}

const ensureJsEntry = (pkg: DepPackageJson): string | undefined => pkg.module ?? pkg.main

const ensureDtsEntry = (pkg: DepPackageJson): string | undefined => pkg.types ?? pkg.typings

const absolutize = (relativeTo: string, rel: string): string => {
  if (nodeIsAbsolute(rel)) return normalizeToForwardSlashes(rel)
  return normalizeToForwardSlashes(nodeResolve(relativeTo, rel))
}

/**
 * Resolves the absolute path to a bundled dep's entry file (JS or `.d.ts`) for a
 * pre-pass invocation.
 *
 * For JS jobs the resolution prefers the dep's `module` field (ESM) over `main`
 * (CJS). For dts jobs it prefers `types` over `typings`. Lookup walks the project
 * root first, then the workspace root, using `createRequire` so node's standard
 * resolution semantics apply (including support for hoisted `node_modules`).
 *
 * @param options - Dep name, root paths, and kind.
 * @returns Absolute path to the dep's entry file.
 * @throws {Error} When the dep's `package.json` cannot be located or it lacks the
 * required entry field.
 *
 * @example Resolving the runtime entry for `rollup`
 * ```typescript
 * const entry = resolveDepEntry({ dep: 'rollup', projectRoot, workspaceRoot, kind: 'js' })
 * ```
 */
export const resolveDepEntry = (options: ResolveDepEntryOptions): string => {
  const { dep, projectRoot, workspaceRoot, kind } = options
  const pkgPath = findPackageJsonViaRequire(dep, ROOTS(projectRoot, workspaceRoot))
  if (!pkgPath) throw createError(`pre-pass: cannot locate package.json for dep "${dep}"`)
  const pkg = readJsonFileIfExists<DepPackageJson>(pkgPath)
  if (!pkg) throw createError(`pre-pass: package.json for dep "${dep}" could not be read at ${pkgPath}`)
  const relative = kind === 'js' ? ensureJsEntry(pkg) : ensureDtsEntry(pkg)
  if (!relative) throw createError(`pre-pass: dep "${dep}" has no ${kind === 'js' ? 'main/module' : 'types/typings'} entry`)
  return absolutize(dirname(pkgPath), relative)
}
