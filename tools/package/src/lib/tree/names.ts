/**
 * The spellings of one name: the class, property, constant and file forms a generator writes
 * into templates and paths.
 *
 * @module lib/tree/names
 */

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
