/**
 * Dotted `@param` and `@property` paths compared as the previous linter compared them: a segment
 * written quoted, such as `options."a-b"`, equals the same segment unquoted.
 *
 * @module rules/jsdoc/shared/paths
 */

/**
 * A path with the quotes around its segments dropped: `.` followed by a quoted segment becomes
 * the segment bare.
 *
 * @param path - The dotted path
 * @returns The path without segment quotes
 */
export function unquotePath(path: string): string {
  let result = ''
  let at = 0
  while (at < path.length) {
    const quote = path[at + 1]
    if (path[at] === '.' && (quote === '"' || quote === "'")) {
      // why: as the previous linter's greedy match did, the segment runs to the last matching quote of the path.
      const close = path.lastIndexOf(quote)
      if (close > at + 1) {
        result += `.${path.slice(at + 2, close)}`
        at = close + 1
        continue
      }
    }
    result += path[at]
    at += 1
  }
  return result
}

/**
 * Whether two paths are the same, segment quotes aside.
 *
 * @param a - One path
 * @param b - The other
 * @returns Whether they name the same path
 */
export function samePath(a: string, b: string): boolean {
  return a === b || unquotePath(a) === unquotePath(b)
}

/**
 * Whether a path does not start with a prefix, segment quotes aside.
 *
 * @param path - The path tested
 * @param prefix - The path it should start with
 * @returns Whether neither form of the path starts with the prefix
 */
export function lacksPrefix(path: string, prefix: string): boolean {
  return !path.startsWith(prefix) && !unquotePath(path).startsWith(unquotePath(prefix))
}
