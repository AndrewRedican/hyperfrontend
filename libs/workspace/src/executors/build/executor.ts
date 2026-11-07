/**
 * The `build` executor: builds a library into a publishable package with
 * `@hyperfrontend/builder`. The packages the workspace's own projects carry are first-party: they
 * are bundled where a format asks for it and left out of the published dependencies. The
 * repository fields come from the workspace's root manifest.
 *
 * @module executors/build/executor
 */

import type { AssetSpec, BinConfig, BuildConfig, CjsConfig, EsmConfig, IifeConfig, MemoryMonitorOptions, UmdConfig } from '@hyperfrontend/builder/models'
import type { Executor } from '../../runner/contract'
import { build } from '@hyperfrontend/builder'
import { byNames } from '@hyperfrontend/builder/presets'
import { join } from '@hyperfrontend/project-scope/core'
import { logger } from '../shared/logger'
import { workspacePackages } from '../shared/workspace'
import { rootAssetSpecs } from './root-assets'

/**
 * Schema-validated executor options. Mirrors `BuildConfig` from
 * `@hyperfrontend/builder/models` minus what the executor decides for every
 * workspace (`isWorkspacePackage`, `filterWorkspaceDepsFromOutput`,
 * `inheritFieldsFrom`, `thirdPartyLicenses`, `memoryMonitor`).
 */
export interface BuildExecutorOptions {
  /** Output directory, relative to the workspace root. Defaults to `dist/<project root>`. */
  outputPath?: string
  /** Path to tsconfig, relative to the workspace root. Defaults to `<project root>/tsconfig.lib.json`. */
  tsConfig?: string
  /** Files at the workspace root copied into the package when they exist, such as a licence. `FUNDING.md` is copied only into a package that declares `funding`. */
  rootAssets?: string[]
  /** Additional asset specs to copy in addition to the project's README and changelog and the root assets. */
  assets?: AssetSpec[]
  /** Global externals applied to every format. */
  external?: string[]
  /** ESM output configuration. Omit to skip. */
  esm?: EsmConfig | EsmConfig[]
  /** CommonJS output configuration. Omit to skip. */
  cjs?: CjsConfig | CjsConfig[]
  /** IIFE bundle configuration. Omit to skip. */
  iife?: IifeConfig | IifeConfig[]
  /** UMD bundle configuration. Omit to skip. */
  umd?: UmdConfig | UmdConfig[]
  /** Override path for the unpkg field. Defaults to the first UMD bundle path. */
  unpkg?: string
  /** Override path for the jsdelivr field. Defaults to the first UMD bundle path. */
  jsdelivr?: string
  /** Bin declarations to synthesize alongside the library. */
  bin?: BinConfig[]
  /** Hoist first-party modules shared across entry bundles into `_shared/` chunks. Defaults to enabled. */
  dedupeSharedInternals?: boolean
  /** Enable verbose / debug logging. */
  verbose?: boolean
  /** Empty the output directory before emitting. Defaults to enabled; only an empty directory or a previous build of this package is removed. */
  clean?: boolean
}

/** The fields a package takes from the workspace's root manifest. */
const INHERITED_FIELDS: readonly string[] = ['repository', 'bugs', 'homepage', 'author']

/** The files of a project copied into its package. */
const PROJECT_ASSETS: readonly string[] = ['README.md', 'CHANGELOG.md']

/** When the build warns about its memory. */
const MEMORY_THRESHOLDS: MemoryMonitorOptions = { warningMB: 512, criticalMB: 768, growthMB: 50 }

/**
 * Builds a library into a publishable package.
 *
 * @param options - The formats, entries, assets and bins to build
 * @param context - The workspace, the project and the target the task runs on
 * @returns Whether the build succeeded
 *
 * @example A `build` target writing ESM, CommonJS and a browser bundle
 * ```json
 * {
 *   "targets": {
 *     "build": {
 *       "executor": "@hyperfrontend/workspace:build",
 *       "options": {
 *         "esm": { "bundleWorkspaceDeps": true },
 *         "cjs": { "bundleWorkspaceDeps": true },
 *         "umd": { "entry": ".", "globalName": "AcmeCore" },
 *         "rootAssets": ["LICENSE", "FUNDING.md"]
 *       }
 *     }
 *   }
 * }
 * ```
 * Run with `npx hf run lib-core:build`; the package lands in `dist/libs/core` unless `outputPath` says otherwise.
 */
export const buildExecutor: Executor<BuildExecutorOptions> = async (options, context) => {
  const { projectName, root: workspaceRoot } = context

  logger.setLogLevel(options.verbose ? 'debug' : 'log')

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const projectRoot = join(workspaceRoot, projectConfig.root)
  const config: BuildConfig = {
    projectRoot,
    workspaceRoot,
    outputPath: options.outputPath ? join(workspaceRoot, options.outputPath) : undefined,
    tsConfig: options.tsConfig ? join(workspaceRoot, options.tsConfig) : undefined,
    isWorkspacePackage: byNames(workspacePackages(workspaceRoot, context.projects)),
    filterWorkspaceDepsFromOutput: true,
    inheritFieldsFrom: { from: join(workspaceRoot, 'package.json'), fields: [...INHERITED_FIELDS] },
    assets: [
      { from: projectRoot, files: [...PROJECT_ASSETS] },
      ...rootAssetSpecs(workspaceRoot, options.rootAssets ?? []),
      ...(options.assets ?? []),
    ],
    external: options.external,
    esm: options.esm,
    cjs: options.cjs,
    iife: options.iife,
    umd: options.umd,
    unpkg: options.unpkg,
    jsdelivr: options.jsdelivr,
    bin: options.bin,
    dedupeSharedInternals: options.dedupeSharedInternals,
    thirdPartyLicenses: true,
    memoryMonitor: MEMORY_THRESHOLDS,
    verbose: options.verbose,
    clean: options.clean,
  }

  try {
    await build(config)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to build ${projectName}`)
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`)
      if (error.stack) logger.debug(`Stack trace:\n${error.stack}`)
    } else {
      logger.error(String(error))
    }
    return { success: false }
  }
}
