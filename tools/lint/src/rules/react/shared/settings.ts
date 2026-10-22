/**
 * What the `react` settings block says about the file: the React version it targets, the
 * pragma JSX compiles to, and the names of the class factory and fragment.
 *
 * @module rules/react/shared/settings
 */

import type { RuleFile } from '../../../engine/rule.ts'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** A version as major, minor and patch numbers. */
export type Version = readonly [number, number, number]

/** The version assumed when the settings name none, or none that reads as a version: the newest. */
const LATEST: Version = [999, 999, 999]

/** A `@jsx` annotation in a comment, with the pragma it names. */
const JSX_ANNOTATION = /@jsx\s+(\S+)/

/**
 * The settings' `react` block.
 *
 * @param settings - The settings of the blocks that matched the file
 * @returns The block, or an empty one
 */
function reactSettings(settings: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return (settings['react'] ?? {}) as Readonly<Record<string, unknown>>
}

/**
 * The React version the settings name, read as the first run of up to three dot-separated
 * numbers in it with missing parts zero; the newest version when there is none (`detect` too).
 *
 * @param settings - The settings of the blocks that matched the file
 * @returns The major, minor and patch numbers
 */
export function reactVersion(settings: Readonly<Record<string, unknown>>): Version {
  const configured = reactSettings(settings)['version']
  if (configured === undefined) return LATEST
  const text = String(configured)
  let index = 0
  while (index < text.length && !isDigit(text[index] as string)) index += 1
  if (index === text.length) return LATEST
  const parts: number[] = []
  while (parts.length < 3) {
    let end = index
    while (end < text.length && isDigit(text[end] as string)) end += 1
    parts.push(parseInt(text.slice(index, end), 10))
    if (text[end] !== '.' || !isDigit(text[end + 1] ?? '')) break
    index = end + 1
  }
  while (parts.length < 3) parts.push(0)
  return parts as unknown as Version
}

/**
 * Whether a character is an ASCII digit.
 *
 * @param character - The character tested
 * @returns Whether it is `0` to `9`
 */
function isDigit(character: string): boolean {
  return character >= '0' && character <= '9'
}

/**
 * Orders two versions.
 *
 * @param a - The first version compared
 * @param b - The second version compared
 * @returns Negative, zero or positive as `a` is older than, equal to or newer than `b`
 */
function compare(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/**
 * Whether a version is at least another, as the range `>= floor`.
 *
 * @param version - The version tested
 * @param floor - The lowest version accepted
 * @returns Whether `version` is `floor` or newer
 */
export function atLeast(version: Version, floor: Version): boolean {
  return compare(version, floor) >= 0
}

/**
 * Whether a version satisfies the caret range `^base`: at least `base`, below the next change
 * of its first non-zero part.
 *
 * @param version - The version tested
 * @param base - The range's base version
 * @returns Whether `version` is compatible with `base`
 */
export function caret(version: Version, base: Version): boolean {
  if (compare(version, base) < 0) return false
  if (base[0] !== 0) return version[0] === base[0]
  if (base[1] !== 0) return version[0] === 0 && version[1] === base[1]
  return version[0] === 0 && version[1] === 0 && version[2] === base[2]
}

/**
 * The name JSX compiles against: the first `@jsx` annotation's name up to its first dot, else
 * the `react.pragma` setting, else `React`.
 *
 * @param file - The file linted, whose comments are searched for the annotation
 * @param settings - The settings of the blocks that matched the file
 * @returns The identifier JSX elements are created through
 */
export function pragmaOf(file: RuleFile, settings: Readonly<Record<string, unknown>>): string {
  for (const comment of file.comments) {
    const match = JSX_ANNOTATION.exec(comment.text)
    if (match !== null) return (match[1] as string).split('.')[0] as string
  }
  return (reactSettings(settings)['pragma'] as string | undefined) ?? 'React'
}

/**
 * The name of the class factory, the `react.createClass` setting or `createReactClass`.
 *
 * @param settings - The settings of the blocks that matched the file
 * @returns The factory's name
 */
export function createClassOf(settings: Readonly<Record<string, unknown>>): string {
  return (reactSettings(settings)['createClass'] as string | undefined) ?? 'createReactClass'
}

/**
 * The name of the fragment component, the `react.fragment` setting or `Fragment`.
 *
 * @param settings - The settings of the blocks that matched the file
 * @returns The fragment's name
 */
export function fragmentOf(settings: Readonly<Record<string, unknown>>): string {
  return (reactSettings(settings)['fragment'] as string | undefined) ?? 'Fragment'
}
