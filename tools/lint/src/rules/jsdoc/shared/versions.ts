/**
 * Whether a text is a semantic version, as `@version` and `@since` require: three numbers
 * without leading zeros, an optional pre-release and build, an optional `v` or `=` before.
 *
 * @module rules/jsdoc/shared/versions
 */

/**
 * Whether a text is a run of digits without a leading zero.
 *
 * @param text - The text tested
 * @returns Whether it is a number as a version writes one
 */
function isNumber(text: string): boolean {
  return /^(0|[1-9]\d*)$/.test(text)
}

/**
 * Whether the dot-separated identifiers of a pre-release or build are well formed.
 *
 * @param text - The dot-separated identifiers
 * @param numbersPlain - Whether a numeric identifier may not have a leading zero, as in a pre-release
 * @returns Whether each is a non-empty run of letters, digits and hyphens
 */
function areIdentifiers(text: string, numbersPlain: boolean): boolean {
  return text.split('.').every((part) => /^[0-9A-Za-z-]+$/.test(part) && !(numbersPlain && /^\d+$/.test(part) && !isNumber(part)))
}

/**
 * Whether a text is a semantic version.
 *
 * @param text - The trimmed text
 * @returns Whether it is valid
 */
export function isSemver(text: string): boolean {
  let rest = text.startsWith('v') || text.startsWith('=') ? text.slice(1) : text
  const plus = rest.indexOf('+')
  if (plus !== -1) {
    if (!areIdentifiers(rest.slice(plus + 1), false)) return false
    rest = rest.slice(0, plus)
  }
  const dash = rest.indexOf('-')
  if (dash !== -1) {
    if (!areIdentifiers(rest.slice(dash + 1), true)) return false
    rest = rest.slice(0, dash)
  }
  const parts = rest.split('.')
  return parts.length === 3 && parts.every(isNumber)
}
