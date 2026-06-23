import type { EntryPoint, EntryPointDiscovery, EntryPointPlatform } from '../../models'

/**
 * Returns the entry points belonging to the requested platform.
 *
 * @param discovery - Discovery result returned by `discoverEntries`.
 * @param platform - Platform hint to filter on.
 * @returns Subset of `discovery.entryPoints` flagged with the matching platform.
 *
 * @example Retrieving browser entries
 * ```typescript
 * const browserEntries = getEntriesByPlatform(discovery, 'browser')
 * ```
 */
export const getEntriesByPlatform = (discovery: EntryPointDiscovery, platform: EntryPointPlatform): EntryPoint[] =>
  discovery.entryPoints.filter((entry) => entry.platform === platform)

/**
 * Returns the entry points that have no platform hint (root and shared/feature entries).
 *
 * @param discovery - Discovery result returned by `discoverEntries`.
 * @returns Subset of `discovery.entryPoints` without a platform hint.
 *
 * @example Retrieving the shared / non-platform entries
 * ```typescript
 * const shared = getSharedEntries(discovery)
 * ```
 */
export const getSharedEntries = (discovery: EntryPointDiscovery): EntryPoint[] => discovery.entryPoints.filter((entry) => !entry.platform)
