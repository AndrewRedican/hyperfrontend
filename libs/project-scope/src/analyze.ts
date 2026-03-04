import type {
  AnalysisMetadata,
  AnalysisResult,
  BuildToolInfo,
  ConfigFileInfo,
  DependencySummary,
  EntryPointInfo,
  FrameworkInfo,
  ProjectType,
  TestingInfo,
  WorkspaceType,
} from './models'
import { basename, resolve } from 'node:path'
import { createDate, dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { exists } from './core/fs'
import { createScopedLogger } from './core/logger'
import { getProjectDependencies } from './heuristics/dependencies'
import { discoverEntryPoints } from './heuristics/entry-points'
import { detectProjectType } from './heuristics/project-type'
import { isNxWorkspace, findNxWorkspaceRoot } from './nx'
import { detectConfigs } from './project/config'
import { readPackageJsonIfExists } from './project/package'
import { detectAll } from './tech'

/** Library version for metadata */
const VERSION = '0.1.0'

/** Logger for analysis operations */
const analyzeLogger = createScopedLogger('project-scope:analyze')

/**
 * Options for project analysis.
 */
export interface AnalyzeOptions {
  /** Analysis depth */
  depth?: 'basic' | 'full' | 'deep'
  /** Specific analyses to include */
  include?: Array<'frameworks' | 'buildTools' | 'testing' | 'entryPoints' | 'configs' | 'dependencies'>
  /** Analyses to skip */
  exclude?: Array<'frameworks' | 'buildTools' | 'testing' | 'entryPoints' | 'configs' | 'dependencies'>
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Determine workspace type from project path.
 *
 * @param projectPath - Project directory path
 * @returns Detected workspace type
 */
function detectWorkspaceType(projectPath: string): WorkspaceType {
  // Check for NX
  if (isNxWorkspace(projectPath) || findNxWorkspaceRoot(projectPath) !== null) {
    return 'nx'
  }

  // Check for common monorepo markers
  if (exists(resolve(projectPath, 'turbo.json'))) {
    return 'turborepo'
  }

  if (exists(resolve(projectPath, 'lerna.json'))) {
    return 'lerna'
  }

  if (exists(resolve(projectPath, 'pnpm-workspace.yaml'))) {
    return 'pnpm'
  }

  // Check package.json for workspaces
  const pkg = readPackageJsonIfExists(projectPath)
  if (pkg?.workspaces) {
    if (exists(resolve(projectPath, 'yarn.lock'))) {
      return 'yarn'
    }
    if (exists(resolve(projectPath, 'package-lock.json'))) {
      return 'npm'
    }
    return 'npm' // default for workspaces
  }

  return 'standalone'
}

/**
 * Check if an analysis type should be included.
 *
 * @param type - Analysis type to check
 * @param options - Analysis options
 * @returns True if the analysis should be performed
 */
function shouldInclude(
  type: 'frameworks' | 'buildTools' | 'testing' | 'entryPoints' | 'configs' | 'dependencies',
  options?: AnalyzeOptions
): boolean {
  // If include list is specified, item must be in it
  if (options?.include && options.include.length > 0) {
    return options.include.includes(type)
  }

  // If exclude list is specified, item must not be in it
  if (options?.exclude && options.exclude.length > 0) {
    return !options.exclude.includes(type)
  }

  // Default: include everything
  return true
}

/**
 * Convert config format to expected format type.
 *
 * @param format - Original format from detection
 * @returns Normalized format type
 */
function normalizeConfigFormat(format: string): 'json' | 'yaml' | 'js' | 'ts' | 'toml' | 'env' {
  const formatMap: Record<string, 'json' | 'yaml' | 'js' | 'ts' | 'toml' | 'env'> = {
    json: 'json',
    jsonc: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    javascript: 'js',
    js: 'js',
    cjs: 'js',
    mjs: 'js',
    typescript: 'ts',
    ts: 'ts',
    mts: 'ts',
    cts: 'ts',
    toml: 'toml',
    env: 'env',
    dotenv: 'env',
  }
  return formatMap[format.toLowerCase()] ?? 'json'
}

/**
 * Analyze a project for frameworks, build tools, and structure.
 *
 * This is the main entry point for comprehensive project analysis.
 * It orchestrates all detection modules and returns a unified result.
 *
 * @param projectPath - Path to project directory
 * @param options - Analysis options
 * @returns Complete analysis result
 *
 * @example
 * ```typescript
 * const result = analyzeProject('./my-project')
 * console.log(result.projectType) // 'application' | 'library' | ...
 * console.log(result.frameworks)  // [{ id: 'react', name: 'React', ... }]
 * ```
 */
export function analyzeProject(projectPath: string, options?: AnalyzeOptions): AnalysisResult {
  const startTime = dateNow()
  const resolvedPath = resolve(projectPath)

  // Set log level based on verbose option
  if (options?.verbose) {
    analyzeLogger.setLogLevel('debug')
  }

  analyzeLogger.debug('Starting project analysis', { path: resolvedPath, options })

  // Read package.json once for reuse
  const packageJson = readPackageJsonIfExists(resolvedPath)
  analyzeLogger.debug('Package.json loaded', { found: !!packageJson, name: packageJson?.name })

  // Detect project and workspace types
  const projectTypeDetection = detectProjectType(resolvedPath, {
    skipTechDetection: options?.depth === 'basic',
  })
  const projectType: ProjectType = projectTypeDetection.type
  const workspaceType = detectWorkspaceType(resolvedPath)
  analyzeLogger.debug('Project type detected', { projectType, workspaceType })

  // Get project name from package.json or directory name
  const projectName = packageJson?.name ?? basename(resolvedPath)

  // Run all technology detectors
  const detections =
    shouldInclude('frameworks', options) || shouldInclude('buildTools', options) || shouldInclude('testing', options)
      ? detectAll(resolvedPath, packageJson ?? undefined)
      : null

  // Convert framework detections to FrameworkInfo
  const frameworks: FrameworkInfo[] =
    shouldInclude('frameworks', options) && detections
      ? [
          ...detections.frontendFrameworks.map(
            (d) =>
              <FrameworkInfo>{
                id: d.id,
                name: d.name,
                version: d.version,
                confidence: d.confidence,
                category: 'frontend',
                metaFrameworks: d.metaFrameworks?.map((m) => m.id),
              }
          ),
          ...detections.backendFrameworks.map(
            (d) =>
              <FrameworkInfo>{
                id: d.id,
                name: d.name,
                version: d.version,
                confidence: d.confidence,
                category: 'backend',
              }
          ),
        ]
      : []

  // Convert build tool detections
  const buildTools: BuildToolInfo[] =
    shouldInclude('buildTools', options) && detections
      ? detections.buildTools.map((d) => ({
          id: d.id,
          name: d.name,
          version: d.version,
          configPath: d.configPath,
          confidence: d.confidence,
        }))
      : []

  // Convert testing framework detections
  const testingFrameworks: TestingInfo[] =
    shouldInclude('testing', options) && detections
      ? detections.testingFrameworks.map((d) => ({
          id: d.id,
          name: d.name,
          version: d.version,
          configPath: d.configPath,
          type: d.type,
          confidence: d.confidence,
        }))
      : []

  // Discover entry points
  const entryPoints: EntryPointInfo[] = shouldInclude('entryPoints', options)
    ? discoverEntryPoints(resolvedPath).map((e) => ({
        path: e.path,
        type: e.type,
        confidence: e.confidence,
      }))
    : []

  // Detect configuration files
  const configFiles: ConfigFileInfo[] = shouldInclude('configs', options)
    ? detectConfigs(resolvedPath).map((c) => ({
        path: c.path,
        name: basename(c.path),
        format: normalizeConfigFormat(c.info.format),
        tool: c.type,
      }))
    : []

  // Get dependency summary
  let dependencies: DependencySummary
  if (shouldInclude('dependencies', options)) {
    const deps = getProjectDependencies(resolvedPath)
    dependencies = {
      production: deps.runtime.length,
      development: deps.development.length,
      peer: deps.peer.length,
      optional: deps.optional.length,
      total: deps.total,
    }
  } else {
    dependencies = {
      production: 0,
      development: 0,
      peer: 0,
      optional: 0,
      total: 0,
    }
  }

  // Build metadata
  const metadata: AnalysisMetadata = {
    timestamp: createDate(),
    durationMs: dateNow() - startTime,
    version: VERSION,
  }

  analyzeLogger.info('Analysis complete', {
    projectName,
    projectType,
    workspaceType,
    frameworkCount: frameworks.length,
    buildToolCount: buildTools.length,
    testingFrameworkCount: testingFrameworks.length,
    durationMs: metadata.durationMs,
  })

  return {
    name: projectName,
    root: resolvedPath,
    projectType,
    workspaceType,
    frameworks,
    buildTools,
    testingFrameworks,
    entryPoints,
    configFiles,
    dependencies,
    metadata,
  }
}
