import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Predicate signature consumed by Rollup's `external` option.
 */
export type ExternalPredicate = (id: string) => boolean

/**
 * Builds a Rollup `external` predicate from an explicit list of package names.
 *
 * Every supplied name becomes external; everything else is bundled.
 *
 * @param external - Package names to mark external.
 * @returns Predicate suitable for Rollup's `external` option.
 *
 * @example Marking dependencies external for an ESM build
 * ```typescript
 * const isExternal = createExternalFn(['react', 'react-dom'])
 * isExternal('react') // => true
 * ```
 */
export const createExternalFn = (external: string[]): ExternalPredicate => {
  const set = createSet(external)
  return (id: string): boolean => set.has(id)
}

/**
 * Builds a Rollup `external` predicate suited for IIFE / UMD bundle outputs.
 *
 * When `external` is omitted or empty the resulting predicate inlines every dependency.
 * When non-empty, only listed packages are external — everything else is bundled.
 *
 * @param external - Optional list of package names to keep external.
 * @returns Predicate suitable for Rollup's `external` option.
 *
 * @example Inlining everything by default
 * ```typescript
 * const isExternal = createBundleExternalFn(undefined)
 * isExternal('react') // => false
 * ```
 */
export const createBundleExternalFn = (external: string[] | undefined): ExternalPredicate => {
  if (!external || external.length === 0) return () => false
  const set = createSet(external)
  return (id: string): boolean => set.has(id)
}
