import type { FlowStep } from './step'
import type { FlowConfig } from './types'

/**
 * A complete version flow definition.
 *
 * Flows are immutable configurations that define:
 * 1. What steps to execute
 * 2. In what order
 * 3. With what configuration
 */
export interface VersionFlow {
  /** Flow identifier */
  readonly id: string

  /** Human-readable flow name */
  readonly name: string

  /** Flow description */
  readonly description?: string

  /** Ordered steps to execute */
  readonly steps: readonly FlowStep[]

  /** Flow-level configuration */
  readonly config: FlowConfig
}

/**
 * Options for creating a version flow.
 */
export interface CreateFlowOptions {
  /** Flow description */
  description?: string

  /** Flow configuration */
  config?: FlowConfig
}

/**
 * Creates a version flow.
 *
 * @param id - Flow identifier
 * @param name - Human-readable flow name
 * @param steps - Ordered steps to execute
 * @param options - Optional flow configuration
 * @returns A VersionFlow object
 *
 * @example
 * ```typescript
 * const myFlow = createFlow(
 *   'custom',
 *   'Custom Release Flow',
 *   [fetchStep, analyzeStep, bumpStep],
 *   { description: 'My custom versioning workflow' }
 * )
 * ```
 */
export function createFlow(id: string, name: string, steps: readonly FlowStep[], options: CreateFlowOptions = {}): VersionFlow {
  return {
    id,
    name,
    steps,
    description: options.description,
    config: options.config ?? {},
  }
}

/**
 * Adds a step to a flow.
 * Returns a new flow with the step appended.
 *
 * @param flow - The flow to extend
 * @param step - The step to add
 * @returns A new VersionFlow with the step added
 */
export function addStep(flow: VersionFlow, step: FlowStep): VersionFlow {
  return {
    ...flow,
    steps: [...flow.steps, step],
  }
}

/**
 * Removes a step from a flow by ID.
 * Returns a new flow without the specified step.
 *
 * @param flow - The flow to modify
 * @param stepId - The ID of the step to remove
 * @returns A new VersionFlow without the step
 */
export function removeStep(flow: VersionFlow, stepId: string): VersionFlow {
  return {
    ...flow,
    steps: flow.steps.filter((s) => s.id !== stepId),
  }
}

/**
 * Inserts a step at a specific position.
 *
 * @param flow - The flow to modify
 * @param step - The step to insert
 * @param index - Position to insert at (0-based)
 * @returns A new VersionFlow with the step inserted
 */
export function insertStep(flow: VersionFlow, step: FlowStep, index: number): VersionFlow {
  const steps = [...flow.steps]
  steps.splice(index, 0, step)
  return {
    ...flow,
    steps,
  }
}

/**
 * Inserts a step after another step.
 *
 * @param flow - The flow to modify
 * @param step - The step to insert
 * @param afterStepId - ID of the step to insert after
 * @returns A new VersionFlow with the step inserted
 */
export function insertStepAfter(flow: VersionFlow, step: FlowStep, afterStepId: string): VersionFlow {
  const index = flow.steps.findIndex((s) => s.id === afterStepId)
  if (index === -1) {
    // If not found, append to end
    return addStep(flow, step)
  }
  return insertStep(flow, step, index + 1)
}

/**
 * Inserts a step before another step.
 *
 * @param flow - The flow to modify
 * @param step - The step to insert
 * @param beforeStepId - ID of the step to insert before
 * @returns A new VersionFlow with the step inserted
 */
export function insertStepBefore(flow: VersionFlow, step: FlowStep, beforeStepId: string): VersionFlow {
  const index = flow.steps.findIndex((s) => s.id === beforeStepId)
  if (index === -1) {
    // If not found, prepend to beginning
    return insertStep(flow, step, 0)
  }
  return insertStep(flow, step, index)
}

/**
 * Replaces a step in the flow.
 *
 * @param flow - The flow to modify
 * @param stepId - ID of the step to replace
 * @param newStep - The replacement step
 * @returns A new VersionFlow with the step replaced
 */
export function replaceStep(flow: VersionFlow, stepId: string, newStep: FlowStep): VersionFlow {
  return {
    ...flow,
    steps: flow.steps.map((s) => (s.id === stepId ? newStep : s)),
  }
}

/**
 * Updates the flow configuration.
 *
 * @param flow - The flow to configure
 * @param config - Configuration updates to merge
 * @returns A new VersionFlow with updated config
 */
export function withConfig(flow: VersionFlow, config: Partial<FlowConfig>): VersionFlow {
  return {
    ...flow,
    config: { ...flow.config, ...config },
  }
}

/**
 * Gets a step from a flow by ID.
 *
 * @param flow - The flow to search
 * @param stepId - The step ID to find
 * @returns The step if found, undefined otherwise
 */
export function getStep(flow: VersionFlow, stepId: string): FlowStep | undefined {
  return flow.steps.find((s) => s.id === stepId)
}

/**
 * Checks if a flow has a specific step.
 *
 * @param flow - The flow to check
 * @param stepId - The step ID to look for
 * @returns True if the flow contains the step
 */
export function hasStep(flow: VersionFlow, stepId: string): boolean {
  return flow.steps.some((s) => s.id === stepId)
}
