import type { DiscoveredScope } from './scope-discovery'

/**
 * Computes the default scope to pre-select in the `scope` step.
 *
 * Algorithm (matches locked decision D3):
 *   1. A single candidate wins outright.
 *   2. Otherwise, if one candidate's path is a prefix of every other
 *      candidate's path, that nearest common ancestor wins.
 *   3. Otherwise, there is no default.
 *
 * @param candidates - Scopes produced by `discoverScopes`
 * @returns Scope name to pre-select, or undefined when no default is resolvable
 *
 * @example Single owner wins
 * ```typescript
 * defaultScope([{ name: 'alpha', path: '/repo/libs/alpha' }])
 * // => 'alpha'
 * ```
 *
 * @example Common ancestor wins
 * ```typescript
 * defaultScope([
 *   { name: 'root', path: '/repo' },
 *   { name: 'alpha', path: '/repo/libs/alpha' },
 * ])
 * // => 'root'
 * ```
 *
 * @example Disjoint ownership has no default
 * ```typescript
 * defaultScope([
 *   { name: 'alpha', path: '/repo/libs/alpha' },
 *   { name: 'beta', path: '/repo/libs/beta' },
 * ])
 * // => undefined
 * ```
 */
export function defaultScope(candidates: readonly DiscoveredScope[]): string | undefined {
  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]?.name

  for (const candidate of candidates) {
    if (isAncestorOfAll(candidate, candidates)) {
      return candidate.name
    }
  }

  return undefined
}

/**
 * Checks whether the candidate's path is a prefix of every other candidate's
 * path (including itself).
 *
 * @param candidate - Scope being tested as a potential common ancestor
 * @param all - Full candidate list
 * @returns True when every other path sits beneath `candidate.path`
 */
function isAncestorOfAll(candidate: DiscoveredScope, all: readonly DiscoveredScope[]): boolean {
  const prefix = candidate.path.endsWith('/') ? candidate.path : `${candidate.path}/`
  for (const other of all) {
    if (other === candidate) continue
    if (!other.path.startsWith(prefix)) return false
  }
  return true
}
