import type { ExecutorContext, PromiseExecutor } from '@nx/devkit'
import type { AssetSpec, BinConfig, BuildConfig, CjsConfig, EsmConfig, IifeConfig, PackageJson, UmdConfig } from '@hyperfrontend/builder/models'
import { build } from '@hyperfrontend/builder'
import { byPrefix } from '@hyperfrontend/builder/presets'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'
import {
  DEFAULT_PROJECT_ASSETS,
  DEFAULT_WORKSPACE_ASSETS,
  FUNDING_ASSET,
  INHERITABLE_FIELDS,
  MEMORY_THRESHOLDS,
  WORKSPACE_SCOPE,
} from './wrapper-config'

/**
 * Schema-validated executor options. Mirrors `BuildConfig` from
 * `@hyperfrontend/builder/models` minus the monorepo-specific knobs that this
 * wrapper hardcodes (`isWorkspacePackage`, `filterWorkspaceDepsFromOutput`,
 * `inheritFieldsFrom`, `thirdPartyLicenses`, `memoryMonitor`).
 */
export interface BuildExecutorOptions {
  /** Output directory. Supports `{projectRoot}` placeholder. Defaults to `dist/{projectRoot}`. */
  outputPath?: string
  /** Path to tsconfig. Supports `{projectRoot}` placeholder. Defaults to `{projectRoot}/tsconfig.lib.json`. */
  tsConfig?: string
  /** Additional asset specs to copy in addition to the wrapper's defaults. */
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
  /** Enable verbose / debug logging. */
  verbose?: boolean
}

const substituteProjectRoot = (template: string, projectRelativePath: string): string =>
  template.replace('{projectRoot}', projectRelativePath)

const runExecutor: PromiseExecutor<BuildExecutorOptions> = async (options, context: ExecutorContext) => {
  const { projectName, root: workspaceRoot } = context

  logger.setLogLevel(options.verbose ? 'debug' : 'log')

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const projectRelativePath = projectConfig.root
  const projectRoot = join(workspaceRoot, projectRelativePath)
  const outputPath = options.outputPath
    ? join(workspaceRoot, substituteProjectRoot(options.outputPath, projectRelativePath))
    : undefined
  const tsConfig = options.tsConfig
    ? join(workspaceRoot, substituteProjectRoot(options.tsConfig, projectRelativePath))
    : undefined

  const config: BuildConfig = {
    projectRoot,
    workspaceRoot,
    outputPath,
    tsConfig,
    isWorkspacePackage: byPrefix(WORKSPACE_SCOPE),
    filterWorkspaceDepsFromOutput: true,
    inheritFieldsFrom: { from: join(workspaceRoot, 'package.json'), fields: [...INHERITABLE_FIELDS] },
    assets: [
      { from: projectRoot, files: [...DEFAULT_PROJECT_ASSETS] },
      { from: workspaceRoot, files: [...DEFAULT_WORKSPACE_ASSETS] },
      { from: workspaceRoot, files: [FUNDING_ASSET], condition: (pkg: PackageJson) => Boolean(pkg.funding) },
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
    thirdPartyLicenses: true,
    memoryMonitor: MEMORY_THRESHOLDS,
    verbose: options.verbose,
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

export default runExecutor
