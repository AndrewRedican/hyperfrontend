/**
 * The spellings of one name: the class, property, constant and file forms a generator writes
 * into templates and paths, and the refusal of a name that the files written from it could not
 * carry.
 *
 * @module generators/shared/names
 */

import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { COMMENT_END } from './templates'

/** The forms of a name. */
export interface Names {
  /** The name as given. */
  readonly name: string
  /** UpperCamelCase. */
  readonly className: string
  /** lowerCamelCase. */
  readonly propertyName: string
  /** CONSTANT_CASE. */
  readonly constantName: string
  /** lower-hyphenated. */
  readonly fileName: string
}

/**
 * lowerCamelCase from any separators.
 *
 * @param name - Any spelling
 * @returns The property form
 */
function toPropertyName(name: string): string {
  return name
    .replace(/([^a-zA-Z0-9])+(.)?/g, (_match, _separator: string, next: string | undefined) =>
      next === undefined ? '' : next.toUpperCase()
    )
    .replace(/[^a-zA-Z\d]/g, '')
    .replace(/^([A-Z])/, (first) => first.toLowerCase())
}

/**
 * lower-hyphenated from camel case.
 *
 * @param name - Any spelling
 * @returns The file form
 */
function toFileName(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/(?!^[_])[ _]/g, '-')
}

/**
 * The forms of a name.
 *
 * @param name - Any spelling, such as `my-lib`, `myLib` or `MY_LIB`
 * @returns The class, property, constant and file forms
 *
 * @example The forms a template reads
 * ```typescript
 * names('data-utils')
 * // => { name: 'data-utils', className: 'DataUtils', propertyName: 'dataUtils', constantName: 'DATA_UTILS', fileName: 'data-utils' }
 * names('DataUtils').fileName // => 'data-utils'
 * ```
 */
export function names(name: string): Names {
  const propertyName = toPropertyName(name)
  const normalised = name.toUpperCase() === name ? name.toLowerCase() : name
  return {
    name,
    className: propertyName.charAt(0).toUpperCase() + propertyName.slice(1),
    propertyName,
    constantName: toFileName(toPropertyName(normalised))
      .replace(/([^a-zA-Z0-9])/g, '_')
      .toUpperCase(),
    fileName: toFileName(name),
  }
}

/**
 * Refuses a name that the files a generator writes could not carry as it is written: one that
 * holds a quote, a backslash or a control character, a line break among them, which would end
 * the quoted string or the line it stands in, or the two characters that end a comment.
 *
 * @param what - What the value names, such as `project name`, for the error
 * @param name - The name as given
 * @throws {Error} When the name holds a quote, a backslash, a control character or the end of a comment
 *
 * @example At the boundary of a generator's options
 * ```typescript
 * assertWritableName('project name', 'site-web') // passes
 * assertWritableName('project name', "it's")
 * // throws: Invalid project name "it's": a name cannot hold a quote, a backslash, a control character or the end of a comment, *\/
 * ```
 */
export function assertWritableName(what: string, name: string): void {
  // why: JSON writes a string between quotes unchanged only when it holds no double quote, backslash or control character
  if (stringify(name) === `"${name}"` && !name.includes("'") && !name.includes(COMMENT_END)) return
  throw createError(
    `Invalid ${what} ${stringify(name)}: a name cannot hold a quote, a backslash, a control character or the end of a comment, ${COMMENT_END}`
  )
}
