import type { ExpectedError, InvalidCase, RuleCase } from '@hyperfrontend/linter/testing'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { CONFIG, LIBRARY_PATHS, PACKAGES, configuration, createStatisticsWorkspace, lines } from './__test-utils__/statistics-workspace.ts'
import rule from './statistics-packages.ts'

const workspace = createStatisticsWorkspace()

const [JSON_UTILS, LOGGING, NEXUS] = PACKAGES as readonly [string, string, string]
const UNREADABLE =
  'The default export must be an object literal whose immutable.packages is an array of string literals, one per tracked package'

/**
 * An entry as the configuration writes it.
 *
 * @param name - The package name
 * @returns The name in single quotes
 */
const quoted = (name: string): string => `'${name}'`

const EVERY = lines(PACKAGES.map(quoted))

/**
 * What the rule reports for a publishable library the list lacks.
 *
 * @param name - The package name
 * @returns The message
 */
const missing = (name: string): string =>
  `Publishable library '${name}' (${LIBRARY_PATHS[name]}) is not listed in immutable.packages, so the service would never collect its downloads`

/**
 * What the rule reports for an entry no publishable library publishes under.
 *
 * @param name - The entry
 * @returns The message
 */
const unknown = (name: string): string => `'${name}' is not the package name of a publishable library of this workspace`

/**
 * What the rule reports for an entry written again.
 *
 * @param name - The entry
 * @returns The message
 */
const repeated = (name: string): string => `'${name}' is listed more than once in immutable.packages`

/**
 * The line and column of an offset.
 *
 * @param text - The file's text
 * @param offset - How many characters come before the place asked about
 * @returns Both, 1-based
 */
const positionOf = (text: string, offset: number): { line: number; column: number } => {
  const before = text.slice(0, offset)
  return { line: before.split(/\r?\n/).length, column: offset - before.lastIndexOf('\n') }
}

/**
 * The error a span of a case's text gives.
 *
 * @param text - The case's text
 * @param start - Where the span starts
 * @param length - How long it is
 * @param message - What the rule reports there
 * @returns The expected error
 */
const span = (text: string, start: number, length: number, message: string): ExpectedError => {
  const from = positionOf(text, start)
  const to = positionOf(text, start + length)
  return { message, line: from.line, column: from.column, endLine: to.line, endColumn: to.column }
}

/**
 * The error at the first occurrence of a text.
 *
 * @param text - The case's text
 * @param needle - The reported text
 * @param message - What the rule reports there
 * @returns The expected error
 */
const on = (text: string, needle: string, message: string): ExpectedError => span(text, text.indexOf(needle), needle.length, message)

/**
 * The error at the last occurrence of a text.
 *
 * @param text - The case's text
 * @param needle - The reported text
 * @param message - What the rule reports there
 * @returns The expected error
 */
const onLast = (text: string, needle: string, message: string): ExpectedError =>
  span(text, text.lastIndexOf(needle), needle.length, message)

/**
 * A case linting a text as a file of the workspace.
 *
 * @param name - What the case shows
 * @param text - What the linted path holds
 * @param at - The linted path, workspace-relative
 * @returns The case
 */
const file = (name: string, text: string, at: string = CONFIG): RuleCase => ({
  name,
  path: join(workspace.root, at),
  root: workspace.root,
  text,
})

/**
 * A case whose list lacks libraries.
 *
 * @param name - What the case shows
 * @param packages - The source of the `packages` value
 * @param libraries - The package names the list lacks, in ascending order
 * @param fixed - The source of the value after the fix, or null when none is offered
 * @returns The case
 */
const lacking = (name: string, packages: string, libraries: readonly string[], fixed: string | null): InvalidCase => {
  const text = configuration(packages)
  return {
    ...file(name, text),
    errors: libraries.map((library) => on(text, packages, missing(library))),
    output: fixed === null ? null : configuration(fixed),
  }
}

/**
 * A case whose list the rule cannot read.
 *
 * @param name - What the case shows
 * @param text - The file's text
 * @param closest - The text of the node closest to the problem
 * @returns The case
 */
const unreadable = (name: string, text: string, closest: string): InvalidCase => ({
  ...file(name, text),
  errors: [on(text, closest, UNREADABLE)],
})

const TWICE = configuration(lines([...PACKAGES, LOGGING, LOGGING].map(quoted)))
const STRANGERS = configuration(lines([quoted('@hyperfrontend/internal'), ...PACKAGES.map(quoted), quoted('left-pad'), quoted('left-pad')]))
const SPREAD = configuration(`[${quoted(LOGGING)}, ...others, extra]`)
const HOLE = `[${quoted(LOGGING)}, , ${quoted(NEXUS)}]`

testRule(rule, {
  valid: [
    file('a list naming every publishable library', configuration(EVERY)),
    file('a list in another order', configuration(lines([NEXUS, JSON_UTILS, LOGGING].map(quoted)))),
    file('a configuration under assertions', `export default { immutable: { packages: ${EVERY} as const } as const } satisfies Config\n`),
    file(
      'members beside spreads, computed keys and other keys',
      `export default { ...base, [immutable]: 1, 2: 3, 'immutable': { ...rest, other: 1, "packages": ${EVERY} } }\n`
    ),
    file(
      'a member written twice, the last one complete',
      `export default { immutable: { packages: [] }, immutable: { packages: ${EVERY} } }\n`
    ),
    file('a configuration of another service', 'export default {}\n', 'apps/other/service.config.ts'),
    file('another file of the service', 'export default {}\n', 'apps/statistics/src/service.config.ts'),
    {
      name: 'a configuration outside any workspace',
      path: join(workspace.outside, CONFIG),
      root: workspace.outside,
      text: 'export default {}\n',
    },
  ],
  invalid: [
    lacking('a library removed from the middle of a sorted list', lines([JSON_UTILS, NEXUS].map(quoted)), [LOGGING], EVERY),
    lacking('a library sorting before every entry', lines([LOGGING, NEXUS].map(quoted)), [JSON_UTILS], EVERY),
    lacking('a library sorting after every entry', lines([JSON_UTILS, LOGGING].map(quoted)), [NEXUS], EVERY),
    lacking('two libraries before the only entry, written on its own line', lines([quoted(NEXUS)]), [JSON_UTILS, LOGGING], EVERY),
    lacking(
      'libraries on both sides of the only entry, written on one line',
      `[${quoted(LOGGING)}]`,
      [JSON_UTILS, NEXUS],
      `[${PACKAGES.map(quoted).join(', ')}]`
    ),
    lacking(
      'a library missing from an unsorted list in double quotes',
      `["${NEXUS}", "${JSON_UTILS}"]`,
      [LOGGING],
      `["${NEXUS}", "${JSON_UTILS}", "${LOGGING}"]`
    ),
    lacking('every library missing from an empty list', '[]', PACKAGES, `[${PACKAGES.map(quoted).join(', ')}]`),
    lacking('an empty list holding a comment, left unfixed', '[/* none yet */]', PACKAGES, null),
    lacking('a comment before the first entry, left unfixed', `[/* first */ ${quoted(JSON_UTILS)}, ${quoted(NEXUS)}]`, [LOGGING], null),
    lacking('a comment between entries, left unfixed', `[${quoted(JSON_UTILS)}, /* next */ ${quoted(NEXUS)}]`, [LOGGING], null),
    lacking('a comment after the last entry, left unfixed', `[${quoted(JSON_UTILS)}, ${quoted(NEXUS)}, /* last */]`, [LOGGING], null),
    lacking('an entry in parentheses, left unfixed', `[(${quoted(JSON_UTILS)}), ${quoted(NEXUS)}]`, [LOGGING], null),
    {
      ...file('an entry written again, each time after the first', TWICE),
      errors: [
        span(TWICE, TWICE.indexOf(quoted(LOGGING), TWICE.indexOf(quoted(NEXUS))), quoted(LOGGING).length, repeated(LOGGING)),
        onLast(TWICE, quoted(LOGGING), repeated(LOGGING)),
      ],
    },
    {
      ...file('entries no publishable library publishes under', STRANGERS),
      errors: [
        on(STRANGERS, quoted('@hyperfrontend/internal'), unknown('@hyperfrontend/internal')),
        on(STRANGERS, quoted('left-pad'), unknown('left-pad')),
        onLast(STRANGERS, quoted('left-pad'), repeated('left-pad')),
      ],
    },
    {
      ...file('a file without a default export', 'export const config = {}\n'),
      errors: [{ message: UNREADABLE, line: 1, column: 1, endLine: 1, endColumn: 1 }],
    },
    unreadable('a default export that is a name', 'export default config\n', 'config'),
    unreadable('a default export that is a function', 'export default function build() {}\n', 'function build() {}'),
    unreadable('a default export without an immutable section', 'export default { mutable: {} } satisfies Config\n', '{ mutable: {} }'),
    unreadable('an immutable section that is no object literal', 'export default { immutable: null }\n', 'null'),
    unreadable('an immutable section named in shorthand', 'export default { immutable }\n', 'immutable'),
    unreadable('an immutable section without packages', 'export default { immutable: { origins: [] } }\n', '{ origins: [] }'),
    unreadable('packages that is no array', `export default { immutable: { packages: ${quoted(LOGGING)} } }\n`, quoted(LOGGING)),
    unreadable('entries that are no string literals, reported at the first', SPREAD, '...others'),
    unreadable('an entry that is a number', configuration('[1]'), '1'),
    unreadable('an entry that is a template', configuration(`[\`${LOGGING}\`]`), `\`${LOGGING}\``),
    unreadable('a hole among the entries', configuration(HOLE), HOLE),
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
