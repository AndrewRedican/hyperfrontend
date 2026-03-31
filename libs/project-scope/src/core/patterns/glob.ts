/**
 * Match path against glob pattern using safe character iteration.
 * Avoids regex to prevent ReDoS attacks.
 *
 * Supported patterns:
 * - * matches any characters except /
 * - ** matches any characters including /
 * - ? matches exactly one character except /
 * - {a,b,c} matches any of the alternatives
 *
 * @param path - The filesystem path to test against the pattern
 * @param pattern - The glob pattern to match against
 * @returns True if path matches pattern
 *
 * @example
 * ```typescript
 * import { matchGlobPattern } from '@hyperfrontend/project-scope'
 *
 * matchGlobPattern('src/utils/helper.ts', '\*\*\/*.ts')     // true
 * matchGlobPattern('test.spec.ts', '\*.spec.ts')          // true
 * matchGlobPattern('config.json', '\*.{json,yaml}')       // true
 * matchGlobPattern('src/index.ts', 'src/\*.ts')           // true
 * ```
 */
export function matchGlobPattern(path: string, pattern: string): boolean {
  return matchSegments(path.split('/'), pattern.split('/'), 0, 0)
}

/**
 * Internal recursive function to match path segments against pattern segments.
 *
 * @param pathParts - Array of path segments split by '/'
 * @param patternParts - Array of pattern segments split by '/'
 * @param pathIdx - Current index in pathParts being examined
 * @param patternIdx - Current index in patternParts being examined
 * @returns True if remaining segments match
 */
function matchSegments(pathParts: string[], patternParts: string[], pathIdx: number, patternIdx: number): boolean {
  // Base cases
  if (pathIdx === pathParts.length && patternIdx === patternParts.length) {
    return true // Both exhausted = match
  }

  if (patternIdx >= patternParts.length) {
    return false // Pattern exhausted but path remains
  }

  const patternPart = patternParts[patternIdx]

  // Handle ** (globstar) - matches zero or more directories
  if (patternPart === '**') {
    // Try matching rest of pattern against current position and all future positions
    for (let i = pathIdx; i <= pathParts.length; i++) {
      if (matchSegments(pathParts, patternParts, i, patternIdx + 1)) {
        return true
      }
    }
    return false
  }

  if (pathIdx >= pathParts.length) {
    return false // Path exhausted but pattern remains (and it's not **)
  }

  const pathPart = pathParts[pathIdx]

  // Match current segment
  if (matchSegment(pathPart, patternPart)) {
    return matchSegments(pathParts, patternParts, pathIdx + 1, patternIdx + 1)
  }

  return false
}

/**
 * Match a single path segment against a pattern segment.
 * Handles *, ?, and {a,b,c} patterns.
 *
 * @param text - The path segment text to match
 * @param pattern - The pattern segment to match against
 * @returns True if the text matches the pattern
 */
function matchSegment(text: string, pattern: string): boolean {
  let textIdx = 0
  let patternIdx = 0

  while (patternIdx < pattern.length) {
    const char = pattern[patternIdx]

    if (char === '*') {
      // * matches zero or more characters
      patternIdx++
      if (patternIdx === pattern.length) {
        return true // * at end matches rest of string
      }

      // Try matching rest of pattern at each position in text
      for (let i = textIdx; i <= text.length; i++) {
        if (matchSegmentFrom(text, i, pattern, patternIdx)) {
          return true
        }
      }
      return false
    } else if (char === '?') {
      // ? matches exactly one character
      if (textIdx >= text.length) {
        return false
      }
      textIdx++
      patternIdx++
    } else if (char === '{') {
      // {a,b,c} matches any alternative
      const closeIdx = findClosingBrace(pattern, patternIdx)
      if (closeIdx === -1) {
        // Unmatched brace, treat as literal
        if (textIdx >= text.length || text[textIdx] !== char) {
          return false
        }
        textIdx++
        patternIdx++
      } else {
        const alternatives = extractAlternatives(pattern.slice(patternIdx + 1, closeIdx))
        for (const alt of alternatives) {
          if (matchSegmentFrom(text, textIdx, text.slice(0, textIdx) + alt + pattern.slice(closeIdx + 1), textIdx)) {
            return true
          }
        }
        return false
      }
    } else {
      // Literal character
      if (textIdx >= text.length || text[textIdx] !== char) {
        return false
      }
      textIdx++
      patternIdx++
    }
  }

  return textIdx === text.length
}

/**
 * Helper to match from a specific position.
 *
 * @param text - The full text being matched
 * @param textIdx - The starting index in text to match from
 * @param pattern - The full pattern being matched
 * @param patternIdx - The starting index in pattern to match from
 * @returns True if the text matches the pattern from the given positions
 */
function matchSegmentFrom(text: string, textIdx: number, pattern: string, patternIdx: number): boolean {
  const remainingText = text.slice(textIdx)
  const remainingPattern = pattern.slice(patternIdx)
  return matchSegment(remainingText, remainingPattern)
}

/**
 * Find closing brace for {a,b,c} pattern.
 *
 * @param pattern - The pattern string to search within
 * @param startIdx - The index of the opening brace
 * @returns The index of the matching closing brace, or -1 if not found
 */
function findClosingBrace(pattern: string, startIdx: number): number {
  let depth = 0
  for (let i = startIdx; i < pattern.length; i++) {
    if (pattern[i] === '{') {
      depth++
    } else if (pattern[i] === '}') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

/**
 * Extract alternatives from {a,b,c} pattern content.
 *
 * @param content - The content between braces (without the braces themselves)
 * @returns Array of alternative strings split by commas at depth 0
 */
function extractAlternatives(content: string): string[] {
  const alternatives: string[] = []
  let current = ''
  let depth = 0

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (char === '{') {
      depth++
      current += char
    } else if (char === '}') {
      depth--
      current += char
    } else if (char === ',' && depth === 0) {
      alternatives.push(current)
      current = ''
    } else {
      current += char
    }
  }

  if (current) {
    alternatives.push(current)
  }

  return alternatives
}

/**
 * Test if path matches any of the patterns.
 *
 * @param path - Path to test
 * @param patterns - Array of glob patterns
 * @returns True if path matches any pattern
 */
export function matchesAnyPattern(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchGlobPattern(path, pattern))
}

/**
 * Test if path exactly matches the pattern (no glob).
 *
 * @param path - Path to test
 * @param pattern - Exact pattern to match
 * @returns True if path equals pattern
 */
export function matchesExact(path: string, pattern: string): boolean {
  return path === pattern
}
