import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { VersionFlow } from '../models/flow'
import type { FlowConfig, FlowContext, FlowResult, FlowState, FlowStatus, FlowStepResultWithId } from '../models/types'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger as defaultLogger } from '@hyperfrontend/logging'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTree, commitChanges } from '@hyperfrontend/project-scope'
import { createGitClient, DEFAULT_GIT_CLIENT_CONFIG } from '../../git/factory'
import { createRegistry } from '../../registry/factory'
import { DEFAULT_FLOW_CONFIG } from '../models/types'

/**
 * Options for flow execution.
 */
export interface ExecuteOptions {
  /** Dry run - don't commit changes to disk */
  dryRun?: boolean

  /** Verbose logging */
  verbose?: boolean

  /** Custom logger (defaults to console) */
  logger?: Logger

  /** Custom Tree instance (for testing) */
  tree?: Tree

  /** Custom Registry instance (for testing) */
  registry?: Registry

  /** Custom GitClient instance (for testing) */
  git?: GitClient
}

/**
 * Resolves the project root path from workspace root and project name.
 *
 * For now, uses a simple convention: libs/{projectName} or apps/{projectName}
 * In a real implementation, this would query the workspace configuration.
 *
 * @param workspaceRoot - Workspace root path
 * @param projectName - Project name (e.g., 'lib-versioning')
 * @returns Absolute path to project root
 */
function resolveProjectRoot(workspaceRoot: string, projectName: string): string {
  // Remove 'lib-' or 'app-' prefix to get the folder name
  let folderName = projectName
  let prefix = 'libs'

  if (projectName.startsWith('lib-')) {
    folderName = projectName.slice(4)
    prefix = 'libs'
  } else if (projectName.startsWith('app-')) {
    folderName = projectName.slice(4)
    prefix = 'apps'
  }

  return `${workspaceRoot}/${prefix}/${folderName}`
}

/**
 * Resolves the package name from the project root.
 *
 * @param tree - Virtual file system tree
 * @param projectRoot - Project root path
 * @returns Package name from package.json
 */
function resolvePackageName(tree: Tree, projectRoot: string): string {
  const packageJsonPath = `${projectRoot}/package.json`

  try {
    const content = tree.read(packageJsonPath, 'utf-8')
    if (!content) {
      return 'unknown'
    }
    const pkg = <{ name?: string }>parse(content)
    return pkg.name ?? 'unknown'
  } catch {
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

  // Set log level based on verbose option
  flowLogger.setLogLevel(options.verbose ? 'debug' : 'error')

  // Merge configs
  const config = mergeConfig(flow.config, {
    dryRun: options.dryRun ?? flow.config.dryRun,
  })

  // Initialize services
  const tree = options.tree ?? createTree(workspaceRoot)
  const registry = options.registry ?? createRegistry('npm')
  const git = options.git ?? createGitClient({ ...DEFAULT_GIT_CLIENT_CONFIG, cwd: workspaceRoot })

  // Resolve paths
  const projectRoot = resolveProjectRoot(workspaceRoot, projectName)
  const packageName = resolvePackageName(tree, projectRoot)

  // Initialize context
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

  // Execute steps in order
  for (const step of flow.steps) {
    // Check dependencies
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

    // Check skip condition
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

    // Execute step
    try {
      flowLogger.info(`Executing step: ${step.name}`)

      const result = await step.execute(context)

      // Apply state updates
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
        failed = true
        break
      }
    }
  }

  // Commit VFS changes if not dry run and not failed
  if (!config.dryRun && !failed) {
    try {
      commitChanges(tree, { verbose: options.verbose })
      flowLogger.info('File changes committed to disk')
    } catch (error) {
      flowLogger.error(`Failed to commit file changes: ${error}`)
    }
  } else if (config.dryRun) {
    flowLogger.info('Dry run mode - no changes written to disk')
  }

  const duration = dateNow() - startTime

  // Determine overall status
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

  // Check for duplicate IDs
  for (const step of flow.steps) {
    if (stepIds.has(step.id)) {
      errors.push(`Duplicate step ID: "${step.id}"`)
    }
    stepIds.add(step.id)
  }

  // Check for valid dependency references
  for (const step of flow.steps) {
    if (step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          errors.push(`Step "${step.id}" depends on unknown step "${depId}"`)
        }
      }
    }
  }

  // Check for circular dependencies (simple DFS)
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
      return false // Cycle detected
    }
    if (visited.has(stepId)) {
      return true // Already checked
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
