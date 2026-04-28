import type { Plugin } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Inputs to `createTypescriptPlugin` for entry-point builds.
 */
export interface TypescriptPluginOptions {
  /** Absolute path to the project's tsconfig file. */
  tsConfigPath: string
  /** Absolute path to the project root (used to compute `rootDir` when not bundling workspace deps). */
  projectRoot: string
  /** Absolute path to the per-entry output directory. */
  outputPath: string
  /** Whether sourcemaps should be emitted by Rollup. */
  sourcemap: boolean
  /** When `true`, the plugin compiles workspace deps using `workspaceRoot` as `baseUrl`. */
  bundleWorkspaceDeps: boolean
  /** Absolute path to the workspace root; required when `bundleWorkspaceDeps` is `true`. */
  workspaceRoot?: string
}

/**
 * Inputs to `createBundleTypescriptPlugin` for IIFE / UMD bundle builds.
 */
export interface BundleTypescriptPluginOptions {
  /** Absolute path to the project's tsconfig file. */
  tsConfigPath: string
  /** Absolute path to the workspace root. */
  workspaceRoot: string
  /** Absolute path to the bundle output directory. */
  bundlePath: string
  /** Whether sourcemaps should be emitted by Rollup. */
  sourcemap: boolean
}

/**
 * Creates a `@rollup/plugin-node-resolve` plugin tuned for entry-point builds.
 *
 * Resolves both `.ts` and `.js` extensions. Externalisation of workspace packages
 * is handled by Rollup's `external` predicate rather than by `resolveOnly`, so this
 * plugin is configuration-free.
 *
 * @returns Configured Rollup plugin.
 *
 * @example Plugin instance for an entry-point ESM bundle
 * ```typescript
 * createNodeResolvePlugin()
 * ```
 */
export const createNodeResolvePlugin = (): Plugin => <Plugin>nodeResolve({ extensions: ['.ts', '.js'] })

/**
 * Creates a `@rollup/plugin-node-resolve` plugin tuned for browser bundle outputs (IIFE / UMD).
 * Resolves every package, including workspace dependencies, and prefers browser entry fields.
 *
 * @returns Configured Rollup plugin.
 *
 * @example Plugin instance for a browser-targeted IIFE bundle
 * ```typescript
 * createBrowserNodeResolvePlugin()
 * ```
 */
export const createBrowserNodeResolvePlugin = (): Plugin =>
  <Plugin>nodeResolve({ extensions: ['.ts', '.js'], browser: true, preferBuiltins: false })

/**
 * Creates a `@rollup/plugin-commonjs` plugin with default settings.
 *
 * @returns Configured Rollup plugin.
 *
 * @example Adding CJS interop to a Rollup pipeline
 * ```typescript
 * createCommonJsPlugin()
 * ```
 */
export const createCommonJsPlugin = (): Plugin => <Plugin>commonjs()

/**
 * Creates a TypeScript plugin for entry-point builds.
 *
 * Declarations are NOT emitted by Rollup — they are produced by the dedicated
 * `generateDeclarations` primitive instead, which preserves consistent output
 * structure across `bundleWorkspaceDeps` modes.
 *
 * When `bundleWorkspaceDeps` is `false` the plugin disables the project's path
 * mappings (`compilerOptions.paths = {}`) so workspace imports remain bare and
 * unresolved by TypeScript. When `true`, the workspace root becomes `baseUrl` so
 * workspace imports are resolved and inlined.
 *
 * @param options - Plugin configuration.
 * @returns Configured Rollup plugin.
 * @throws {Error} When `bundleWorkspaceDeps` is `true` but `workspaceRoot` is omitted.
 *
 * @example Plugin instance for an entry-point ESM build
 * ```typescript
 * createTypescriptPlugin({
 *   tsConfigPath: '/abs/tsconfig.lib.json',
 *   projectRoot: '/abs/libs/foo',
 *   outputPath: '/abs/dist/libs/foo',
 *   sourcemap: true,
 *   bundleWorkspaceDeps: false,
 * })
 * ```
 */
export const createTypescriptPlugin = (options: TypescriptPluginOptions): Plugin => {
  if (options.bundleWorkspaceDeps) {
    if (!options.workspaceRoot) throw createError('workspaceRoot is required when bundleWorkspaceDeps is true')
    return <Plugin>typescript({
      tsconfig: options.tsConfigPath,
      declaration: false,
      declarationMap: false,
      sourceMap: options.sourcemap,
      compilerOptions: {
        baseUrl: options.workspaceRoot,
        outDir: options.outputPath,
      },
    })
  }
  return <Plugin>typescript({
    tsconfig: options.tsConfigPath,
    declaration: false,
    declarationMap: false,
    rootDir: `${options.projectRoot}/src`,
    outDir: options.outputPath,
    sourceMap: options.sourcemap,
    compilerOptions: { paths: {} },
  })
}

/**
 * Creates a TypeScript plugin tuned for IIFE / UMD bundle outputs.
 * Always uses the workspace root as `baseUrl` so workspace imports resolve, and
 * never emits declarations.
 *
 * @param options - Plugin configuration.
 * @returns Configured Rollup plugin.
 *
 * @example Plugin instance for a UMD bundle
 * ```typescript
 * createBundleTypescriptPlugin({
 *   tsConfigPath: '/abs/tsconfig.lib.json',
 *   workspaceRoot: '/abs/repo',
 *   bundlePath: '/abs/dist/libs/foo/bundle',
 *   sourcemap: true,
 * })
 * ```
 */
export const createBundleTypescriptPlugin = (options: BundleTypescriptPluginOptions): Plugin => <Plugin>typescript({
    tsconfig: options.tsConfigPath,
    declaration: false,
    declarationMap: false,
    sourceMap: options.sourcemap,
    compilerOptions: {
      baseUrl: options.workspaceRoot,
      outDir: options.bundlePath,
    },
  })

/**
 * Creates a `@rollup/plugin-json` plugin with default settings.
 *
 * @returns Configured Rollup plugin.
 *
 * @example Adding JSON imports to a Rollup pipeline
 * ```typescript
 * createJsonPlugin()
 * ```
 */
export const createJsonPlugin = (): Plugin => <Plugin>json()

/**
 * Creates a `@rollup/plugin-terser` plugin for minification.
 *
 * @returns Configured Rollup plugin.
 *
 * @example Adding terser minification to a Rollup output
 * ```typescript
 * createTerserPlugin()
 * ```
 */
export const createTerserPlugin = (): Plugin => terser()
