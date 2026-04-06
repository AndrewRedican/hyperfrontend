/* eslint-disable @nx/enforce-module-boundaries */
import type { Logger } from '@hyperfrontend/logging'
import type { FileDiff, Tree } from '@hyperfrontend/project-scope/vfs'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { VersionFlow } from '../models/flow'
import type { FileChangeInfo, FlowConfig, FlowContext, FlowResult, FlowState, FlowStatus, FlowStepResultWithId } from '../models/types'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger as defaultLogger } from '@hyperfrontend/logging'
import { isNxWorkspace, discoverNxProjects } from '@hyperfrontend/project-scope/nx'
import { commitChanges, createTree, formatUnifiedDiff, generateAllDiffs, rollbackChanges } from '@hyperfrontend/project-scope/vfs'
import { createGitClient, DEFAULT_GIT_CLIENT_CONFIG } from '../../git/factory'
import { createRegistry } from '../../registry/factory'
import { discoverProjectByName } from '../../workspace/discovery'
import { DEFAULT_FLOW_CONFIG } from '../models/types'

/** Minimal package.json structure with name field. */
interface PackageJsonWithName {
  /** Package name. */
  name?: string
}

/**
 * Output format for diff preview.
 */
export type DiffFormat = 'unified' | 'summary'

/**
 * Options for flow execution.
 */
export interface ExecuteOptions {
  /** Dry run - don't commit changes to disk */
  dryRun?: boolean

  /** Verbose logging */
  verbose?: boolean

  /** Show unified diff of changes before committing */
  showDiff?: boolean

  /** Output format for diff: 'unified' (full patch) or 'summary' (stats only) */
  diffFormat?: DiffFormat

  /**
   * Whether to rollback all pending changes on step failure.
   *
   * When true (default), pending VFS changes are discarded when a step fails
   * and `continueOnError` is false. This ensures no partial state remains.
   *
   * @default true
   */
  rollbackOnFailure?: boolean

  /** Custom logger (defaults to console) */
  logger?: Logger

  /** Custom Tree instance (for testing) */
  tree?: Tree

  /** Custom Registry instance (for testing) */
  registry?: Registry

  /** Custom GitClient instance (for testing) */
  git?: GitClient

  /**
   * Project root path (relative to workspace root, e.g., 'libs/utils/immutable-api').
   * If provided, this is used directly instead of deriving from project name.
   * This is the recommended approach when calling from the Nx executor.
   */
  projectRoot?: string
}

/**
 * Resolution source for project root discovery.
 */
type ProjectRootSource = 'provided' | 'nx-discovery' | 'workspace-discovery'

/**
 * Result of project root discovery.
 */
interface ProjectRootResolution {
  /** Absolute path to project root */
  projectRoot: string
  /** How the path was resolved */
  source: ProjectRootSource
}

/**
 * Discovers project root using multiple strategies.
 *
 * Resolution order:
 * 1. Explicit `projectRoot` option (from Nx executor)
 * 2. Nx project discovery via `discoverNxProjects` (if in Nx workspace)
 * 3. Workspace discovery via `discoverProjectByName`
 *
 * @param workspaceRoot - Workspace root path
 * @param projectName - Project name (e.g., 'lib-versioning')
 * @param providedRoot - Explicitly provided project root (optional)
 * @param logger - Logger instance
 * @param tree - Optional VFS tree for VFS-aware discovery
 * @returns Resolution result with path and source, or null if not found
 */
function discoverProjectRoot(
  workspaceRoot: string,
  projectName: string,
  providedRoot: string | undefined,
  logger: Logger,
  tree?: Tree
): ProjectRootResolution | null {
  if (providedRoot) {
    const projectRoot = providedRoot.startsWith(workspaceRoot) ? providedRoot : `${workspaceRoot}/${providedRoot}`
    logger.debug(`Using provided project root: ${providedRoot}`)
    return { projectRoot, source: 'provided' }
  }

  if (isNxWorkspace(workspaceRoot)) {
    logger.debug('Nx workspace detected, attempting Nx project discovery')
    try {
      const nxProjects = discoverNxProjects(workspaceRoot)
      const nxConfig = nxProjects.get(projectName)
      if (nxConfig?.root) {
        const projectRoot = `${workspaceRoot}/${nxConfig.root}`
        logger.debug(`Discovered project root via Nx: ${nxConfig.root}`)
        return { projectRoot, source: 'nx-discovery' }
      }
      logger.debug(`Project "${projectName}" not found in Nx project graph`)
    } catch (error) {
      logger.debug(`Nx project discovery failed: ${error}`)
    }
  }

  logger.debug('Attempting workspace discovery via discoverProjectByName')
  try {
    const project = discoverProjectByName(projectName, { workspaceRoot, tree })
    if (project) {
      logger.debug(`Discovered project root via workspace discovery: ${project.path}`)
      return { projectRoot: project.path, source: 'workspace-discovery' }
    }
    logger.debug(`Project "${projectName}" not found via workspace discovery`)
  } catch (error) {
    logger.debug(`Workspace discovery failed: ${error}`)
  }

  logger.error(
    `Could not discover project "${projectName}" in workspace "${workspaceRoot}". ` +
      `Ensure the project exists and has a valid package.json, or pass projectRoot explicitly.`
  )
  return null
}

/**
 * Resolves the package name from the project root.
 *
 * @param tree - Virtual file system tree
 * @param projectRoot - Project root path
 * @param logger - Logger instance for diagnostics
 * @returns Package name from package.json
 */
function resolvePackageName(tree: Tree, projectRoot: string, logger: Logger): string {
  const packageJsonPath = `${projectRoot}/package.json`

  try {
    const content = tree.read(packageJsonPath, 'utf-8')
    if (!content) {
      logger.debug(`package.json is empty or not found at ${packageJsonPath}`)
      return 'unknown'
    }
    const pkg = <PackageJsonWithName>parse(content)
    if (!pkg.name) {
      logger.debug(`package.json at ${packageJsonPath} has no name field`)
    }
    return pkg.name ?? 'unknown'
  } catch (error) {
    logger.debug(`Failed to read package.json at ${packageJsonPath}: ${error}`)
    return 'unknown'
  }
}

/**
 * Builds a summary message from flow results.
 *
 * @param status - The overall flow status
 * @param steps - Array of step results
 * @param state - Final flow state
 * @param duration - Execution duration in milliseconds
 * @returns Human-readable summary string
 */
function buildSummary(status: FlowStatus, steps: readonly FlowStepResultWithId[], state: FlowState, duration: number): string {
  const completed = steps.filter((s) => s.status === 'success').length
  const skipped = steps.filter((s) => s.status === 'skipped').length
  const failed = steps.filter((s) => s.status === 'failed').length

  let summary = `Flow ${status} in ${duration}ms: `
  summary += `${completed} completed, ${skipped} skipped, ${failed} failed`

  if (state.nextVersion) {
    summary += `. Version: ${state.currentVersion ?? '?.?.?'} → ${state.nextVersion}`
  } else if (status === 'success' && state.bumpType === 'none') {
    summary += '. No release needed'
  }

  return summary
}

/**
 * Merges flow config with defaults.
 *
 * @param flowConfig - Base flow configuration
 * @param overrides - Optional configuration overrides
 * @returns Merged configuration
 */
function mergeConfig(flowConfig: FlowConfig, overrides?: Partial<FlowConfig>): FlowConfig {
  return {
    ...DEFAULT_FLOW_CONFIG,
    ...flowConfig,
    ...overrides,
  }
}

/**
 * Executes a version flow.
 *
 * This is the main entry point for running a versioning workflow.
 * Steps are executed in order, with state accumulated between steps.
 *
 * @param flow - The version flow to execute
 * @param projectName - Name of the project to version (e.g., 'lib-versioning')
 * @param workspaceRoot - Absolute path to workspace root
 * @param options - Execution options
 * @returns Flow execution result
 *
 * @example
 * ```typescript
 * import { createConventionalFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * const flow = createConventionalFlow({ dryRun: true })
 * const result = await executeFlow(flow, 'lib-utils', '/path/to/workspace')
 *
 * console.log(result.summary)
 * // "Flow success in 234ms: 8 completed, 0 skipped, 0 failed. Version: 1.2.3 → 1.3.0"
 * ```
 */
export async function executeFlow(
  flow: VersionFlow,
  projectName: string,
  workspaceRoot: string,
  options: ExecuteOptions = {}
): Promise<FlowResult> {
  const startTime = dateNow()
  const flowLogger = options.logger ?? defaultLogger

  flowLogger.setLogLevel(options.verbose ? 'debug' : 'error')

  const config = mergeConfig(flow.config, {
    dryRun: options.dryRun ?? flow.config.dryRun,
  })

  const tree = options.tree ?? createTree(workspaceRoot)
  const registry = options.registry ?? createRegistry('npm')
  const git = options.git ?? createGitClient({ ...DEFAULT_GIT_CLIENT_CONFIG, cwd: workspaceRoot })

  const resolution = discoverProjectRoot(workspaceRoot, projectName, options.projectRoot, flowLogger, tree)

  if (!resolution) {
    return {
      status: 'failed',
      steps: [],
      state: {},
      duration: dateNow() - startTime,
      summary: `Project "${projectName}" not found in workspace`,
    }
  }

  const { projectRoot, source: projectRootSource } = resolution

  const packageJsonPath = `${projectRoot}/package.json`
  if (!tree.isFile(packageJsonPath)) {
    const errorMsg =
      `Project root validation failed: ${packageJsonPath} does not exist or is not a file. ` +
      `Resolved projectRoot="${projectRoot}" (source: ${projectRootSource}) from projectName="${projectName}".`
    flowLogger.error(errorMsg)
    return {
      status: 'failed',
      steps: [],
      state: {},
      duration: dateNow() - startTime,
      summary: `Invalid project root: ${projectRoot}`,
    }
  }

  const packageName = resolvePackageName(tree, projectRoot, flowLogger)
  if (packageName === 'unknown') {
    flowLogger.warn(`Could not read package name from ${packageJsonPath}`)
  }

  const context: FlowContext = {
    workspaceRoot,
    projectName,
    projectRoot,
    packageName,
    tree,
    registry,
    git,
    logger: flowLogger,
    config,
    state: {},
  }

  const stepResults: FlowStepResultWithId[] = []
  let failed = false

  flowLogger.info(`Executing flow: ${flow.name}`)
  flowLogger.info(`Project: ${projectName} (${packageName})`)

  for (const step of flow.steps) {
    if (step.dependsOn?.length) {
      const depsMet = step.dependsOn.every((depId) => {
        const depResult = stepResults.find((r) => r.stepId === depId)
        return depResult && depResult.status === 'success'
      })

      if (!depsMet) {
        flowLogger.debug(`Skipping step "${step.name}": dependencies not met`)
        stepResults.push({
          stepId: step.id,
          stepName: step.name,
          status: 'skipped',
          message: 'Dependencies not met',
        })
        continue
      }
    }

    if (step.skipIf?.(context)) {
      flowLogger.debug(`Skipping step "${step.name}": skip condition met`)
      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        status: 'skipped',
        message: 'Skipped by condition',
      })
      continue
    }

    try {
      flowLogger.info(`Executing step: ${step.name}`)

      const result = await step.execute(context)

      if (result.stateUpdates) {
        context.state = { ...context.state, ...result.stateUpdates }
      }

      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        ...result,
      })

      if (result.status === 'success') {
        flowLogger.debug(`Step "${step.name}" succeeded: ${result.message ?? 'OK'}`)
      } else if (result.status === 'skipped') {
        flowLogger.debug(`Step "${step.name}" skipped: ${result.message ?? 'No reason'}`)
      } else if (result.status === 'failed') {
        flowLogger.error(`Step "${step.name}" failed: ${result.message ?? result.error?.message ?? 'Unknown error'}`)
        if (!step.continueOnError) {
          if (options.rollbackOnFailure !== false) {
            const changes = tree.listChanges()
            if (changes.length > 0) {
              flowLogger.warn(`Rolling back ${changes.length} pending file change(s)`)
              rollbackChanges(tree)
            }
          }
          failed = true
          break
        }
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : createError(String(error))

      flowLogger.error(`Step "${step.name}" threw: ${errorObj.message}`)

      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        status: 'failed',
        error: errorObj,
        message: errorObj.message,
      })

      if (!step.continueOnError) {
        if (options.rollbackOnFailure !== false) {
          const changes = tree.listChanges()
          if (changes.length > 0) {
            flowLogger.warn(`Rolling back ${changes.length} pending file change(s)`)
            rollbackChanges(tree)
          }
        }
        failed = true
        break
      }
    }
  }

  const pendingChanges = tree.listChanges()
  const modifiedFiles: readonly FileChangeInfo[] = pendingChanges.map((change) => ({
    path: change.path,
    changeType: change.type,
  }))

  let diffs: readonly FileDiff[] | undefined
  if (options.showDiff && pendingChanges.length > 0) {
    diffs = generateAllDiffs(tree)

    flowLogger.info(`\n${'='.repeat(60)}\nPending changes:\n${'='.repeat(60)}`)

    for (const diff of diffs) {
      if (options.diffFormat === 'summary') {
        flowLogger.info(`${diff.path}: +${diff.additions} -${diff.deletions}`)
      } else {
        flowLogger.info(formatUnifiedDiff(diff))
      }
    }
  } else if (options.showDiff && pendingChanges.length === 0) {
    flowLogger.info('No file changes to commit')
  }

  if (options.verbose && !options.showDiff && pendingChanges.length > 0) {
    flowLogger.info(`Pending changes: ${pendingChanges.length} file(s)`)
    for (const change of pendingChanges) {
      flowLogger.info(`  [${change.type}] ${change.path}`)
    }
  }

  if (!config.dryRun && !failed) {
    try {
      commitChanges(tree, { verbose: options.verbose })
      flowLogger.info('File changes committed to disk')
    } catch (error) {
      flowLogger.error(`Failed to commit file changes: ${error}`)
    }
  } else if (config.dryRun) {
    if (pendingChanges.length > 0) {
      flowLogger.info(`Dry run - would modify ${pendingChanges.length} file(s):`)
      for (const change of pendingChanges) {
        flowLogger.info(`  [${change.type}] ${change.path}`)
      }
    } else {
      flowLogger.info('Dry run mode - no changes to write')
    }
  }

  const duration = dateNow() - startTime

  const status: FlowStatus = failed
    ? 'failed'
    : stepResults.some((r) => r.status === 'failed')
      ? 'partial'
      : stepResults.every((r) => r.status === 'skipped')
        ? 'skipped'
        : 'success'

  const summary = buildSummary(status, stepResults, context.state, duration)

  flowLogger.info(summary)

  return {
    status,
    steps: stepResults,
    state: context.state,
    duration,
    summary,
    modifiedFiles,
    ...(diffs && { diffs }),
  }
}

/**
 * Executes a flow in dry-run mode.
 *
 * Convenience wrapper that sets dryRun: true.
 *
 * @param flow - The version flow to execute
 * @param projectName - Name of the project to version
 * @param workspaceRoot - Absolute path to workspace root
 * @param options - Execution options (dryRun forced to true)
 * @returns Flow execution result (no actual changes made)
 */
export async function dryRun(
  flow: VersionFlow,
  projectName: string,
  workspaceRoot: string,
  options: Omit<ExecuteOptions, 'dryRun'> = {}
): Promise<FlowResult> {
  return executeFlow(flow, projectName, workspaceRoot, {
    ...options,
    dryRun: true,
  })
}

/**
 * Validates a flow before execution.
 *
 * Checks for:
 * - Duplicate step IDs
 * - Invalid dependency references
 * - Circular dependencies
 *
 * @param flow - The flow to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateFlow(flow: VersionFlow): readonly string[] {
  const errors: string[] = []
  const stepIds = createSet<string>()

  for (const step of flow.steps) {
    if (stepIds.has(step.id)) {
      errors.push(`Duplicate step ID: "${step.id}"`)
    }
    stepIds.add(step.id)
  }

  for (const step of flow.steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          errors.push(`Step "${step.id}" depends on unknown step "${depId}"`)
        }
      }
    }
  }

  const visited = createSet<string>()
  const visiting = createSet<string>()

  /**
   * Recursively visits a step to detect circular dependencies.
   *
   * @param stepId - The step ID to check
   * @returns True if no cycle detected, false otherwise
   */
  function visit(stepId: string): boolean {
    if (visiting.has(stepId)) {
      return false
    }
    if (visited.has(stepId)) {
      return true
    }

    visiting.add(stepId)
    const step = flow.steps.find((s) => s.id === stepId)
    if (step?.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!visit(depId)) {
          errors.push(`Circular dependency detected involving step "${stepId}"`)
          return false
        }
      }
    }
    visiting.delete(stepId)
    visited.add(stepId)
    return true
  }

  for (const step of flow.steps) {
    visit(step.id)
  }

  return errors
}
