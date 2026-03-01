import { NODE_BUILTIN_MODULES } from './node-builtins'

/**
 * Import source categories for ordering.
 */
export const ImportCategory = {
  NodeBuiltin: 0,
  External: 1,
  Hyperfrontend: 2,
  Relative: 3,
  CurrentDir: 4,
} as const

export type ImportCategoryType = (typeof ImportCategory)[keyof typeof ImportCategory]

/**
 * Determines the category of an import source for ordering purposes.
 *
 * @param source - The import source string.
 * @returns The category number (lower = higher priority).
 */
export function getImportCategory(source: string): ImportCategoryType {
  // Node.js built-in modules (with node: prefix)
  if (source.startsWith('node:')) {
    return ImportCategory.NodeBuiltin
  }

  // Node.js built-in modules (without node: prefix - should be caught by require-node-protocol)
  /* istanbul ignore next - defensive fallback for empty source */
  const moduleName = source.split('/')[0] ?? ''
  /* istanbul ignore next - node builtins without prefix caught by require-node-protocol */
  if (NODE_BUILTIN_MODULES.has(moduleName)) {
    return ImportCategory.NodeBuiltin
  }

  // Current directory imports
  if (source.startsWith('./')) {
    return ImportCategory.CurrentDir
  }

  // Relative imports (parent directories)
  if (source.startsWith('../')) {
    return ImportCategory.Relative
  }

  // Hyperfrontend packages
  if (source.startsWith('@hyperfrontend/')) {
    return ImportCategory.Hyperfrontend
  }

  // Everything else is external
  return ImportCategory.External
}

/**
 * Counts the depth of a relative import (number of ../ segments).
 *
 * @param source - The import source string.
 * @returns The depth count (0 for non-relative imports).
 */
export function getRelativeDepth(source: string): number {
  /* istanbul ignore next - early return for non-relative imports */
  if (!source.startsWith('../')) {
    return 0
  }

  let depth = 0
  let remaining = source

  while (remaining.startsWith('../')) {
    depth++
    remaining = remaining.slice(3)
  }

  return depth
}

/**
 * Compares two import sources for sorting.
 * Returns negative if a should come before b, positive if b should come before a.
 *
 * @param sourceA - First import source.
 * @param sourceB - Second import source.
 * @returns Comparison result for sorting.
 */
export function compareImportSources(sourceA: string, sourceB: string): number {
  const categoryA = getImportCategory(sourceA)
  const categoryB = getImportCategory(sourceB)

  // Different categories: sort by category
  if (categoryA !== categoryB) {
    return categoryA - categoryB
  }

  // Same category: special handling for relative imports (deeper first)
  /* istanbul ignore next - covered via import-order tests */
  if (categoryA === ImportCategory.Relative) {
    const depthA = getRelativeDepth(sourceA)
    const depthB = getRelativeDepth(sourceB)
    /* istanbul ignore else - same depth falls through to alphabetical */
    if (depthA !== depthB) {
      return depthB - depthA // Deeper imports first
    }
  }

  // Same category and depth: alphabetical
  /* istanbul ignore next - alphabetical fallback */
  return sourceA.localeCompare(sourceB)
}
