import type { ExecutorContext } from '@nx/devkit'
import type { RollupOptions } from 'rollup'
import type { BuildV2ExecutorOptions, BuildContext, FormatOutputs } from './lib'
import { joinPathFragments, logger } from '@nx/devkit'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { rollup } from 'rollup'
import { resolveOutputPath, resolveTsConfigPath } from './lib/paths'
import { discoverEntryPoints, resolveEntries } from './lib/entry-resolver'
import { createESMConfig } from './lib/config-esm'
import { createCJSConfig } from './lib/config-cjs'
import { createIIFEConfig } from './lib/config-iife'
import { createUMDConfig } from './lib/config-umd'
import { generateDeclarations } from './lib/declarations'
import { generatePackageJson, readProjectPackageJson, hasFunding } from './lib/package-json'
import { copyAssets, copyDefaultAssets, copyFundingAsset, copyThirdPartyLicensesAsset } from './lib/assets'

/**
 * Normalizes a format configuration to always be an array.
 *
 * @param config - Single config or array of configs
 * @returns Array of configs
 */
function normalizeToArray<T>(config: T | T[] | undefined): T[] {
  if (config === undefined) return []
  return Array.isArray(config) ? config : [config]
}

/**
 * Executes all Rollup configurations and writes outputs.
 *
 * @param configs - Array of Rollup configurations
 */
async function executeRollupConfigs(configs: RollupOptions[]): Promise<void> {
  for (const config of configs) {
    const bundle = await rollup(config)

    try {
      const outputs = Array.isArray(config.output) ? config.output : config.output ? [config.output] : []
      for (const output of outputs) {
        await bundle.write(output)
      }
    } finally {
      await bundle.close()
    }
  }
}

/**
 * Build executor V2 for hyperfrontend library packages.
 *
 * Format-centric build executor with explicit output configuration.
 * All output formats (ESM, CJS, IIFE, UMD) are opt-in.
 *
 * @param options - Build executor options
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function runExecutor(options: BuildV2ExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  const { projectName, root: workspaceRoot } = context

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

  try {
    for (const esmConfig of esmConfigs) {
      const entries = resolveEntries(esmConfig, discovery.entryPoints)
      if (entries.length > 0) {
        logger.info(`Building ESM (${entries.length} entries)...`)
        const rollupConfigs = createESMConfig(entries, esmConfig, buildContext)
        await executeRollupConfigs(rollupConfigs)
        formatOutputs.esm.push(...entries)
        for (const entry of entries) {
          logger.info(`  Built ESM: ${entry.exportPath}`)
        }
      }
    }

    for (const cjsConfig of cjsConfigs) {
      const entries = resolveEntries(cjsConfig, discovery.entryPoints)
      if (entries.length > 0) {
        logger.info(`Building CJS (${entries.length} entries)...`)
        const rollupConfigs = createCJSConfig(entries, cjsConfig, buildContext)
        await executeRollupConfigs(rollupConfigs)
        formatOutputs.cjs.push(...entries)
        for (const entry of entries) {
          logger.info(`  Built CJS: ${entry.exportPath}`)
        }
      }
    }

    for (const iifeConfig of iifeConfigs) {
      const entries = resolveEntries(iifeConfig, discovery.entryPoints)
      if (entries.length > 0) {
        const bundleDir = iifeConfig.output ?? 'bundle'
        const bundlePath = join(outputPath, bundleDir)
        mkdirSync(bundlePath, { recursive: true })

        logger.info(`Building IIFE bundle (${entries.length} entries)...`)
        const rollupConfigs = createIIFEConfig(entries, iifeConfig, buildContext)
        await executeRollupConfigs(rollupConfigs)
        formatOutputs.iife.push({ config: iifeConfig, entries })
        logger.info(`  Built IIFE: ${bundleDir}/ (global: ${iifeConfig.globalName})`)
      }
    }

    for (const umdConfig of umdConfigs) {
      const entries = resolveEntries(umdConfig, discovery.entryPoints)
      if (entries.length > 0) {
        const bundleDir = umdConfig.output ?? 'bundle'
        const bundlePath = join(outputPath, bundleDir)
        mkdirSync(bundlePath, { recursive: true })

        logger.info(`Building UMD bundle (${entries.length} entries)...`)
        const rollupConfigs = createUMDConfig(entries, umdConfig, buildContext)
        await executeRollupConfigs(rollupConfigs)
        formatOutputs.umd.push({ config: umdConfig, entries })
        logger.info(`  Built UMD: ${bundleDir}/ (global: ${umdConfig.globalName})`)
      }
    }

    generateDeclarations(projectRoot, outputPath, tsConfigPath, workspaceRoot, discovery)

    const srcPkg = readProjectPackageJson(projectRoot)
    generatePackageJson(srcPkg, outputPath, discovery, workspaceRoot, formatOutputs)

    copyDefaultAssets(projectRoot, outputPath, workspaceRoot)

    copyThirdPartyLicensesAsset(projectRoot, outputPath, workspaceRoot)

    if (hasFunding(srcPkg)) {
      copyFundingAsset(outputPath, workspaceRoot)
    }

    if (assets.length > 0) {
      copyAssets(assets, projectRoot, outputPath, workspaceRoot)
    }

    logger.info(`Successfully built ${projectName}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to build ${projectName}`)
    logger.error(error instanceof Error ? error.message : String(error))
    return { success: false }
  }
}
