/**
 * Result of a pattern safety check.
 */
export interface PatternSafetyResult {
  /** Whether the pattern is considered safe */
  safe: boolean
  /** Reason if unsafe (for error reporting) */
  reason?: string
}

/**
 * Function type for custom pattern safety checkers.
 * Users can provide their own implementation (e.g., using safe-regex2).
 *
 * @param pattern - The regex pattern string to check
 * @returns Result indicating if the pattern is safe
 *
 * @example
 * ```typescript
 * import safeRegex from 'safe-regex2'
 *
 * const checker: PatternSafetyChecker = (pattern) => ({
 *   safe: safeRegex(pattern),
 *   reason: 'Pattern may cause catastrophic backtracking'
 * })
 *
 * validate(data, schema, { patternSafetyChecker: checker })
 * ```
 */
export type PatternSafetyChecker = (pattern: string) => PatternSafetyResult

/**
 * Extracts the upper bound from a quantifier like {n,m}.
 * Returns null if no upper bound is found.
 *
 * @param pattern - The regex pattern to search
 * @returns The upper bound number or null
 */
function extractQuantifierUpperBound(pattern: string): number | null {
  // Look for {n,m} pattern - split by comma to avoid complex regex
  const braceIndex = pattern.indexOf('{')
  if (braceIndex === -1) return null

  const closeIndex = pattern.indexOf('}', braceIndex)
  if (closeIndex === -1) return null

  const content = pattern.slice(braceIndex + 1, closeIndex)
  const parts = content.split(',')
  if (parts.length !== 2) return null

  const upperStr = parts[1].trim()
  if (upperStr === '' || !/^\d+$/.test(upperStr)) return null

  return Number(upperStr)
}

/**
 * Built-in heuristic pattern safety checker.
 * Detects common ReDoS-vulnerable patterns without external dependencies.
 *
 * This is a best-effort implementation that catches obvious cases:
 * - Nested quantifiers: (a+)+, (a*)*,  (a+)*, etc.
 * - Overlapping alternations with repetition: (a|a)+
 * - Quantified groups followed by overlapping content: (.+)*x
 *
 * For comprehensive protection, use a dedicated library like safe-regex2.
 *
 * @param pattern - The regex pattern string to check
 * @returns Result indicating if the pattern is safe
 */
export function checkPatternSafety(pattern: string): PatternSafetyResult {
  // Guard against extremely long patterns to prevent ReDoS on the safety checks themselves
  const MAX_PATTERN_LENGTH = 1000
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      safe: false,
      reason: `Pattern length ${pattern.length} exceeds maximum allowed (${MAX_PATTERN_LENGTH})`,
    }
  }

  // Detect nested quantifiers: (...)+ followed by outer quantifier
  // Matches patterns like (a+)+, (a*)+, (a+)*, ([a-z]+)+, etc.
  if (/\([^)]*[+*]\)[+*]/.test(pattern)) {
    return {
      safe: false,
      reason: 'Nested quantifiers detected - may cause catastrophic backtracking',
    }
  }

  // Detect nested quantifiers with {n,m} syntax
  // Matches patterns like (a+){2,}, (a*){1,100}, etc.
  if (/\([^)]*[+*]\)\{\d+,\d*\}/.test(pattern)) {
    return {
      safe: false,
      reason: 'Nested quantifiers with bounds detected - may cause catastrophic backtracking',
    }
  }

  // Detect quantified groups containing alternation with similar branches
  // Simplified check for patterns like (a|a)+, (ab|ab)+
  // This catches (x|x)+ style patterns
  if (/\(([^|()]+)\|\1\)[+*]/.test(pattern)) {
    return {
      safe: false,
      reason: 'Overlapping alternation with quantifier detected - may cause catastrophic backtracking',
    }
  }

  // Detect extremely large quantifier bounds
  const upper = extractQuantifierUpperBound(pattern)
  if (upper !== null && upper > 10000) {
    return {
      safe: false,
      reason: `Quantifier bound ${upper} exceeds safe threshold (10000)`,
    }
  }

  // Detect .+ or .* followed by another .+ or .* (potential polynomial time)
  if (/\.\*.*\.\*|\.\+.*\.\+/.test(pattern)) {
    return {
      safe: false,
      reason: 'Multiple unbounded wildcards detected - may cause polynomial time complexity',
    }
  }

  return { safe: true }
}
