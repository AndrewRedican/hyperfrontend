import type { Plugin } from 'rollup'
import { isBuiltin } from 'node:module'
import { relative } from 'node:path'
import { join, normalizeToForwardSlashes } from '@hyperfrontend/project-scope/core/path'

/**
 * Format produced by the rollup invocation that uses the plugin.
 *
 * D.ts passes use `'dts'` so the plugin maps imports to `.d.ts` siblings under
 * `_dependencies/<dep>/`; JS passes use `'esm'` / `'cjs'`.
 */
export type ExternalizeFormat = 'esm' | 'cjs' | 'dts'

const indexFileNameForFormat = (format: ExternalizeFormat): string => {
  if (format === 'esm') return 'index.esm.js'
  if (format === 'cjs') return 'index.cjs.js'
  return 'index.d.ts'
}

/**
 * Computes the relative import specifier that a rollup output at `fromDir`
 * needs to use to reach `toFile`. The result always uses POSIX separators and
 * starts with `./` or `../` so node treats it as a relative path.
 *
 * @param fromDir - Absolute directory containing the output file.
 * @param toFile - Absolute path to the target file.
 * @returns Relative import specifier ready for inclusion in emitted code.
 *
 * @example Computing the relative path to a bundled dep
 * ```typescript
 * relativeImport('/abs/dist/libs/foo/bundle/rollup', '/abs/dist/libs/foo/_dependencies/rollup/index.esm.js')
 * // => '../../_dependencies/rollup/index.esm.js'
 * ```
 */
export const relativeImport = (fromDir: string, toFile: string): string => {
  const raw = relative(fromDir, toFile)
  const normalized = normalizeToForwardSlashes(raw)
  if (normalized.startsWith('.')) return normalized
  return `./${normalized}`
}

const matchesDep = (source: string, dep: string): boolean => source === dep || source.startsWith(`${dep}/`)

/**
 * Inputs to {@link createExternalizeBundledDepsPlugin}.
 */
export interface ExternalizeBundledDepsPluginOptions {
  /** Bundled-dep package names. Any import of these (or their subpaths) is rerouted to `_dependencies/<dep>/`. */
  deps: string[]
  /** Absolute directory the rollup invocation writes its output to. */
  entryOutDir: string
  /** Format being produced by this rollup invocation. */
  format: ExternalizeFormat
  /** Absolute path to the `_dependencies/` root. */
  depsRoot: string
}

/**
 * Resolution shape returned by the externalize-bundled-deps plugin's `resolveId` hook.
 */
interface ExternalResolution {
  /** Resolved import id — relative path under `_dependencies/` or original specifier for builtins. */
  id: string
  /** Always `true` — the plugin only emits external resolutions. */
  external: true
}

/**
 * Returns a rollup plugin whose `resolveId` hook maps any import of a bundled
 * dep (or its subpath) to a relative import that points at the pre-passed
 * artifact under `_dependencies/<dep>/`.
 *
 * The plugin marks node builtins (and `node:*` imports) as external so they
 * survive untouched, and returns `null` for everything else so the rest of the
 * plugin chain can resolve normally.
 *
 * @param options - Plugin configuration.
 * @returns Rollup plugin.
 *
 * @example Routing imports of `rollup` to the pre-passed copy
 * ```typescript
 * const plugin = createExternalizeBundledDepsPlugin({
 *   deps: ['rollup'],
 *   entryOutDir: '/abs/dist/libs/foo/bundle/rollup',
 *   format: 'esm',
 *   depsRoot: '/abs/dist/libs/foo/_dependencies',
 * })
 * ```
 */
export const createExternalizeBundledDepsPlugin = (options: ExternalizeBundledDepsPluginOptions): Plugin => {
  const { deps, entryOutDir, format, depsRoot } = options
  return {
    name: 'externalize-bundled-deps',
    resolveId(source: string): ExternalResolution | null {
      if (source.startsWith('node:') || isBuiltin(source)) {
        return { id: source, external: true }
      }
      for (const dep of deps) {
        if (!matchesDep(source, dep)) continue
        const target = join(depsRoot, dep, indexFileNameForFormat(format))
        const id = relativeImport(entryOutDir, target)
        return { id, external: true }
      }
      return null
    },
  }
}
