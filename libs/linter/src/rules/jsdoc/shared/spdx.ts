/**
 * Whether a text is an SPDX license expression: license identifiers, optionally followed by
 * `+` or `WITH` an exception, combined by `AND` and `OR` and grouped by parentheses, or
 * `LicenseRef-` references.
 *
 * @module rules/jsdoc/shared/spdx
 */

import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The license identifiers known: the SPDX list's widely used entries and their deprecated forms. */
const LICENSES = createSet<string>([
  '0BSD',
  'AAL',
  'AFL-1.1',
  'AFL-1.2',
  'AFL-2.0',
  'AFL-2.1',
  'AFL-3.0',
  'AGPL-1.0',
  'AGPL-1.0-only',
  'AGPL-1.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'Apache-1.0',
  'Apache-1.1',
  'Apache-2.0',
  'APSL-1.0',
  'APSL-2.0',
  'Artistic-1.0',
  'Artistic-2.0',
  'Beerware',
  'BlueOak-1.0.0',
  'BSD-1-Clause',
  'BSD-2-Clause',
  'BSD-2-Clause-Patent',
  'BSD-3-Clause',
  'BSD-3-Clause-Clear',
  'BSD-3-Clause-LBNL',
  'BSD-4-Clause',
  'BSL-1.0',
  'BUSL-1.1',
  'bzip2-1.0.6',
  'CAL-1.0',
  'CC-BY-1.0',
  'CC-BY-2.0',
  'CC-BY-2.5',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC-BY-NC-4.0',
  'CC-BY-NC-ND-4.0',
  'CC-BY-NC-SA-4.0',
  'CC-BY-ND-4.0',
  'CC-BY-SA-3.0',
  'CC-BY-SA-4.0',
  'CC0-1.0',
  'CDDL-1.0',
  'CDDL-1.1',
  'CECILL-2.1',
  'CPAL-1.0',
  'CPL-1.0',
  'curl',
  'ECL-2.0',
  'EFL-2.0',
  'EPL-1.0',
  'EPL-2.0',
  'EUPL-1.1',
  'EUPL-1.2',
  'GFDL-1.3',
  'GFDL-1.3-only',
  'GFDL-1.3-or-later',
  'GPL-1.0',
  'GPL-1.0-only',
  'GPL-1.0-or-later',
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'Hippocratic-2.1',
  'ICU',
  'IPL-1.0',
  'ISC',
  'JSON',
  'LGPL-2.0',
  'LGPL-2.0-only',
  'LGPL-2.0-or-later',
  'LGPL-2.1',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'LPPL-1.3c',
  'MIT',
  'MIT-0',
  'MIT-CMU',
  'MPL-1.0',
  'MPL-1.1',
  'MPL-2.0',
  'MPL-2.0-no-copyleft-exception',
  'MS-PL',
  'MS-RL',
  'MulanPSL-2.0',
  'NCSA',
  'ODbL-1.0',
  'OFL-1.1',
  'OpenSSL',
  'OSL-3.0',
  'PostgreSQL',
  'PSF-2.0',
  'Python-2.0',
  'QPL-1.0',
  'Ruby',
  'SSPL-1.0',
  'Unicode-3.0',
  'Unicode-DFS-2016',
  'Unlicense',
  'UPL-1.0',
  'Vim',
  'W3C',
  'WTFPL',
  'X11',
  'Zlib',
  'ZPL-2.0',
  'ZPL-2.1',
])

/** The exception identifiers known, written after `WITH`. */
const EXCEPTIONS = createSet<string>([
  'Autoconf-exception-3.0',
  'Bison-exception-2.2',
  'Classpath-exception-2.0',
  'Font-exception-2.0',
  'GCC-exception-3.1',
  'Libtool-exception',
  'Linux-syscall-note',
  'LLVM-exception',
  'OpenJDK-assembly-exception-1.0',
  'Qt-LGPL-exception-1.1',
  'WxWindows-exception-3.1',
])

/** A cursor over the tokens of an expression. */
interface Cursor {
  /** The tokens: words and parentheses. */
  readonly tokens: readonly string[]
  /** The index of the next token. */
  at: number
}

/**
 * Splits an expression into words and parentheses.
 *
 * @param text - The expression
 * @returns The words and parentheses, in order
 */
function tokensOf(text: string): string[] {
  return text
    .replace(/[()]/g, (paren) => ` ${paren} `)
    .split(/\s+/)
    .filter((token) => token !== '')
}

/**
 * Whether a word is a reference: the prefix, then letters, digits, dots and hyphens.
 *
 * @param word - The word tested
 * @param prefix - The prefix, such as `LicenseRef-`
 * @returns Whether it is a reference of that kind
 */
function isRef(word: string, prefix: string): boolean {
  return word.startsWith(prefix) && word.length > prefix.length && /^[0-9A-Za-z.-]+$/.test(word.slice(prefix.length))
}

/**
 * Whether a word names a license: a known identifier, optionally with `+`, or a reference.
 *
 * @param word - The word tested
 * @returns Whether it is a license
 */
function isLicense(word: string): boolean {
  const colon = word.indexOf(':')
  const reference = colon === -1 ? word : word.slice(colon + 1)
  if (colon !== -1 && !isRef(word.slice(0, colon), 'DocumentRef-')) return false
  if (isRef(reference, 'LicenseRef-')) return true
  return colon === -1 && LICENSES.has(word.endsWith('+') ? word.slice(0, -1) : word)
}

/**
 * Reads a license or a parenthesised expression, with its exception.
 *
 * @param cursor - The cursor, moved past what is read
 * @returns Whether it is well formed
 */
function readTerm(cursor: Cursor): boolean {
  const token = cursor.tokens[cursor.at]
  cursor.at += 1
  if (token === '(') {
    if (!readOr(cursor) || cursor.tokens[cursor.at] !== ')') return false
    cursor.at += 1
    return true
  }
  if (token === undefined || !isLicense(token)) return false
  if (cursor.tokens[cursor.at] !== 'WITH') return true
  cursor.at += 2
  return EXCEPTIONS.has(cursor.tokens[cursor.at - 1] ?? '')
}

/**
 * Reads terms joined by an operator.
 *
 * @param cursor - The cursor, moved past what is read
 * @param operator - The operator joining them
 * @param read - How one operand is read
 * @returns Whether every operand is well formed
 */
function readJoined(cursor: Cursor, operator: string, read: (cursor: Cursor) => boolean): boolean {
  if (!read(cursor)) return false
  while (cursor.tokens[cursor.at] === operator) {
    cursor.at += 1
    if (!read(cursor)) return false
  }
  return true
}

/**
 * Reads an `OR` of `AND`s.
 *
 * @param cursor - The cursor, moved past what is read
 * @returns Whether it is well formed
 */
function readOr(cursor: Cursor): boolean {
  return readJoined(cursor, 'OR', (inner) => readJoined(inner, 'AND', readTerm))
}

/**
 * Whether a text is an SPDX license expression.
 *
 * @param text - The text tested
 * @returns Whether it is valid
 *
 * @example Validate the value of a license tag
 * ```ts
 * isLicenseExpression('(MIT OR Apache-2.0) AND BSD-3-Clause') // => true
 * isLicenseExpression('Apache-2.0 WITH LLVM-exception') // => true
 * isLicenseExpression('LicenseRef-acme-eula') // => true
 * isLicenseExpression('mit') // => false (identifiers are case-sensitive)
 * isLicenseExpression('MIT OR') // => false
 * ```
 */
export function isLicenseExpression(text: string): boolean {
  const cursor = { tokens: tokensOf(text), at: 0 }
  return readOr(cursor) && cursor.at === cursor.tokens.length
}
