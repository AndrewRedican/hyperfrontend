import type { ExecutorContext } from '@nx/devkit'
import type { RollupOptions } from 'rollup'
import type { BuildExecutorOptions, BuildContext, FormatOutputs, EntryPoint, ESMConfig, CJSConfig } from './lib'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { joinPathFragments } from '@nx/devkit'
import { rollup } from 'rollup'
import {isArray} from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import {dateNow} from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import {keys} from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import {createPromise} from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { copyAssets, copyDefaultAssets, copyFundingAsset, copyThirdPartyLicensesAsset } from './lib/assets'
import { createCJSEntryConfig } from './lib/config-cjs'
import { createESMEntryConfig } from './lib/config-esm'
import { createIIFEConfig } from './lib/config-iife'
import { createUMDConfig } from './lib/config-umd'
import { generateDeclarations } from './lib/declarations'
import { discoverEntryPoints, resolveEntries } from './lib/entry-resolver'
import { getLogger } from './lib/logger'
import { generatePackageJson, readProjectPackageJson, hasFunding } from './lib/package-json'
import { resolveOutputPath, resolveTsConfigPath } from './lib/paths'

// Memory thresholds in MB
const MEMORY_WARNING_THRESHOLD_MB = 512
const MEMORY_CRITICAL_THRESHOLD_MB = 768
const MEMORY_GROWTH_WARNING_MB = 50 // Warn if single operation grows heap by this much

/**
 * Memory snapshot for tracking usage over time.
 */
interface MemorySnapshot {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  timestamp: number
}

/**
 * Memory monitor for tracking and warning about memory usage.
 */
class MemoryMonitor {
  private readonly logger: ReturnType<typeof getLogger>
  private readonly snapshots: MemorySnapshot[] = []
  private peakHeapUsed = 0
  private warningCount = 0

  constructor(logger: ReturnType<typeof getLogger>) {
    this.logger = logger
  }

  /**
   * Takes a memory snapshot and returns it.
   *
   * @returns Current memory snapshot
   */
  snapshot(): MemorySnapshot {
    const mem = process.memoryUsage()
    const snap: MemorySnapshot = {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      timestamp: dateNow(),
    }

    if (snap.heapUsed > this.peakHeapUsed) {
      this.peakHeapUsed = snap.heapUsed
    }

    this.snapshots.push(snap)
    return snap
  }

  /**
   * Formats bytes to human-readable MB string.
   *
   * @param bytes - Number of bytes to format
   * @returns Formatted string in MB
   */
  private formatMB(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  /**
   * Checks current memory and logs warnings if thresholds exceeded.
   *
   * @param context - Context label for logging
   * @returns Current memory snapshot
   */
  check(context: string): MemorySnapshot {
    const snap = this.snapshot()
    const heapMB = snap.heapUsed / 1024 / 1024

    if (heapMB >= MEMORY_CRITICAL_THRESHOLD_MB) {
      this.warningCount++
      this.logger.warn(
        `[MEMORY CRITICAL] ${context}: Heap ${this.formatMB(snap.heapUsed)} exceeds ${MEMORY_CRITICAL_THRESHOLD_MB}MB threshold`
      )
    } else if (heapMB >= MEMORY_WARNING_THRESHOLD_MB) {
      this.warningCount++
      this.logger.warn(
        `[MEMORY WARNING] ${context}: Heap ${this.formatMB(snap.heapUsed)} exceeds ${MEMORY_WARNING_THRESHOLD_MB}MB threshold`
      )
    }

    return snap
  }

  /**
   * Checks memory growth between two snapshots.
   * Warns if growth exceeds threshold.
   *
   * @param before - Snapshot before operation
   * @param after - Snapshot after operation
   * @param context - Context label for logging
   */
  checkGrowth(before: MemorySnapshot, after: MemorySnapshot, context: string): void {
    const growthBytes = after.heapUsed - before.heapUsed
    const growthMB = growthBytes / 1024 / 1024

    if (growthMB >= MEMORY_GROWTH_WARNING_MB) {
      this.warningCount++
      this.logger.warn(
        `[MEMORY GROWTH] ${context}: Heap grew by ${this.formatMB(growthBytes)} (${this.formatMB(before.heapUsed)} -> ${this.formatMB(after.heapUsed)})`
      )
    }
  }

  /**
   * Logs debug info about current memory state.
   *
   * @param context - Context label for logging
   */
  logDebug(context: string): void {
    const snap = this.snapshot()
    this.logger.debug(
      `[MEMORY] ${context}: heap=${this.formatMB(snap.heapUsed)}/${this.formatMB(snap.heapTotal)}, ` +
        `rss=${this.formatMB(snap.rss)}, external=${this.formatMB(snap.external)}`
    )
  }

  /**
   * Logs final memory summary.
   */
  logSummary(): void {
    const final = this.snapshot()
    const initial = this.snapshots[0]

    this.logger.info(`Memory summary:`)
    this.logger.info(`  Peak heap: ${this.formatMB(this.peakHeapUsed)}`)
    this.logger.info(`  Final heap: ${this.formatMB(final.heapUsed)}`)
    this.logger.info(`  Net change: ${this.formatMB(final.heapUsed - initial.heapUsed)}`)
    this.logger.info(`  Warnings issued: ${this.warningCount}`)
  }

  /**
   * Attempts to trigger garbage collection if --expose-gc flag is set.
   *
   * @returns True if GC was triggered, false otherwise
   */
  tryGC(): boolean {
    if (typeof global.gc === 'function') {
      global.gc()
      return true
    }
    return false
  }

  /**
   * Attempts GC and yields to event loop for memory recovery.
   *
   * @param context - Context label for logging
   */
  async recover(context: string): Promise<void> {
    const before = this.snapshot()

    // Try explicit GC if available
    const gcTriggered = this.tryGC()

    // Yield to event loop
    await createPromise<void>((resolve) => setImmediate(resolve))

    const after = this.snapshot()
    const recovered = before.heapUsed - after.heapUsed

    if (recovered > 0) {
      this.logger.debug(
        `[MEMORY] ${context}: Recovered ${this.formatMB(recovered)}${gcTriggered ? ' (explicit GC)' : ''}`
      )
    }
  }
}

/**
 * Normalizes a format configuration to always be an array.
 *
 * @param config - Single config or array of configs
 * @returns Array of configs
 */
function normalizeToArray<T>(config: T | T[] | undefined): T[] {
  if (config === undefined) return []
  return isArray(config) ? config : [config]
}

/**
 * Executes a single Rollup configuration and writes outputs.
 * Creates bundle, writes, closes, then explicitly clears references.
 * Designed for minimal memory footprint.
 *
 * @param config - Rollup configuration
 * @param entryLabel - Label for logging
 * @param logger - Logger instance
 * @param memMonitor - Memory monitor instance
 */
async function executeRollupConfig(
  config: RollupOptions,
  entryLabel: string,
  logger: ReturnType<typeof getLogger>,
  memMonitor: MemoryMonitor
): Promise<void> {
  const before = memMonitor.check(`pre-rollup:${entryLabel}`)
  logger.debug(`Starting rollup for ${entryLabel}`)

  let bundle = await rollup(config)

  try {
    const outputs = isArray(config.output) ? config.output : config.output ? [config.output] : []
    for (const output of outputs) {
      logger.debug(`Writing output for ${entryLabel}`)
      await bundle.write(output)
    }
  } finally {
    await bundle.close()
    // Clear bundle reference immediately for GC
    // eslint-disable-next-line no-useless-assignment -- intentional: GC hint
    bundle = <never>null
  }

  // Clear config reference (caller's copy remains)
  const configKeys = <(keyof RollupOptions)[]>keys(config)
  for (const key of configKeys) {
    ;(<Record<string, unknown>>config)[key] = undefined
  }

  const after = memMonitor.check(`post-rollup:${entryLabel}`)
  memMonitor.checkGrowth(before, after, entryLabel)
}

/**
 * Builds a single entry point for a given format.
 * Creates config fresh, executes, clears references, and recovers memory.
 *
 * @param format - Output format (ESM or CJS)
 * @param entry - Entry point to build
 * @param config - Format-specific configuration
 * @param buildContext - Build context with paths and settings
 * @param logger - Logger instance for output
 * @param memMonitor - Memory monitor instance
 */
async function buildSingleEntry(
  format: 'ESM' | 'CJS',
  entry: EntryPoint,
  config: ESMConfig | CJSConfig,
  buildContext: BuildContext,
  logger: ReturnType<typeof getLogger>,
  memMonitor: MemoryMonitor
): Promise<void> {
  // Create config just-in-time for this entry
  let rollupConfig: RollupOptions | null =
    format === 'ESM'
      ? createESMEntryConfig(entry, <ESMConfig>config, buildContext)
      : createCJSEntryConfig(entry, <CJSConfig>config, buildContext)

  await executeRollupConfig(rollupConfig, entry.exportPath, logger, memMonitor)

  // Clear the config reference
  // eslint-disable-next-line no-useless-assignment -- intentional: GC hint
  rollupConfig = null

  // Recover memory between entries
  await memMonitor.recover(`after:${entry.exportPath}`)
}

/**
 * Build executor V2 for hyperfrontend library packages.
 *
 * Format-centric build executor with explicit output configuration.
 * All output formats (ESM, CJS, IIFE, UMD) are opt-in.
 * Includes memory monitoring with threshold warnings.
 *
 * @param options - Build executor options
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function runExecutor(options: BuildExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  const { projectName, root: workspaceRoot } = context
  const logger = getLogger()
  logger.setLogLevel(options.verbose ?? false)

  // Initialize memory monitor
  const memMonitor = new MemoryMonitor(logger)
  memMonitor.logDebug('executor-start')

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const projectRoot = join(workspaceRoot, projectConfig.root)
  const projectRelativePath = projectConfig.root

  const outputPath = resolveOutputPath(
    options.outputPath ?? joinPathFragments('dist', projectRelativePath),
    projectRelativePath,
    workspaceRoot
  )
  const tsConfigPath = resolveTsConfigPath(
    options.tsConfig ?? joinPathFragments(projectRelativePath, 'tsconfig.lib.json'),
    projectRelativePath,
    workspaceRoot
  )
  const assets = options.assets ?? []

  const esmConfigs = normalizeToArray(options.esm)
  const cjsConfigs = normalizeToArray(options.cjs)
  const iifeConfigs = normalizeToArray(options.iife)
  const umdConfigs = normalizeToArray(options.umd)

  const hasAnyFormat = esmConfigs.length > 0 || cjsConfigs.length > 0 || iifeConfigs.length > 0 || umdConfigs.length > 0

  if (!hasAnyFormat) {
    logger.error('At least one output format (esm, cjs, iife, umd) must be configured')
    return { success: false }
  }

  logger.info(`Building ${projectName}...`)
  logger.info(`  Project root: ${projectRoot}`)
  logger.info(`  Output path: ${outputPath}`)
  logger.info(`  TS config: ${tsConfigPath}`)

  const formats: string[] = []
  if (esmConfigs.length > 0) formats.push('ESM')
  if (cjsConfigs.length > 0) formats.push('CJS')
  if (iifeConfigs.length > 0) formats.push('IIFE')
  if (umdConfigs.length > 0) formats.push('UMD')
  logger.info(`  Formats: ${formats.join(', ')}`)

  const discovery = discoverEntryPoints(projectRoot)
  logger.info(`  Entry point category: ${discovery.category}`)
  logger.info(`  Entry points: ${discovery.entryPoints.map((e) => e.exportPath).join(', ')}`)

  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true })
  }
  mkdirSync(outputPath, { recursive: true })

  const buildContext: BuildContext = {
    projectRoot,
    projectRelativePath,
    outputPath,
    tsConfigPath,
    external: options.external ?? [],
    assets,
    entryPointDiscovery: discovery,
    workspaceRoot,
    context,
  }

  const formatOutputs: FormatOutputs = {
    esm: [],
    cjs: [],
    iife: [],
    umd: [],
  }

  const buildStart = dateNow()

  try {
    // Build ESM - one entry at a time for memory efficiency
    for (const esmConfig of esmConfigs) {
      const entries = resolveEntries(esmConfig, discovery.entryPoints)
      if (entries.length > 0) {
        logger.info(`Building ESM (${entries.length} entries)...`)
        memMonitor.check('esm-phase-start')

        for (const entry of entries) {
          await logger.timedAsync(`ESM ${entry.exportPath}`, async () => {
            await buildSingleEntry('ESM', entry, esmConfig, buildContext, logger, memMonitor)
          })
          logger.info(`  Built ESM: ${entry.exportPath}`)
        }

        formatOutputs.esm.push(...entries)
        memMonitor.check('esm-phase-end')
      }
    }

    // Build CJS - one entry at a time for memory efficiency
    for (const cjsConfig of cjsConfigs) {
      const entries = resolveEntries(cjsConfig, discovery.entryPoints)
      if (entries.length > 0) {
        logger.info(`Building CJS (${entries.length} entries)...`)
        memMonitor.check('cjs-phase-start')

        for (const entry of entries) {
          await logger.timedAsync(`CJS ${entry.exportPath}`, async () => {
            await buildSingleEntry('CJS', entry, cjsConfig, buildContext, logger, memMonitor)
          })
          logger.info(`  Built CJS: ${entry.exportPath}`)
        }

        formatOutputs.cjs.push(...entries)
        memMonitor.check('cjs-phase-end')
      }
    }

    // Build IIFE - one at a time for memory safety
    for (const iifeConfig of iifeConfigs) {
      const entries = resolveEntries(iifeConfig, discovery.entryPoints)
      if (entries.length > 0) {
        const bundleDir = iifeConfig.output ?? 'bundle'
        const bundlePath = join(outputPath, bundleDir)
        mkdirSync(bundlePath, { recursive: true })

        logger.info(`Building IIFE bundle (${entries.length} entries)...`)
        memMonitor.check('iife-phase-start')
        const rollupConfigs = createIIFEConfig(entries, iifeConfig, buildContext)

        for (const config of rollupConfigs) {
          await logger.timedAsync(`IIFE bundle`, async () => {
            await executeRollupConfig(config, 'IIFE', logger, memMonitor)
          })
          await memMonitor.recover('iife-entry')
        }

        formatOutputs.iife.push({ config: iifeConfig, entries })
        logger.info(`  Built IIFE: ${bundleDir}/ (global: ${iifeConfig.globalName})`)
        memMonitor.check('iife-phase-end')
      }
    }

    // Build UMD - one at a time for memory safety
    for (const umdConfig of umdConfigs) {
      const entries = resolveEntries(umdConfig, discovery.entryPoints)
      if (entries.length > 0) {
        const bundleDir = umdConfig.output ?? 'bundle'
        const bundlePath = join(outputPath, bundleDir)
        mkdirSync(bundlePath, { recursive: true })

        logger.info(`Building UMD bundle (${entries.length} entries)...`)
        memMonitor.check('umd-phase-start')
        const rollupConfigs = createUMDConfig(entries, umdConfig, buildContext)

        for (const config of rollupConfigs) {
          await logger.timedAsync(`UMD bundle`, async () => {
            await executeRollupConfig(config, 'UMD', logger, memMonitor)
          })
          await memMonitor.recover('umd-entry')
        }

        formatOutputs.umd.push({ config: umdConfig, entries })
        logger.info(`  Built UMD: ${bundleDir}/ (global: ${umdConfig.globalName})`)
        memMonitor.check('umd-phase-end')
      }
    }

    // Recover memory before declarations
    await memMonitor.recover('pre-declarations')

    // Generate declarations
    logger.debug('Generating TypeScript declarations...')
    memMonitor.check('declarations-start')
    logger.timed('TypeScript declarations', () => {
      generateDeclarations(projectRoot, outputPath, tsConfigPath, workspaceRoot, discovery)
    })
    memMonitor.check('declarations-end')

    // Generate package.json
    const srcPkg = readProjectPackageJson(projectRoot)
    generatePackageJson(srcPkg, outputPath, discovery, workspaceRoot, formatOutputs, options)

    // Copy assets
    copyDefaultAssets(projectRoot, outputPath, workspaceRoot)
    copyThirdPartyLicensesAsset(projectRoot, outputPath, workspaceRoot)

    if (hasFunding(srcPkg)) {
      copyFundingAsset(outputPath, workspaceRoot)
    }

    if (assets.length > 0) {
      copyAssets(assets, projectRoot, outputPath, workspaceRoot)
    }

    const totalTime = dateNow() - buildStart
    logger.info(`Successfully built ${projectName} in ${totalTime}ms`)
    memMonitor.logSummary()
    return { success: true }
  } catch (error) {
    const totalTime = dateNow() - buildStart
    logger.error(`Failed to build ${projectName} after ${totalTime}ms`)
    memMonitor.logSummary()
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`)
      if (error.stack) {
        logger.debug(`Stack trace:\n${error.stack}`)
      }
    } else {
      logger.error(String(error))
    }
    return { success: false }
  }
}
