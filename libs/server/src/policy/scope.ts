import type { RuleScope, ServeHeaderRule } from './serve-types'

// note: The two bounds a scope may carry, in the order a rule lists them.
const BOUNDS = ['prefix', 'suffix'] as const

// note: The prefixes that exclude no path, since every path a file is served under starts with "/".
const OPEN_PREFIXES: readonly string[] = ['', '/']

/**
 * Reports whether a scope leaves every path matched, which is how the fold
 * reads it: no prefix, an empty one or `/` excludes nothing, and neither does
 * no suffix or an empty one. A header rule is read by its bounds alone.
 *
 * A rule that only looks bounded replaces a header on the whole site, so it is
 * judged as a rule for every path wherever one is.
 *
 * @param scope - The bounds of a header rule, or the rule itself.
 * @returns `true` when neither bound excludes a path.
 *
 * @example Telling a rule for the whole site from one for its pages
 * ```typescript
 * matchesEveryPath({ prefix: '/' }) // => true
 * matchesEveryPath({ suffix: '.html' }) // => false
 * ```
 */
export function matchesEveryPath(scope: RuleScope): boolean {
  return OPEN_PREFIXES.includes(scope.prefix ?? '') && (scope.suffix ?? '') === ''
}

/**
 * Lists what is wrong with a scope handed to a preset.
 *
 * @param scope - The bounds a preset was asked to apply, when any.
 * @returns One sentence per bound that is present and not a string.
 *
 * @example Checking a scope before building a rule from it
 * ```typescript
 * scopeProblems({ suffix: '.html' }) // => []
 * ```
 */
export function scopeProblems(scope: RuleScope | undefined): readonly string[] {
  return BOUNDS.filter((bound) => scope?.[bound] !== undefined && typeof scope[bound] !== 'string').map(
    (bound) => `scope.${bound} must be a string.`
  )
}

/**
 * Builds a header rule bounded by a scope, leaving out a bound the scope does not carry.
 *
 * @param headers - The header names and values the rule sets.
 * @param scope - The bounds to apply; the rule matches every path without one.
 * @returns The rule, listing its prefix, its suffix and its headers in that order.
 *
 * @example Bounding a rule to pages
 * ```typescript
 * scopedRule({ 'Cache-Control': 'no-cache' }, { suffix: '.html' })
 * // => { suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }
 * ```
 */
export function scopedRule(headers: Record<string, string>, scope: RuleScope | undefined): ServeHeaderRule {
  return {
    ...(scope?.prefix !== undefined && { prefix: scope.prefix }),
    ...(scope?.suffix !== undefined && { suffix: scope.suffix }),
    headers,
  }
}
