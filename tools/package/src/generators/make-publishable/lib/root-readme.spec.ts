import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deriveLibraryFacts } from './library-facts'
import { hasPackageRow, numberWord, packageRow, registerPackageRow } from './root-readme'

const TESTING = deriveLibraryFacts({
  projectName: 'lib-testing',
  projectRoot: 'libs/testing',
  packageName: '@hyperfrontend/testing',
  description: 'Jest-style describe, it, expect and jest on node:test.',
  tags: ['type:core'],
  exports: { '.': './src/index.js' },
  hasArchitecture: false,
})

const BLOB = 'https://github.com/AndrewRedican/hyperfrontend/blob/main'

const DOCS = 'https://www.hyperfrontend.dev/docs/libraries'

const HEAD = ['# hyperfrontend', '', 'Intro.', '', '## Packages', '', 'Every package is published on its own.', '', '<details>']

const TABLE = [
  '| npm                                                                 | What it does                                                           |',
  '| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |',
  `| [@hyperfrontend/features](${BLOB}/libs/features)     | The SDK · [docs](${DOCS}/features/)     |`,
  `| [@hyperfrontend/questions](${BLOB}/libs/questions)   | Prompts · [docs](${DOCS}/questions/)    |`,
  `| [@hyperfrontend/json-utils](${BLOB}/libs/utils/json) | JSON · [docs](${DOCS}/utils/json/)      |`,
]

const TAIL = ['', '</details>', '', '## Documentation', '', 'Text.']

const TESTING_ROW = `[@hyperfrontend/testing](${BLOB}/libs/testing)`

const TESTING_DESCRIPTION = `Jest-style describe, it, expect and jest on node:test · [docs](${DOCS}/testing/)`

/**
 * A README whose packages section carries the given summary.
 *
 * @param summary - The summary line, or null for none
 * @returns The README text
 */
function readme(summary: string | null): string {
  return [...HEAD, ...(summary === null ? [] : [summary]), '', ...TABLE, ...TAIL].join('\n')
}

/**
 * The rows of the first table in a README, cells trimmed.
 *
 * @param content - The README text
 * @returns Each row's cells
 */
function rows(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
    )
}

describe('registerPackageRow', () => {
  it('adds the row after the package the index places before it and counts the packages', () => {
    const updated = registerPackageRow(readme('<summary>All three packages</summary>'), TESTING, '@hyperfrontend/questions')
    expect({
      summary: updated.split(/\r?\n/)[9],
      packages: rows(updated)
        .slice(2)
        .map((cells) => cells[0]),
    }).toEqual({
      summary: '<summary>All four packages</summary>',
      packages: [
        `[@hyperfrontend/features](${BLOB}/libs/features)`,
        `[@hyperfrontend/questions](${BLOB}/libs/questions)`,
        TESTING_ROW,
        `[@hyperfrontend/json-utils](${BLOB}/libs/utils/json)`,
      ],
    })
  })

  it('pads every column to its widest cell', () => {
    const updated = registerPackageRow(readme(null), TESTING, null)
    const table = updated.split(/\r?\n/).filter((line) => line.startsWith('|'))
    const widest = (column: number): number => max(...rows(updated).map((cells) => (cells[column] as string).length))
    expect(table.map((line) => line.length)).toEqual(table.map(() => widest(0) + widest(1) + '|  |  |'.length))
  })

  it('draws the separator as dashes the width of each column', () => {
    const updated = registerPackageRow(readme(null), TESTING, null)
    const widest = (column: number): number => max(...rows(updated).map((cells) => (cells[column] as string).length))
    expect(rows(updated)[1]).toEqual(['-'.repeat(widest(0)), '-'.repeat(widest(1))])
  })

  it('appends the row when no predecessor is named', () => {
    expect(rows(registerPackageRow(readme(null), TESTING, null)).slice(-1)).toEqual([[TESTING_ROW, TESTING_DESCRIPTION]])
  })

  it('appends the row when the named predecessor is not in the table', () => {
    expect(rows(registerPackageRow(readme(null), TESTING, '@hyperfrontend/nowhere')).slice(-1)).toEqual([
      [TESTING_ROW, TESTING_DESCRIPTION],
    ])
  })

  it('changes nothing the second time', () => {
    const once = registerPackageRow(readme('<summary>All three packages</summary>'), TESTING, '@hyperfrontend/questions')
    expect(registerPackageRow(once, TESTING, '@hyperfrontend/questions')).toBe(once)
  })

  it('leaves a summary that does not count in words alone', () => {
    const updated = registerPackageRow(readme('<summary>All published packages</summary>'), TESTING, null)
    expect(updated.split(/\r?\n/)[9]).toBe('<summary>All published packages</summary>')
  })

  it('ignores a summary that sits after the table', () => {
    const later = [...HEAD, '', ...TABLE, '', '<summary>All three packages</summary>', ...TAIL].join('\n')
    expect(registerPackageRow(later, TESTING, null)).toContain('<summary>All three packages</summary>')
  })

  it('adds the row to a packages section that ends the file', () => {
    const ending = [...HEAD, '', ...TABLE].join('\n')
    expect(rows(registerPackageRow(ending, TESTING, null)).slice(-1)).toEqual([[TESTING_ROW, TESTING_DESCRIPTION]])
  })

  it('refuses a README without a packages section', () => {
    expect(() => registerPackageRow('# hyperfrontend\n', TESTING, null)).toThrow(
      'README.md has no "## Packages" section to list the package in'
    )
  })

  it('refuses a packages section without a table', () => {
    const tableless = [...HEAD, ...TAIL].join('\n')
    expect(() => registerPackageRow(tableless, TESTING, null)).toThrow(
      'README.md\'s "## Packages" section has no table to add the package to'
    )
  })

  it('does not take a table from a later section', () => {
    const later = [...HEAD, ...TAIL, '', ...TABLE].join('\n')
    expect(() => registerPackageRow(later, TESTING, null)).toThrow('README.md\'s "## Packages" section has no table to add the package to')
  })
})

describe('packageRow', () => {
  it('links the source and the documentation and drops the description trailing full stop', () => {
    expect(packageRow(TESTING)).toEqual([TESTING_ROW, TESTING_DESCRIPTION])
  })

  it('keeps a description that ends without a full stop', () => {
    expect(packageRow({ ...TESTING, description: 'No stop' })[1]).toBe(`No stop · [docs](${DOCS}/testing/)`)
  })
})

describe('hasPackageRow', () => {
  it('finds the project by its source link', () => {
    expect([hasPackageRow(readme(null), 'libs/questions'), hasPackageRow(readme(null), 'libs/testing')]).toEqual([true, false])
  })
})

describe('numberWord', () => {
  it('writes the counts below twenty, the tens and the counts between them in words', () => {
    expect([numberWord(0), numberWord(19), numberWord(20), numberWord(21), numberWord(99)]).toEqual([
      'zero',
      'nineteen',
      'twenty',
      'twenty-one',
      'ninety-nine',
    ])
  })

  it('keeps a count of a hundred or more in digits', () => {
    expect(numberWord(100)).toBe('100')
  })
})
