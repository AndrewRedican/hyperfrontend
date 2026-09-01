import type { FileCoverage } from './lcov'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findThresholdShortfalls, renderCoverageTable } from './gate'

/**
 * Builds a file whose counters match the given hit and found pairs.
 *
 * @param path - What to name the file in the table.
 * @param lines - Execution count per line number.
 * @param branches - Times taken per branch.
 * @param functions - Execution count per function.
 * @returns The file's counters.
 */
function file(path: string, lines: number[], branches: number[] = [1], functions: number[] = [1]): FileCoverage {
  return {
    path,
    lines: new Map(lines.map((count, at) => [at + 1, count])),
    branches: new Map(branches.map((count, at) => [`${at},0,0`, count])),
    functions: new Map(functions.map((count, at) => [`${at},run`, count])),
  }
}

describe('findThresholdShortfalls', () => {
  it('reports nothing when no threshold is declared', () => {
    assert.deepEqual(findThresholdShortfalls([file('src/a.ts', [0, 0])], undefined), [])
  })

  it('reports nothing when every threshold is met', () => {
    assert.deepEqual(findThresholdShortfalls([file('src/a.ts', [1, 1])], { lines: 100, branches: 100, functions: 100 }), [])
  })

  it('accepts coverage that lands exactly on the threshold', () => {
    assert.deepEqual(findThresholdShortfalls([file('src/a.ts', [1, 0])], { lines: 50 }), [])
  })

  it('names the line shortfall', () => {
    assert.deepEqual(findThresholdShortfalls([file('src/a.ts', [1, 0])], { lines: 98 }), [
      '50.00% line coverage does not meet threshold of 98%',
    ])
  })

  it('names the branch shortfall', () => {
    assert.deepEqual(findThresholdShortfalls([file('src/a.ts', [1], [1, 0])], { branches: 90 }), [
      '50.00% branch coverage does not meet threshold of 90%',
    ])
  })

  it('names the function shortfall', () => {
    assert.deepEqual(findThresholdShortfalls([file('src/a.ts', [1], [1], [1, 0])], { functions: 90 }), [
      '50.00% function coverage does not meet threshold of 90%',
    ])
  })

  it('judges the project as a whole rather than file by file', () => {
    assert.deepEqual(findThresholdShortfalls([file('src/a.ts', [1, 1, 1]), file('src/b.ts', [0])], { lines: 70 }), [])
  })
})

describe('renderCoverageTable', () => {
  it('heads the table with the metric names', () => {
    assert.equal(renderCoverageTable([file('src/a.ts', [1])])[0]?.includes('line %'), true)
  })

  it('renders a row per file', () => {
    const table = renderCoverageTable([file('src/a.ts', [1]), file('src/b.ts', [1])])
    assert.equal(table.filter((row) => row.startsWith('src/')).length, 2)
  })

  it('sorts the rows by path', () => {
    const table = renderCoverageTable([file('src/z.ts', [1]), file('src/a.ts', [1])])
    assert.equal(table.findIndex((row) => row.startsWith('src/a.ts')) < table.findIndex((row) => row.startsWith('src/z.ts')), true)
  })

  it('reports each file percentage', () => {
    assert.equal(renderCoverageTable([file('src/a.ts', [1, 0])]).some((row) => row.includes('50.00')), true)
  })

  it('names the lines a file never ran', () => {
    assert.equal(renderCoverageTable([file('src/a.ts', [1, 0, 0])]).some((row) => row.endsWith('2-3')), true)
  })

  it('closes with the totals across every file', () => {
    assert.equal(renderCoverageTable([file('src/a.ts', [1])]).some((row) => row.startsWith('all files')), true)
  })
})
