/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
import type { OutputOptions, Plugin, RollupLog, RollupOptions } from 'rollup'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { dirname } from 'node:path'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { rollup } from 'rollup'

/**
 * Job spec consumed by the pre-pass worker via `process.argv[2]`.
 *
 * Each invocation produces exactly one rollup output and one JSON report at
 * `reportPath` so the parent orchestrator can collect per-job statistics.
 */
export interface PrePassWorkerJob {
  /** Pre-pass kind: `'js'` runs the standard JS rollup pipeline; `'dts'` runs `rollup-plugin-dts`. */
  kind: 'js' | 'dts'
  /** Dep package name being pre-passed. */
  dep: string
  /** Absolute path to the dep's entry (main / module for JS, types for dts). */
  inputPath: string
  /** Output format. JS jobs must use `'esm'` or `'cjs'`. dts jobs always use `'es'` internally. */
  format: 'esm' | 'cjs'
  /** Absolute path to the output file. */
  outputPath: string
  /** Other deps in the pre-pass set; marked external so cross-dep imports stay link-time. */
  otherDeps: string[]
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
  peakHeapMB: number
  /** `process.memoryUsage().rss` in MB at end of bundle. */
  peakRssMB: number
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

const onWarn = (warning: RollupLog, defaultHandler: (w: RollupLog) => void): void => {
  if (warning.code && SUPPRESSED_WARNING_CODES.has(warning.code)) return
  defaultHandler(warning)
}

const matchesAnyDep = (id: string, deps: string[]): boolean => {
  for (const d of deps) {
    if (id === d || id.startsWith(`${d}/`)) return true
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

const buildJsConfig = (job: PrePassWorkerJob): RollupOptions => {
  const plugins = <Plugin[]>[
    <Plugin>json(),
    <Plugin>nodeResolve({ preferBuiltins: true, extensions: ['.mjs', '.js', '.cjs', '.json'] }),
    <Plugin>commonjs({ ignoreDynamicRequires: true }),
  ]
  return {
    input: job.inputPath,
    external: (id: string): boolean => isBuiltin(id) || id.startsWith('node:') || matchesAnyDep(id, job.otherDeps) || isExternalJsDep(id),
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

const buildDtsConfig = async (job: PrePassWorkerJob): Promise<RollupOptions> => {
  const dtsModule: DtsModule = await import('rollup-plugin-dts')
  /* istanbul ignore next -- @preserve fallback path for CJS-style rollup-plugin-dts module shapes */
  const dtsFactory = dtsModule.default ?? <DtsFactory>(<unknown>dtsModule)
  const plugins: Plugin[] = [dtsFactory({ respectExternal: true })]
  const isExternalTypeDep = (id: string): boolean => {
    for (const name of ALWAYS_EXTERNAL_TYPE_DEPS) {
      if (id === name || id.startsWith(`${name}/`)) return true
    }
    return false
  }
  return {
    input: job.inputPath,
    external: (id: string): boolean => isBuiltin(id) || id.startsWith('node:') || matchesAnyDep(id, job.otherDeps) || isExternalTypeDep(id),
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
  const config = job.kind === 'dts' ? await buildDtsConfig(job) : buildJsConfig(job)
  const output = job.kind === 'dts' ? buildDtsOutput(job) : buildJsOutput(job)
  const bundle = await rollup(config)
  try {
    await bundle.write(output)
  } finally {
    await bundle.close()
  }
  const memory = process.memoryUsage()
  const report: PrePassWorkerReport = {
    outputSize: statSync(job.outputPath).size,
    peakHeapMB: memory.heapUsed / BYTES_PER_MB,
    peakRssMB: memory.rss / BYTES_PER_MB,
    durationMs: Date.now() - startedAt,
  }
  writeFileSync(job.reportPath, JSON.stringify(report))
  return report
}
