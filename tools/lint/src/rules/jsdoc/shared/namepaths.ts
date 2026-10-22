/**
 * Whether a text is a JSDoc name or namepath: names joined by `.`, `#` and `~`, each a plain
 * identifier, a quoted string, or prefixed `module:`, `event:` or `external:`; a module path may
 * hold slashes.
 *
 * @module rules/jsdoc/shared/namepaths
 */

/** The prefixes a namepath segment may carry. */
const PREFIXES = ['module:', 'event:', 'external:']

/**
 * Whether a text is a plain identifier.
 *
 * @param text - The text tested
 * @returns Whether it is letters, digits, `_` and `$`, not starting with a digit
 */
export function isIdentifier(text: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(text)
}

/**
 * Whether a segment of a namepath is well formed.
 *
 * @param segment - The segment, between separators
 * @returns Whether it is a name, a quoted string or a prefixed name
 */
function isSegment(segment: string): boolean {
  if (/^"[^"]*"$/.test(segment) || /^'[^']*'$/.test(segment)) return true
  const prefix = PREFIXES.find((candidate) => segment.startsWith(candidate))
  if (prefix === 'module:')
    return segment
      .slice(prefix.length)
      .split('/')
      .every((part) => /^[\w$@-]+$/.test(part))
  const name = prefix === undefined ? segment : segment.slice(prefix.length)
  return isIdentifier(name.endsWith('[]') ? name.slice(0, -2) : name)
}

/**
 * Whether a text is a namepath.
 *
 * @param text - The text tested
 * @returns Whether every segment between separators is well formed
 */
export function isNamepath(text: string): boolean {
  const segments: string[] = []
  let current = ''
  let quote: string | null = null
  for (const char of text) {
    if (quote !== null) {
      current += char
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
      current += char
    } else if (char === '.' || char === '#' || char === '~') {
      segments.push(current)
      current = ''
    } else current += char
  }
  segments.push(current)
  return quote === null && segments.every(isSegment)
}
