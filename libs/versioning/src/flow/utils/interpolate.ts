import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Interpolates template variables in a string.
 *
 * Supports: ${projectName}, ${packageName}, ${version}
 *
 * @param template - Template string with ${var} placeholders
 * @param vars - Variable values
 * @returns Interpolated string
 *
 * @example
 * ```typescript
 * import { interpolate } from '@hyperfrontend/versioning'
 *
 * const message = interpolate('chore(${projectName}): release ${version}', {
 *   projectName: 'my-lib',
 *   version: '1.2.0'
 * })
 * // => 'chore(my-lib): release 1.2.0'
 * ```
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of entries(vars)) {
    const placeholder = '${' + key + '}'
    let index = result.indexOf(placeholder)
    while (index !== -1) {
      result = result.slice(0, index) + value + result.slice(index + placeholder.length)
      index = result.indexOf(placeholder, index + value.length)
    }
  }
  return result
}
