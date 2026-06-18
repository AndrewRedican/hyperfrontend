import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

// why: ESM `import … from '…'` and `export … from '…'` both reduce to the `from '<spec>'` token.
const STATIC_FROM_RE = /from\s*['"]([^'"]+)['"]/g
// why: CJS chunks reference siblings via `require('<spec>')`.
const REQUIRE_LITERAL_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
// why: literal dynamic `import('<spec>')` is a real edge; capturing it keeps over-approximation safe (a missed edge would delete a reachable chunk).
const IMPORT_LITERAL_RE = /import\s*\(\s*['"]([^'"]+)['"]/g

const collectInto = (source: string, re: RegExp, specifiers: Set<string>): void => {
  for (const match of source.matchAll(re)) {
    const spec = <string>match[1]
    if (spec.startsWith('.')) specifiers.add(spec)
  }
}

/**
 * Extracts literal **relative** module specifiers referenced by a chunk's source.
 *
 * Scans ESM `from '…'` (covering both `import … from` and `export … from`),
 * CJS `require('…')`, and literal dynamic `import('…')`. Only specifiers that
 * start with `.` are returned — bare and node-builtin specifiers are never
 * edges into the `_dependencies/` tree. The scan deliberately over-approximates
 * (a spurious match merely keeps a chunk alive), so it is implemented with
 * linear, backtracking-free regexes rather than a full parse.
 *
 * @param source - Raw chunk source text.
 * @returns Unique relative specifiers, in first-seen order.
 *
 * @example Extracting the sibling chunks a CJS chunk requires
 * ```typescript
 * collectChunkSpecifiers("require('../shared/index.cjs.js')") // => ['../shared/index.cjs.js']
 * ```
 */
export const collectChunkSpecifiers = (source: string): string[] => {
  const specifiers = createSet<string>([])
  collectInto(source, STATIC_FROM_RE, specifiers)
  collectInto(source, REQUIRE_LITERAL_RE, specifiers)
  collectInto(source, IMPORT_LITERAL_RE, specifiers)
  return from(specifiers)
}

const WHITESPACE_RE = /\s/

// how: an `import(`/`require(` argument is a pure literal only when a single quoted
const isDynamicArg = (source: string, start: number): boolean => {
  const quote = source.charAt(start)
  if (quote !== '"' && quote !== "'") return true
  let i = start + 1
  while (i < source.length) {
    const ch = source.charAt(i)
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === quote) break
    i += 1
  }
  if (i >= source.length) return true
  let j = i + 1
  while (j < source.length && WHITESPACE_RE.test(source.charAt(j))) j += 1
  return source.charAt(j) !== ')'
}

/**
 * Reports whether a chunk contains a dynamic `import(…)` or `require(…)` whose
 * argument is not a string literal.
 *
 * Used as a safety bail: a dynamic specifier cannot be statically resolved, so
 * reachability over the chunk graph would be incomplete and orphan deletion
 * unsafe. When this returns `true` the caller disables Orphan Sweep deletion for the
 * run. A concatenated argument such as `'@rollup/rollup-' + platform` counts as
 * dynamic even though it begins with a string literal.
 *
 * @param source - Raw chunk source text.
 * @returns `true` if at least one non-literal `import(`/`require(` call exists.
 *
 * @example Detecting a computed require
 * ```typescript
 * hasDynamicSpecifier("require('@rollup/rollup-' + platform)") // => true
 * ```
 */
export const hasDynamicSpecifier = (source: string): boolean => {
  const re = /\b(?:import|require)\s*\(\s*/g
  while (re.exec(source) !== null) {
    if (isDynamicArg(source, re.lastIndex)) return true
  }
  return false
}
