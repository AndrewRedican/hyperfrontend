/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
import type { OutputOptions, Plugin, RollupLog, RollupOptions } from 'rollup'
import type { RollupBuildDescriptor, RollupWorkerReport } from './types'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { dirname, join, relative } from 'node:path'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { rollup } from 'rollup'

const BYTES_PER_MB = 1024 * 1024

/**
 * Internal pairing of the rollup configuration and the resolved output options
 * passed to `bundle.write` for a single descriptor.
 */
interface PreparedRollupJob {
  /** Rollup configuration ready for `rollup(config)`. */
  config: RollupOptions
  /** Output options to be written sequentially against the produced bundle. */
  outputs: OutputOptions[]
}

const onWarnEntry = (warning: RollupLog, defaultHandler: (w: RollupLog) => void): void => {
  if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
  if (warning.code === 'EMPTY_BUNDLE') return
  defaultHandler(warning)
}

const onWarnBundle = (warning: RollupLog, defaultHandler: (w: RollupLog) => void): void => {
  if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
  if (warning.code === 'EMPTY_BUNDLE') return
  if (warning.code === 'UNRESOLVED_IMPORT') return
  defaultHandler(warning)
}

const toForwardSlashes = (path: string): string => path.split('\\').join('/')

const buildExternalPredicate = (externals: string[]): ((id: string) => boolean) => {
  const set = new Set<string>(externals)
  return (id: string): boolean => set.has(id)
}

const matchesDep = (source: string, dep: string): boolean => source === dep || source.startsWith(`${dep}/`)

const indexFileNameForFormat = (format: 'esm' | 'cjs'): string => (format === 'esm' ? 'index.esm.js' : 'index.cjs.js')

/**
 * Result returned by the externalize-bundled-deps plugin's `resolveId` hook.
 */
interface ExternalResolution {
  /** Resolved import id (relative path or original specifier). */
  id: string
  /** Always `true` — the plugin only emits external resolutions. */
  external: true
}

const buildExternalizeBundledDepsPlugin = (deps: string[], entryOutDir: string, depsRoot: string, format: 'esm' | 'cjs'): Plugin => ({
  name: 'externalize-bundled-deps',
  resolveId(source: string): ExternalResolution | null {
    if (source.startsWith('node:') || isBuiltin(source)) {
      return { id: source, external: true }
    }
    for (const dep of deps) {
      if (!matchesDep(source, dep)) continue
      const target = join(depsRoot, dep, indexFileNameForFormat(format))
      const raw = relative(entryOutDir, target)
      const normalized = toForwardSlashes(raw)
      const id = normalized.startsWith('.') ? normalized : `./${normalized}`
      return { id, external: true }
    }
    return null
  },
})

const buildEntryPlugins = (job: RollupBuildDescriptor, format: 'esm' | 'cjs'): Plugin[] => {
  const plugins: Plugin[] = []
  if (job.bundledDepsPlugin) {
    plugins.push(buildExternalizeBundledDepsPlugin(job.bundledDepsPlugin.deps, job.outputDir, job.bundledDepsPlugin.depsRoot, format))
  }
  plugins.push(
    <Plugin>json(),
    <Plugin>nodeResolve({ extensions: ['.ts', '.js'] }),
    <Plugin>commonjs(),
    job.bundleWorkspaceDeps ? <Plugin>typescript({
          tsconfig: job.tsConfigPath,
          declaration: false,
          declarationMap: false,
          sourceMap: job.sourcemap,
          compilerOptions: {
            baseUrl: job.workspaceRoot,
            outDir: job.outputDir,
          },
        }) : <Plugin>typescript({
          tsconfig: job.tsConfigPath,
          declaration: false,
          declarationMap: false,
          rootDir: `${job.projectRoot}/src`,
          outDir: job.outputDir,
          sourceMap: job.sourcemap,
          compilerOptions: { paths: {} },
        })
  )
  return plugins
}

const buildBundlePlugins = (job: RollupBuildDescriptor): Plugin[] => [
  <Plugin>json(),
  <Plugin>nodeResolve({ extensions: ['.ts', '.js'], browser: true, preferBuiltins: false }),
  <Plugin>commonjs(),
  <Plugin>typescript({
    tsconfig: job.tsConfigPath,
    declaration: false,
    declarationMap: false,
    sourceMap: true,
    compilerOptions: {
      baseUrl: job.workspaceRoot,
      outDir: job.outputDir,
    },
  }),
]

const buildEsmJob = (job: RollupBuildDescriptor): PreparedRollupJob => ({
  config: {
    input: job.inputFile,
    external: buildExternalPredicate(job.external),
    onwarn: onWarnEntry,
    plugins: buildEntryPlugins(job, 'esm'),
  },
  outputs: [{ file: join(job.outputDir, 'index.esm.js'), format: 'esm', sourcemap: job.sourcemap }],
})

const buildCjsJob = (job: RollupBuildDescriptor): PreparedRollupJob => ({
  config: {
    input: job.inputFile,
    external: buildExternalPredicate(job.external),
    onwarn: onWarnEntry,
    plugins: buildEntryPlugins(job, 'cjs'),
  },
  outputs: [{ file: join(job.outputDir, 'index.cjs.js'), format: 'cjs', sourcemap: job.sourcemap }],
})

const buildIifeJob = (job: RollupBuildDescriptor): PreparedRollupJob => {
  const bundle = <NonNullable<RollupBuildDescriptor['bundle']>>job.bundle
  const outputs: OutputOptions[] = [
    {
      file: join(job.outputDir, 'index.iife.js'),
      format: 'iife',
      name: bundle.globalName,
      sourcemap: job.sourcemap,
      globals: bundle.globals,
    },
  ]
  if (bundle.minify) {
    outputs.push({
      file: join(job.outputDir, 'index.iife.min.js'),
      format: 'iife',
      name: bundle.globalName,
      sourcemap: job.sourcemap,
      globals: bundle.globals,
      plugins: [<Plugin>terser()],
    })
  }
  return {
    config: {
      input: job.inputFile,
      external: buildExternalPredicate(job.external),
      onwarn: onWarnBundle,
      plugins: buildBundlePlugins(job),
    },
    outputs,
  }
}

const buildUmdJob = (job: RollupBuildDescriptor): PreparedRollupJob => {
  const bundle = <NonNullable<RollupBuildDescriptor['bundle']>>job.bundle
  const base: Partial<OutputOptions> = {
    format: 'umd',
    name: bundle.globalName,
    sourcemap: job.sourcemap,
    globals: bundle.globals,
  }
  if (bundle.amdId) base.amd = { id: bundle.amdId }
  const outputs: OutputOptions[] = [<OutputOptions>{ ...base, file: join(job.outputDir, 'index.umd.js') }]
  if (bundle.minify) {
    outputs.push(<OutputOptions>{ ...base, file: join(job.outputDir, 'index.umd.min.js'), plugins: [<Plugin>terser()] })
  }
  return {
    config: {
      input: job.inputFile,
      external: buildExternalPredicate(job.external),
      onwarn: onWarnBundle,
      plugins: buildBundlePlugins(job),
    },
    outputs,
  }
}

const buildJob = (job: RollupBuildDescriptor): PreparedRollupJob => {
  if (job.format === 'esm') return buildEsmJob(job)
  if (job.format === 'cjs') return buildCjsJob(job)
  if (job.format === 'iife') return buildIifeJob(job)
  return buildUmdJob(job)
}

const ensureDir = (path: string): void => {
  mkdirSync(path, { recursive: true })
}

const safeStatSize = (filePath: string): number => {
  /* istanbul ignore next -- @preserve defensive: rollup always produces the declared output file */
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

/**
 * Runs a single rollup invocation as described by `job` and writes the
 * resulting report to `job.reportPath`.
 *
 * Public so callers (and tests) can drive the worker logic without spawning a
 * new Node process. The implementation is fully self-contained: it depends only
 * on `rollup`, the `@rollup/plugin-*` packages, and Node built-ins so the
 * worker can bootstrap before any workspace package is built.
 *
 * @param job - Descriptor describing the rollup invocation.
 * @returns The on-disk report data the worker would have persisted.
 *
 * @example Driving the worker logic in-process for a fixture
 * ```typescript
 * const report = await runRollupWorkerJob({ format: 'esm', inputFile: '/abs/in.ts', ... })
 * ```
 */
export const runRollupWorkerJob = async (job: RollupBuildDescriptor): Promise<RollupWorkerReport> => {
  const startedAt = Date.now()
  ensureDir(job.outputDir)
  ensureDir(dirname(job.reportPath))
  const { config, outputs } = buildJob(job)
  const bundle = await rollup(config)
  let totalSize = 0
  try {
    for (const output of outputs) {
      await bundle.write(output)
      totalSize += safeStatSize(<string>output.file)
    }
  } finally {
    await bundle.close()
  }
  const memory = process.memoryUsage()
  const report: RollupWorkerReport = {
    outputSize: totalSize,
    peakHeapMB: memory.heapUsed / BYTES_PER_MB,
    peakRssMB: memory.rss / BYTES_PER_MB,
    durationMs: Date.now() - startedAt,
  }
  writeFileSync(job.reportPath, JSON.stringify(report))
  return report
}
