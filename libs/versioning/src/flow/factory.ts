import type { VersionFlow } from './models/flow'
import type { FlowConfig } from './models/types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createConventionalFlow } from './presets/conventional'
import { createIndependentFlow } from './presets/independent'
import { createSyncedFlow } from './presets/synced'

/**
 * Supported flow presets.
 */
export type FlowPreset = 'conventional' | 'independent' | 'synced'

/**
 * Creates a version flow from a preset.
 *
 * This is the main factory function for creating flows.
 * Use this when you want to create a flow based on a
 * standard preset with optional customization.
 *
 * @param preset - The preset to use (default: 'conventional')
 * @param config - Optional configuration overrides
 * @returns A VersionFlow configured for the preset
 *
 * @example Creating flows from presets
 * ```typescript
 * import { createVersionFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * // Create a conventional flow
 * const flow = createVersionFlow('conventional')
 *
 * // Create an independent flow with custom config
 * const customFlow = createVersionFlow('independent', {
 *   skipTag: true,
 *   trackDeps: true,
 * })
 *
 * const result = await executeFlow(flow, 'lib-utils', '/workspace')
 * ```
 */
export function createVersionFlow(preset: FlowPreset = 'conventional', config?: Partial<FlowConfig>): VersionFlow {
  switch (preset) {
    case 'conventional':
      return createConventionalFlow(config)
    case 'independent':
      return createIndependentFlow(config)
    case 'synced':
      return createSyncedFlow(config)
    default:
      throw createError(`Unknown flow preset: ${preset}`)
  }
}

/**
 * Creates a dry-run version of a flow.
 *
 * Convenience function that creates a flow with dryRun enabled.
 *
 * @param preset - The preset to use
 * @param config - Optional configuration overrides
 * @returns A VersionFlow configured for dry run
 *
 * @example Creating a dry-run flow for preview
 * ```typescript
 * import { createDryRunFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * const flow = createDryRunFlow('conventional')
 * const result = await executeFlow(flow, 'my-lib', '/workspace')
 *
 * // Preview changes without modifying files
 * console.log('Would release:', result.state.nextVersion)
 * ```
 */
export function createDryRunFlow(preset: FlowPreset = 'conventional', config?: Partial<FlowConfig>): VersionFlow {
  return createVersionFlow(preset, {
    ...config,
    dryRun: true,
  })
}

/**
 * Gets the list of available presets.
 *
 * @returns Array of preset names
 *
 * @example Listing available presets
 * ```typescript
 * import { getAvailablePresets } from '@hyperfrontend/versioning'
 *
 * const presets = getAvailablePresets()
 * // => ['conventional', 'independent', 'synced']
 * ```
 */
export function getAvailablePresets(): readonly FlowPreset[] {
  return ['conventional', 'independent', 'synced']
}

/**
 * Gets the description for a preset.
 *
 * @param preset - The preset name
 * @returns Human-readable description
 *
 * @example Getting a preset description
 * ```typescript
 * import { getPresetDescription } from '@hyperfrontend/versioning'
 *
 * console.log(getPresetDescription('independent'))
 * // => 'Version packages independently with dependency tracking'
 * ```
 */
export function getPresetDescription(preset: FlowPreset): string {
  switch (preset) {
    case 'conventional':
      return 'Standard versioning using conventional commits specification'
    case 'independent':
      return 'Version packages independently with dependency tracking'
    case 'synced':
      return 'Keep all packages at the same version'
    default:
      return 'Unknown preset'
  }
}
