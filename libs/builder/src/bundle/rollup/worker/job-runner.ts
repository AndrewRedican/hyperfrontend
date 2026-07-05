/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
import type { OutputOptions, Plugin, RollupLog, RollupOptions } from 'rollup'
import type { WorkspaceBundledDepRoute } from '../../dependencies/externalize-plugin'
import type { RollupBuildDescriptor, RollupWorkerReport } from './types'
import { chmodSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { rollup } from 'rollup'
import { createExternalizeBundledDepsPlugin } from '../../dependencies/externalize-plugin'

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

const importMatchesWorkspaceRoute = (id: string | undefined, routes: WorkspaceBundledDepRoute[]): boolean => {
  /* istanbul ignore if -- @preserve defensive: rollup always populates `exporter` on UNRESOLVED_IMPORT warnings */
  if (id === undefined) return false
  for (const route of routes) {
    if (id === route.packageName || id.startsWith(`${route.packageName}/`)) return true
  }
  return false
}

const onWarnEntry = (warning: RollupLog, defaultHandler: (w: RollupLog) => void, workspaceRoutes: WorkspaceBundledDepRoute[]): void => {
  // why: under bundleAllDeps the externalize plugin is the sole owner of workspace-dep resolution; an unresolved import of a routed package means it slipped past routing and would ship as a bare external specifier — fail loud rather than emit a broken artifact.
  if (warning.code === 'UNRESOLVED_IMPORT' && importMatchesWorkspaceRoute(warning.exporter, workspaceRoutes)) {
    throw new Error(
      `bundle: workspace import "${warning.exporter}" was not routed into _dependencies/ and would leak as an external import. Confirm it is declared in package.json#dependencies and mapped in tsconfig paths; subpath-only packages require a 'sub-path' workspaceDepPolicy entry.`
    )
  }
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

const buildExternalPredicate = (externals: string[]): ((id: string) => boolean) => {
  const set = new Set<string>(externals)
  return (id: string): boolean => set.has(id)
}

const buildEntryPlugins = (job: RollupBuildDescriptor, format: 'esm' | 'cjs'): Plugin[] => {
  const plugins: Plugin[] = []
  const hasWorkspaceRoutes = job.workspaceRoutes.length > 0
  if (job.bundledDepsPlugin) {
    plugins.push(
      <Plugin>createExternalizeBundledDepsPlugin({
        deps: job.bundledDepsPlugin.deps,
        entryOutDir: job.outputDir,
        format,
        depsRoot: job.bundledDepsPlugin.depsRoot,
        workspaceRoutes: job.workspaceRoutes,
      })
    )
  }
  // why: when workspaceRoutes is populated, the externalize plugin owns @hyperfrontend/* resolution; the typescript plugin's baseUrl path-mapping must not preempt it. Falling through to the paths:{} branch lets externalize win.
  const useBaseUrlMapping = job.bundleWorkspaceDeps && !hasWorkspaceRoutes
  plugins.push(
    <Plugin>json(),
    <Plugin>nodeResolve({ extensions: ['.ts', '.js'] }),
    <Plugin>commonjs(),
    useBaseUrlMapping ? <Plugin>typescript({
          tsconfig: job.tsConfigPath,
          declaration: false,
          declarationMap: false,
          sourceMap: job.sourcemap,
          // why: without an explicit anchor the plugin resolves its include filter against process.cwd(); the worker inherits the caller's cwd, so sources outside it would silently skip the TS transform and reach rollup as raw TypeScript.
          filterRoot: job.workspaceRoot,
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
    // why: without an explicit anchor the plugin resolves its include filter against process.cwd(); the worker inherits the caller's cwd, so sources outside it would silently skip the TS transform and reach rollup as raw TypeScript.
    filterRoot: job.workspaceRoot,
    compilerOptions: {
      baseUrl: job.workspaceRoot,
      outDir: job.outputDir,
    },
  }),
]

const buildEntryOutput = (job: RollupBuildDescriptor, format: 'esm' | 'cjs'): OutputOptions => {
  if (job.bin) {
    return {
      file: job.bin.outputFile,
      format,
      sourcemap: job.sourcemap,
      banner: job.bin.banner,
      footer: job.bin.footer,
      exports: job.bin.exports,
      inlineDynamicImports: job.bin.inlineDynamicImports,
      generatedCode: { constBindings: true },
      ...(format === 'cjs' && { interop: <const>'compat' }),
    }
  }
  const filename = format === 'esm' ? 'index.esm.js' : 'index.cjs.js'
  return {
    file: join(job.outputDir, filename),
    format,
    sourcemap: job.sourcemap,
    generatedCode: { constBindings: true },
    ...(format === 'cjs' && { interop: <const>'compat' }),
  }
}

const buildEsmJob = (job: RollupBuildDescriptor): PreparedRollupJob => ({
  config: {
    input: job.inputFile,
    external: buildExternalPredicate(job.external),
    onwarn: (warning, defaultHandler) => onWarnEntry(warning, defaultHandler, job.workspaceRoutes),
    plugins: buildEntryPlugins(job, 'esm'),
  },
  outputs: [buildEntryOutput(job, 'esm')],
})

const buildCjsJob = (job: RollupBuildDescriptor): PreparedRollupJob => ({
  config: {
    input: job.inputFile,
    external: buildExternalPredicate(job.external),
    onwarn: (warning, defaultHandler) => onWarnEntry(warning, defaultHandler, job.workspaceRoutes),
    plugins: buildEntryPlugins(job, 'cjs'),
  },
  outputs: [buildEntryOutput(job, 'cjs')],
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
 * Use this to drive the worker logic in-process; use {@link dispatchRollupWorker}
 * to run the same job in a forked Node process.
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
  if (job.bin) {
    chmodSync(job.bin.outputFile, job.bin.chmod)
  }
  const memory = process.memoryUsage()
  const report: RollupWorkerReport = {
    outputSize: totalSize,
    endHeapMB: memory.heapUsed / BYTES_PER_MB,
    endRssMB: memory.rss / BYTES_PER_MB,
    durationMs: Date.now() - startedAt,
  }
  writeFileSync(job.reportPath, JSON.stringify(report))
  return report
}
