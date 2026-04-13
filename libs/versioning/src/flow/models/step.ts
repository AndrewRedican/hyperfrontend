import type { FlowContext, FlowStepResult } from './types'

/**
 * Step executor function type.
 * Takes flow context and returns a step result promise.
 */
export type StepExecutor = (context: FlowContext) => Promise<FlowStepResult>

/**
 * Step skip condition function type.
 * Returns true if the step should be skipped.
 */
export type StepCondition = (context: FlowContext) => boolean

/**
 * A single step in a version flow.
 *
 * Steps are pure functions that:
 * 1. Read from context (state, config, services)
 * 2. Perform work (possibly with side effects via services)
 * 3. Return state updates
 */
export interface FlowStep {
  /** Step identifier (unique within flow) */
  readonly id: string

  /** Human-readable step name */
  readonly name: string

  /** Optional step description */
  readonly description?: string

  /** Step function to execute */
  readonly execute: StepExecutor

  /** Condition for skipping step */
  readonly skipIf?: StepCondition

  /** Whether step failure should fail the flow */
  readonly continueOnError?: boolean

  /** Steps that must complete before this one */
  readonly dependsOn?: readonly string[]
}

/**
 * Options for creating a flow step.
 */
export interface CreateStepOptions {
  /** Step description */
  description?: string

  /** Condition for skipping step */
  skipIf?: StepCondition

  /** Whether step failure should fail the flow */
  continueOnError?: boolean

  /** Steps that must complete before this one */
  dependsOn?: readonly string[]
}

/**
 * Creates a flow step.
 *
 * @param id - Unique step identifier
 * @param name - Human-readable step name
 * @param execute - Step executor function
 * @param options - Optional step configuration
 * @returns A FlowStep object
 *
 * @example Creating a custom fetch step
 * ```typescript
 * const fetchStep = createStep(
 *   'fetch-registry',
 *   'Fetch Registry Version',
 *   async (ctx) => {
 *     const version = await ctx.registry.getLatestVersion(ctx.packageName)
 *     return {
 *       status: 'success',
 *       stateUpdates: { publishedVersion: version },
 *       message: `Found published version: ${version}`
 *     }
 *   }
 * )
 * ```
 */
export function createStep(id: string, name: string, execute: StepExecutor, options: CreateStepOptions = {}): FlowStep {
  return {
    id,
    name,
    execute,
    description: options.description,
    skipIf: options.skipIf,
    continueOnError: options.continueOnError,
    dependsOn: options.dependsOn,
  }
}

/**
 * Creates a step that succeeds immediately.
 * Useful for placeholder or conditional steps.
 *
 * @param id - Unique identifier within the flow
 * @param name - Display label shown during execution
 * @param message - Success message
 * @returns A FlowStep that always succeeds
 *
 * @example Creating a placeholder step
 * ```typescript
 * import { createNoopStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createNoopStep('placeholder', 'Placeholder Step')
 * const result = await executeStep(step, context)
 *
 * console.log(result.status)
 * // => 'success'
 * ```
 */
export function createNoopStep(id: string, name: string, message = 'Step completed (no-op)'): FlowStep {
  return createStep(id, name, async () => ({
    status: 'success',
    message,
  }))
}

/**
 * Creates a skipped step result.
 *
 * @param message - Explanation for why the step was skipped
 * @returns A FlowStepResult with 'skipped' status
 *
 * @example Skipping a step conditionally
 * ```typescript
 * import { createSkippedResult } from '@hyperfrontend/versioning'
 *
 * // In a step handler:
 * if (!config.enabled) {
 *   return createSkippedResult('Feature disabled in config')
 * }
 * ```
 */
export function createSkippedResult(message: string): FlowStepResult {
  return {
    status: 'skipped',
    message,
  }
}

/**
 * Creates a success step result.
 *
 * @param message - Output text describing what the step accomplished
 * @param stateUpdates - Optional state updates to apply after step completion
 * @returns A FlowStepResult with 'success' status
 *
 * @example Returning a success result with state updates
 * ```typescript
 * import { createSuccessResult } from '@hyperfrontend/versioning'
 *
 * // In a step handler:
 * return createSuccessResult('Updated 3 files', {
 *   modifiedFiles: ['/path/a.ts', '/path/b.ts', '/path/c.ts']
 * })
 * ```
 */
export function createSuccessResult(message: string, stateUpdates?: FlowStepResult['stateUpdates']): FlowStepResult {
  return {
    status: 'success',
    message,
    stateUpdates,
  }
}

/**
 * Creates a failed step result.
 *
 * @param error - Error that caused the failure
 * @param message - Optional message (defaults to error.message)
 * @returns A FlowStepResult with 'failed' status
 *
 * @example Handling step execution errors
 * ```typescript
 * import { createFailedResult } from '@hyperfrontend/versioning'
 *
 * // In a step handler:
 * try {
 *   await doOperation()
 * } catch (err) {
 *   return createFailedResult(err as Error, 'Operation failed')
 * }
 * ```
 */
export function createFailedResult(error: Error, message?: string): FlowStepResult {
  return {
    status: 'failed',
    error,
    message: message ?? error.message,
  }
}
