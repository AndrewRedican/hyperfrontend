/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
import type { OutputOptions, Plugin, RollupLog, RollupOptions } from 'rollup'
import type { SiblingEntry } from '../../declarations/sibling-resolver'
import type { ExternalizeFormat, WorkspaceBundledDepRoute } from '../externalize-plugin'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { dirname } from 'node:path'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { rollup } from 'rollup'
import { createSiblingExternalizePlugin } from '../../declarations/sibling-resolver'
import { createExternalizeBundledDepsPlugin } from '../externalize-plugin'

/**
 * Pre-pass kinds. `js` and `dts` cover npm bundled deps with pre-built JS and
 * `.d.ts` entries; `workspace-js` and `workspace-dts` cover workspace
 * `@hyperfrontend/*` deps whose entries are TypeScript source and require
 * type-aware transformation against the workspace tsconfig.
 */
export type PrePassWorkerJobKind = 'js' | 'dts' | 'workspace-js' | 'workspace-dts'

/**
 * Job spec consumed by the pre-pass worker via `process.argv[2]`.
 *
 * Each invocation produces exactly one rollup output and one JSON report at
 * `reportPath` so the parent orchestrator can collect per-job statistics.
 */
export interface PrePassWorkerJob {
  /**
   * Pre-pass kind. `js` and `dts` run the npm-dep pipeline; `workspace-js` and
   * `workspace-dts` add `@rollup/plugin-typescript` (or `rollup-plugin-dts`'s
   * tsconfig integration) so TypeScript source workspace deps can be hoisted.
   */
  kind: PrePassWorkerJobKind
  /** Dep package name (or workspace specifier) being pre-passed. */
  dep: string
  /** Absolute path to the dep's entry (main / module for JS, types for dts, source `.ts` for workspace-*). */
  inputPath: string
  /** Output format. JS jobs must use `'esm'` or `'cjs'`. dts jobs always use `'es'` internally. */
  format: 'esm' | 'cjs'
  /** Absolute path to the output file. */
  outputPath: string
  /** Other deps in the pre-pass set; marked external so cross-dep imports stay link-time. Prefix-matched. */
  otherDeps: string[]
  /**
   * Sub-path-mode workspace specifiers in the pre-pass set; matched as exact
   * specifier only (e.g. `@hyperfrontend/immutable-api-utils/built-in-copy/array`).
   * Used by `workspace-*` jobs so sibling sub-paths externalize cleanly without
   * also externalizing every other sub-path on the same package.
   */
  otherWorkspaceSpecifiers?: string[]
  /** Absolute path to the project's tsconfig (workspace-* jobs only). */
  tsConfigPath?: string
  /** Absolute workspace root used as `baseUrl` for path-mapping resolution (workspace-* jobs only). */
  workspaceRoot?: string
  /**
   * Sibling-entry descriptors used by the per-entry `dts` pass to externalize
   * imports that resolve into another entry's directory. Empty / omitted for
   * dep pre-pass jobs.
   */
  siblingEntries?: SiblingEntry[]
  /** Absolute path to the input file's owning entry directory (used to compute sibling specifiers). */
  selfDtsPath?: string
  /** Owning entry's `srcPath` (used for diagnostics). Empty string for the package root. */
  selfSrcPath?: string
  /**
   * NPM bundled-dep names consumed by the canonical externalize plugin to rewrite
   * cross-dep imports to relative paths under {@link depsRoot}.
   */
  npmDeps?: string[]
  /**
   * Workspace bundled-dep routes consumed by the canonical externalize plugin.
   * For self-pre-pass jobs (`workspace-js` / `workspace-dts`) this excludes the
   * specifier or package being built so the chunk inlines its own internals.
   */
  workspaceRoutes?: WorkspaceBundledDepRoute[]
  /** Absolute path to the project's `_dependencies/` root. Required when {@link npmDeps} or {@link workspaceRoutes} is non-empty. */
  depsRoot?: string
  /** Absolute path where the worker writes its JSON report. */
  reportPath: string
}

/**
 * Memory + size summary written to `reportPath` when a worker exits cleanly.
 */
export interface PrePassWorkerReport {
  /** Final on-disk size of the rollup output, in bytes. */
  outputSize: number
  /** `process.memoryUsage().heapUsed` in MB at end of bundle. */
  endHeapMB: number
  /** `process.memoryUsage().rss` in MB at end of bundle. */
  endRssMB: number
  /** Worker wall-clock duration in ms. */
  durationMs: number
}

const BYTES_PER_MB = 1024 * 1024

const SUPPRESSED_WARNING_CODES = new Set<string>([
  'CIRCULAR_DEPENDENCY',
  'UNRESOLVED_IMPORT',
  'EMPTY_BUNDLE',
  'UNUSED_EXTERNAL_IMPORT',
  'MIXED_EXPORTS',
])

/**
 * Suppresses `MISSING_EXPORT` warnings caused by a package augmenting a
 * DefinitelyTyped (`@types/*`) module to add members absent from the published
 * stub. `rollup-plugin-dts` resolves e.g. `import * as estree from 'estree'` to
 * `@types/estree` but cannot follow the `declare module 'estree'` augmentation
 * (rollup's own `rollup.d.ts` adds `Decorator` this way) across the external
 * boundary, so it reports the augmented members as not exported. The
 * augmentation still resolves correctly in the emitted d.ts, so the warning is
 * noise during the d.ts pre-pass.
 *
 * @param warning - The rollup log entry.
 * @returns `true` when the warning is a `@types/*` augmentation false positive.
 */
const isTypesAugmentationMiss = (warning: RollupLog): boolean =>
  warning.code === 'MISSING_EXPORT' && typeof warning.exporter === 'string' && warning.exporter.includes('/@types/')

/**
 * Shared rollup `onwarn` handler for every pre-pass job. Drops the known-benign
 * warning classes that bundling third-party / workspace deps routinely emits
 * (see {@link SUPPRESSED_WARNING_CODES} and {@link isTypesAugmentationMiss}) and
 * forwards everything else to rollup's default handler.
 *
 * @param warning - The rollup log entry.
 * @param defaultHandler - Rollup's default warning handler.
 *
 * @example Wiring the handler into a rollup config
 * ```typescript
 * const config: RollupOptions = { input, plugins, onwarn: onWarn }
 * ```
 */
export const onWarn = (warning: RollupLog, defaultHandler: (w: RollupLog) => void): void => {
  if (warning.code && SUPPRESSED_WARNING_CODES.has(warning.code)) return
  if (isTypesAugmentationMiss(warning)) return
  defaultHandler(warning)
}

const matchesAnyDep = (id: string, deps: string[]): boolean => {
  for (const d of deps) {
    if (id === d || id.startsWith(`${d}/`)) return true
  }
  return false
}

const matchesAnyExactSpecifier = (id: string, specifiers: string[] | undefined): boolean => {
  if (!specifiers || specifiers.length === 0) return false
  for (const s of specifiers) {
    if (id === s) return true
  }
  return false
}

/**
 * Packages whose JS implementation is intentionally NOT inlined during the JS pre-pass.
 *
 * Mirrors `ALWAYS_EXTERNAL_TYPE_DEPS` for the JS half. `typescript` is permanent
 * consumer-supplied — both `@rollup/plugin-typescript` and `rollup-plugin-dts`
 * follow `require('typescript')` into the compiler; without this gate, ~30 MB
 * of typescript bytecode ends up inlined into `_dependencies/<plugin>/index.<fmt>.js`.
 */
const ALWAYS_EXTERNAL_JS_DEPS = new Set<string>(['typescript'])

const isExternalJsDep = (id: string): boolean => {
  for (const name of ALWAYS_EXTERNAL_JS_DEPS) {
    if (id === name || id.startsWith(`${name}/`)) return true
  }
  return false
}

/**
 * Builds the canonical externalize plugin for a pre-pass job when the parent
 * supplied npm deps or workspace routes. Mirrors the plugin install on the
 * per-entry rollup side so chunk-internal cross-bundled-dep specifiers get
 * rewritten to relative paths under `_dependencies/` instead of leaking as bare
 * `require('@hyperfrontend/...')` calls into the published artifact.
 *
 * @param job - Pre-pass job spec; only `npmDeps`, `workspaceRoutes`, `depsRoot`, and `outputPath` are read here.
 * @param format - Output format the plugin should rewrite specifiers for (`'esm'`, `'cjs'`, or `'dts'`).
 * @returns The plugin when routing data is supplied, or `undefined` to opt out of rewriting.
 */
const maybeExternalizePlugin = (job: PrePassWorkerJob, format: ExternalizeFormat): Plugin | undefined => {
  const npmDeps = job.npmDeps ?? []
  const workspaceRoutes = job.workspaceRoutes ?? []
  if (npmDeps.length === 0 && workspaceRoutes.length === 0) return undefined
  if (!job.depsRoot) return undefined
  return createExternalizeBundledDepsPlugin({
    deps: npmDeps,
    entryOutDir: dirname(job.outputPath),
    format,
    depsRoot: job.depsRoot,
    workspaceRoutes,
  })
}

const buildJsConfig = (job: PrePassWorkerJob): RollupOptions => {
  const plugins: Plugin[] = []
  const externalizePlugin = maybeExternalizePlugin(job, job.format)
  const hasExternalize = externalizePlugin !== undefined
  if (externalizePlugin) plugins.push(externalizePlugin)
  plugins.push(
    <Plugin>json(),
    <Plugin>nodeResolve({ preferBuiltins: true, extensions: ['.mjs', '.js', '.cjs', '.json'] }),
    <Plugin>commonjs({ ignoreDynamicRequires: true })
  )
  return {
    input: job.inputPath,
    // why: when the externalize plugin is active, it owns rewriting of bundled-dep specifiers to relative paths under depsRoot. The `external` callback must not short-circuit those — rollup consults `external` before plugin resolveId can run, so any matchesAnyDep hit there leaks bare specifiers into the chunk.
    external: (id: string): boolean =>
      isBuiltin(id) || id.startsWith('node:') || (!hasExternalize && matchesAnyDep(id, job.otherDeps)) || isExternalJsDep(id),
    onwarn: onWarn,
    plugins,
  }
}

const requireWorkspaceField = (job: PrePassWorkerJob, field: 'tsConfigPath' | 'workspaceRoot'): string => {
  const value = job[field]
  if (!value) {
    throw new Error(`workspace pre-pass job for ${job.dep} (${job.kind}/${job.format}) missing ${field}`)
  }
  return value
}

/**
 * Builds a JS rollup config for a workspace-source pre-pass. The input is a
 * `.ts` source file; `@rollup/plugin-typescript` transpiles it (and any
 * transitive workspace files reached via tsconfig path-mapping) while sibling
 * pre-passed specifiers stay external so each chunk is self-contained.
 *
 * The plugin is driven by the dep's own tsconfig (resolved by the parent and
 * passed through `job.tsConfigPath`), keeping the workspace pre-pass agnostic
 * of any workspace-root tsconfig.
 *
 * @param job - Pre-pass job spec with `tsConfigPath` and `workspaceRoot` populated.
 * @returns Rollup options ready for the worker to invoke.
 */
const buildWorkspaceJsConfig = (job: PrePassWorkerJob): RollupOptions => {
  const tsConfigPath = requireWorkspaceField(job, 'tsConfigPath')
  const workspaceRoot = requireWorkspaceField(job, 'workspaceRoot')
  const tsPlugin = <Plugin>typescript({
    tsconfig: tsConfigPath,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    // why: without an explicit anchor the plugin resolves its include filter against process.cwd(); the worker inherits the caller's cwd, so sources outside it would silently skip the TS transform and reach rollup as raw TypeScript.
    filterRoot: workspaceRoot,
    compilerOptions: {
      baseUrl: workspaceRoot,
      outDir: dirname(job.outputPath),
      noEmitOnError: false,
      noEmit: false,
      module: 'esnext',
    },
  })
  const plugins: Plugin[] = []
  const externalizePlugin = maybeExternalizePlugin(job, job.format)
  const hasExternalize = externalizePlugin !== undefined
  if (externalizePlugin) plugins.push(externalizePlugin)
  plugins.push(
    <Plugin>json(),
    <Plugin>nodeResolve({ preferBuiltins: true, extensions: ['.ts', '.mjs', '.js', '.cjs', '.json'] }),
    <Plugin>commonjs({ ignoreDynamicRequires: true }),
    tsPlugin
  )
  return {
    input: job.inputPath,
    external: (id: string): boolean =>
      isBuiltin(id) ||
      id.startsWith('node:') ||
      (!hasExternalize && matchesAnyDep(id, job.otherDeps)) ||
      (!hasExternalize && matchesAnyExactSpecifier(id, job.otherWorkspaceSpecifiers)) ||
      isExternalJsDep(id),
    onwarn: onWarn,
    plugins,
  }
}

const buildJsOutput = (job: PrePassWorkerJob): OutputOptions => ({
  file: job.outputPath,
  format: job.format === 'esm' ? 'esm' : 'cjs',
  sourcemap: false,
  inlineDynamicImports: true,
  exports: 'auto',
  generatedCode: { constBindings: true },
})

/**
 * Packages whose `.d.ts` is intentionally NOT inlined during the d.ts pre-pass.
 *
 * `typescript` is a permanent consumer requirement — never bundled, never inlined,
 * never copied into `_dependencies/`. The compiler is too large (~10 MB just for
 * `lib/typescript.d.ts`), its namespace re-exports defeat `rollup-plugin-dts`,
 * and every consumer of `@hyperfrontend/builder` is, by definition, already a
 * TypeScript project. Emitted `.d.ts` keeps `import type ... from 'typescript'`
 * intact so the consumer's own install satisfies the type imports.
 */
const ALWAYS_EXTERNAL_TYPE_DEPS = new Set<string>(['typescript'])

/**
 * Options accepted by `rollup-plugin-dts`'s default factory. Mirrored locally
 * because the package's published types vary between CJS / ESM module shapes
 * and we only need this one option at the call site.
 */
interface DtsPluginOptions {
  /** Apply the plugin's transformations to externalized imports as well. */
  respectExternal?: boolean
}

/**
 * Default factory exported by `rollup-plugin-dts`. The runtime module's CJS
 * shape sometimes lacks a `.default`, so we fall back to the module object
 * itself (cast as the factory type) to handle both layouts.
 */
type DtsFactory = (options?: DtsPluginOptions) => Plugin

/**
 * Module-shape projection of `rollup-plugin-dts` covering the dynamic-import
 * result we read.
 */
interface DtsModule {
  /** Default export — present in the published ESM form, sometimes missing in the CJS form. */
  default?: DtsFactory
}

const isExternalTypeDep = (id: string): boolean => {
  for (const name of ALWAYS_EXTERNAL_TYPE_DEPS) {
    if (id === name || id.startsWith(`${name}/`)) return true
  }
  return false
}

/**
 * Options accepted by `rollup-plugin-dts`'s default factory that we actually
 * configure. The package's published types vary between ESM / CJS module
 * shapes; mirror only the fields we need.
 */
interface DtsPluginInvocationOptions {
  /** Apply the plugin's transformations to externalized imports as well. */
  respectExternal?: boolean
  /** Path to the tsconfig the plugin should drive TypeScript with. Required when input is `.ts` source. */
  tsconfig?: string
  /** Inline compilerOptions override merged onto the tsconfig. */
  compilerOptions?: Record<string, unknown>
}

const loadDtsFactory = async (): Promise<(options?: DtsPluginInvocationOptions) => Plugin> => {
  const dtsModule: DtsModule = await import('rollup-plugin-dts')
  /* istanbul ignore next -- @preserve fallback path for CJS-style rollup-plugin-dts module shapes */
  return <(options?: DtsPluginInvocationOptions) => Plugin>(dtsModule.default ?? <DtsFactory>(<unknown>dtsModule))
}

const maybeSiblingPlugin = (job: PrePassWorkerJob): Plugin | undefined => {
  if (!job.siblingEntries || job.siblingEntries.length === 0 || !job.selfDtsPath) return undefined
  return createSiblingExternalizePlugin({
    selfSrcPath: job.selfSrcPath ?? '',
    selfDtsPath: job.selfDtsPath,
    siblings: job.siblingEntries,
  })
}

const buildDtsConfig = async (job: PrePassWorkerJob): Promise<RollupOptions> => {
  const dtsFactory = await loadDtsFactory()
  const plugins: Plugin[] = []
  const siblingPlugin = maybeSiblingPlugin(job)
  if (siblingPlugin) plugins.push(siblingPlugin)
  const externalizePlugin = maybeExternalizePlugin(job, 'dts')
  const hasExternalize = externalizePlugin !== undefined
  if (externalizePlugin) plugins.push(externalizePlugin)
  plugins.push(dtsFactory({ respectExternal: true }))
  return {
    input: job.inputPath,
    external: (id: string): boolean =>
      isBuiltin(id) || id.startsWith('node:') || (!hasExternalize && matchesAnyDep(id, job.otherDeps)) || isExternalTypeDep(id),
    onwarn: onWarn,
    plugins,
  }
}

/**
 * Builds a d.ts rollup config for a workspace-source pre-pass. The input is a
 * `.ts` source file; `rollup-plugin-dts` drives TypeScript using the project's
 * tsconfig so workspace path-mappings resolve and transitive type imports are
 * properly inlined or externalized.
 *
 * @param job - Pre-pass job spec with `tsConfigPath` and `workspaceRoot` populated.
 * @returns Rollup options ready for the worker to invoke.
 */
const buildWorkspaceDtsConfig = async (job: PrePassWorkerJob): Promise<RollupOptions> => {
  const tsConfigPath = requireWorkspaceField(job, 'tsConfigPath')
  const workspaceRoot = requireWorkspaceField(job, 'workspaceRoot')
  const dtsFactory = await loadDtsFactory()
  const plugins: Plugin[] = []
  const externalizePlugin = maybeExternalizePlugin(job, 'dts')
  const hasExternalize = externalizePlugin !== undefined
  if (externalizePlugin) plugins.push(externalizePlugin)
  plugins.push(dtsFactory({ respectExternal: true, tsconfig: tsConfigPath, compilerOptions: { baseUrl: workspaceRoot } }))
  return {
    input: job.inputPath,
    external: (id: string): boolean =>
      isBuiltin(id) ||
      id.startsWith('node:') ||
      (!hasExternalize && matchesAnyDep(id, job.otherDeps)) ||
      (!hasExternalize && matchesAnyExactSpecifier(id, job.otherWorkspaceSpecifiers)) ||
      isExternalTypeDep(id),
    onwarn: onWarn,
    plugins,
  }
}

const buildDtsOutput = (job: PrePassWorkerJob): OutputOptions => ({
  file: job.outputPath,
  format: 'es',
  sourcemap: false,
  inlineDynamicImports: true,
})

const ensureParentDir = (filePath: string): void => {
  mkdirSync(dirname(filePath), { recursive: true })
}

const buildConfigForJob = async (job: PrePassWorkerJob): Promise<RollupOptions> => {
  switch (job.kind) {
    case 'dts':
      return buildDtsConfig(job)
    case 'workspace-js':
      return buildWorkspaceJsConfig(job)
    case 'workspace-dts':
      return buildWorkspaceDtsConfig(job)
    default:
      return buildJsConfig(job)
  }
}

/**
 * Runs a single pre-pass rollup invocation as described by `job` and writes the
 * resulting report to `job.reportPath`.
 *
 * Public so callers (and tests) can drive the worker logic without spawning a
 * new Node process.
 *
 * @param job - Job spec describing the rollup invocation.
 * @returns The on-disk report data the worker would have persisted.
 *
 * @example Driving the worker logic in-process for a fixture
 * ```typescript
 * const report = await runPrePassWorkerJob({ kind: 'js', dep: 'rollup', ... })
 * ```
 */
export const runPrePassWorkerJob = async (job: PrePassWorkerJob): Promise<PrePassWorkerReport> => {
  const startedAt = Date.now()
  ensureParentDir(job.outputPath)
  ensureParentDir(job.reportPath)
  const config = await buildConfigForJob(job)
  const output = job.kind === 'dts' || job.kind === 'workspace-dts' ? buildDtsOutput(job) : buildJsOutput(job)
  const bundle = await rollup(config)
  try {
    await bundle.write(output)
  } finally {
    await bundle.close()
  }
  const memory = process.memoryUsage()
  const report: PrePassWorkerReport = {
    outputSize: statSync(job.outputPath).size,
    endHeapMB: memory.heapUsed / BYTES_PER_MB,
    endRssMB: memory.rss / BYTES_PER_MB,
    durationMs: Date.now() - startedAt,
  }
  writeFileSync(job.reportPath, JSON.stringify(report))
  return report
}
