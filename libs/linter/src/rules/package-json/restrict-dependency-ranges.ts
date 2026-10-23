/**
 * Dependency versions use the range type the configuration allows: a pinned version, a caret
 * range or a tilde range. A version of another type is reported with one suggestion per allowed
 * type.
 *
 * @module rules/package-json/restrict-dependency-ranges
 */

import type { Suggestion } from '../../engine/report'
import type { JsonTreeNode } from '../../languages/json'
import type { JsonObjectNode } from '../../languages/json-tree'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parseRangeStrict, parseVersionStrict } from '@hyperfrontend/versioning/semver'
import { defineRule } from '../../engine/rule'
import { isString, rootObject } from '../shared/json'

/** A range type the rule knows. */
type RangeType = 'caret' | 'pin' | 'tilde'

/** One restriction as configured. */
interface Restriction {
  /** The dependency sections the restriction applies to; every section when absent. */
  readonly forDependencyTypes?: readonly string[]
  /** The range type, or types, allowed. */
  readonly rangeType: RangeType | readonly RangeType[]
}

/** The sections a manifest declares dependencies in. */
const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

/** The prefix each range type puts before a version. */
const SYMBOLS: Readonly<Record<RangeType, string>> = { caret: '^', pin: '', tilde: '~' }

/** The suggestion each range type makes. */
const SUGGESTIONS: Readonly<Record<RangeType, string>> = {
  caret: 'Change to use a caret range.',
  pin: 'Pin the version.',
  tilde: 'Change to use a tilde range.',
}

/**
 * Whether a parser accepts a text.
 *
 * @param parser - A strict parser that throws on what it rejects
 * @param text - The version or range to try
 * @returns True when the parser does not throw
 */
function accepts(parser: (text: string) => unknown, text: string): boolean {
  try {
    parser(text)
    return true
  } catch {
    return false
  }
}

/**
 * Whether the rule can judge a version: a workspace shorthand or a valid range.
 *
 * @param version - The declared version
 * @returns True when the version is judged
 */
function isSupported(version: string): boolean {
  if (/^workspace:[*^~]$/.test(version)) return true
  return accepts(parseRangeStrict, version.startsWith('workspace:') ? version.slice(10) : version)
}

/**
 * The range type a version has, when it has one of the three.
 *
 * @param version - A supported version
 * @returns The type, or null for a range of another shape
 */
function rangeTypeOf(version: string): RangeType | null {
  if (version === 'workspace:*' || accepts(parseVersionStrict, version)) return 'pin'
  if (version.startsWith('workspace:^') || (version.startsWith('^') && accepts(parseRangeStrict, version))) return 'caret'
  if (version.startsWith('workspace:~') || (version.startsWith('~') && accepts(parseRangeStrict, version))) return 'tilde'
  return null
}

/**
 * The version rewritten with a range type.
 *
 * @param version - The declared version
 * @param rangeType - The type to give it
 * @returns The rewritten version
 */
function withRangeType(version: string, rangeType: RangeType): string {
  if (/^workspace:[~^*]$/.test(version)) return `workspace:${rangeType === 'pin' ? '*' : SYMBOLS[rangeType]}`
  return version.replace(/^(workspace:)?(\^|~|<=?|>=?)?/, `$1${SYMBOLS[rangeType]}`)
}

export default defineRule<Restriction | readonly Restriction[] | undefined, JsonTreeNode>({
  id: 'package-json/restrict-dependency-ranges',
  language: 'json',
  fixable: false,
  create(context) {
    const configured = context.options
    if (configured === undefined) return {}
    const restrictions = (isArray(configured) ? [...configured].reverse() : [configured]).map((restriction) => ({
      forDependencyTypes: restriction.forDependencyTypes,
      rangeTypes: isArray(restriction.rangeType) ? restriction.rangeType : [restriction.rangeType],
    }))
    return {
      document(node) {
        const root = rootObject(node)
        if (root === null) return
        for (const section of root.properties) {
          if (!SECTIONS.includes(section.key.value as string) || section.value.kind !== 'object') continue
          checkSection(section.key.value as string, section.value)
        }
      },
    }

    /**
     * Checks every dependency of one section.
     *
     * @param sectionName - `dependencies`, `devDependencies`, `peerDependencies` or `optionalDependencies`
     * @param section - The section's object
     */
    function checkSection(sectionName: string, section: JsonObjectNode): void {
      for (const dependency of section.properties) {
        if (!isString(dependency.value)) continue
        const version = dependency.value.value
        if (!isSupported(version)) continue
        const restriction = restrictions.find(
          (candidate) => candidate.forDependencyTypes === undefined || candidate.forDependencyTypes.includes(sectionName)
        )
        if (restriction === undefined) continue
        const message = `This dependency is using the wrong range type.  Acceptable range type(s): ${restriction.rangeTypes.join(', ')}`
        if (version === '*') {
          context.report({ start: dependency.value.start, end: dependency.value.end, message })
          continue
        }
        if (restriction.rangeTypes.includes(rangeTypeOf(version) as RangeType)) continue
        const suggestions: Suggestion[] = restriction.rangeTypes.map((rangeType) => ({
          message: SUGGESTIONS[rangeType],
          fix: { start: dependency.value.start, end: dependency.value.end, text: `"${withRangeType(version, rangeType)}"` },
        }))
        context.report({ start: dependency.value.start, end: dependency.value.end, message, suggestions })
      }
    }
  },
})
