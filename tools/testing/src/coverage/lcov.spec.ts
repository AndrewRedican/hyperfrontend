import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileTotals, mergeLcov, overallTotals, percentOf, uncoveredRanges } from './lcov'

/**
 * Writes an lcov report to a throwaway file.
 *
 * @param body - The report's records.
 * @returns The path written.
 */
function writeReport(body: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'hf-lcov-')), 'lcov.info')
  writeFileSync(path, body)
  return path
}

/**
 * Reads a report and returns the one file it describes.
 *
 * @param body - The report's records.
 * @returns The merged file.
 */
function onlyFile(body: string) {
  const files = [...mergeLcov([writeReport(body)]).values()]
  const file = files[0]
  if (!file) throw new Error('the fixture must describe a file')
  return file
}

describe('mergeLcov', () => {
  it('reads a line count', () => {
    assert.deepEqual([...onlyFile('SF:src/a.ts\nDA:1,4\nend_of_record\n').lines], [[1, 4]])
  })

  it('sums the counts two records give the same line', () => {
    assert.deepEqual([...onlyFile('SF:src/a.ts\nDA:1,4\nend_of_record\nSF:src/a.ts\nDA:1,3\nend_of_record\n').lines], [[1, 7]])
  })

  it('credits a line one record missed and another ran', () => {
    const file = onlyFile('SF:src/a.ts\nDA:7,0\nend_of_record\nSF:src/a.ts\nDA:7,2\nend_of_record\n')
    assert.deepEqual(fileTotals(file).lines, { found: 1, hit: 1 })
  })

  it('keeps one entry per file however many records name it', () => {
    assert.equal(mergeLcov([writeReport('SF:src/a.ts\nDA:1,1\nend_of_record\nSF:src/a.ts\nDA:1,1\nend_of_record\n')]).size, 1)
  })

  it('counts a declared function that never ran', () => {
    assert.deepEqual(fileTotals(onlyFile('SF:src/a.ts\nFN:3,run\nFNDA:0,run\nDA:3,0\nend_of_record\n')).functions, { found: 1, hit: 0 })
  })

  it('credits a function one evaluation ran', () => {
    const body = 'SF:src/a.ts\nFN:3,run\nFNDA:0,run\nDA:3,0\nend_of_record\nSF:src/a.ts\nFN:3,run\nFNDA:2,run\nDA:3,1\nend_of_record\n'
    assert.deepEqual(fileTotals(onlyFile(body)).functions, { found: 1, hit: 1 })
  })

  it('counts two functions declared under the same name separately', () => {
    const totals = fileTotals(onlyFile('SF:src/a.ts\nFN:3,\nFN:9,\nFNDA:1,\nFNDA:0,\nDA:3,1\nDA:9,0\nend_of_record\n')).functions
    assert.deepEqual(totals, { found: 2, hit: 1 })
  })

  it('credits a branch one evaluation took', () => {
    const body = 'SF:src/a.ts\nDA:4,1\nBRDA:4,0,0,-\nend_of_record\nSF:src/a.ts\nDA:4,1\nBRDA:4,0,0,3\nend_of_record\n'
    assert.deepEqual(fileTotals(onlyFile(body)).branches, { found: 1, hit: 1 })
  })

  it('reads a branch no evaluation took as untaken', () => {
    assert.deepEqual(fileTotals(onlyFile('SF:src/a.ts\nDA:4,1\nBRDA:4,0,0,-\nend_of_record\n')).branches, { found: 1, hit: 0 })
  })

  it('drops a branch sitting on a line a coverage pragma ignored', () => {
    assert.deepEqual(fileTotals(onlyFile('SF:src/a.ts\nDA:1,1\nBRDA:1,0,0,2\nBRDA:3,1,0,0\nend_of_record\n')).branches, { found: 1, hit: 1 })
  })

  it('drops a function declared on a line a coverage pragma ignored', () => {
    assert.deepEqual(fileTotals(onlyFile('SF:src/a.ts\nFN:1,run\nFN:3,skipped\nFNDA:1,run\nFNDA:0,skipped\nDA:1,1\nend_of_record\n')).functions, {
      found: 1,
      hit: 1,
    })
  })

  it('merges reports from separate environments', () => {
    const reports = [writeReport('SF:src/a.ts\nDA:1,1\nend_of_record\n'), writeReport('SF:src/b.ts\nDA:1,1\nend_of_record\n')]
    assert.deepEqual([...mergeLcov(reports).keys()], ['src/a.ts', 'src/b.ts'])
  })

  it('ignores a report holding no records', () => {
    assert.equal(mergeLcov([writeReport('TN:\n')]).size, 0)
  })
})

describe('overallTotals', () => {
  it('adds every file counters together', () => {
    const files = mergeLcov([writeReport('SF:src/a.ts\nDA:1,1\nDA:2,0\nend_of_record\nSF:src/b.ts\nDA:1,1\nend_of_record\n')])
    assert.deepEqual(overallTotals(files.values()).lines, { found: 3, hit: 2 })
  })
})

describe('percentOf', () => {
  it('reports the share executed', () => {
    assert.equal(percentOf({ found: 4, hit: 3 }), 75)
  })

  it('reports a file with nothing to measure as complete', () => {
    assert.equal(percentOf({ found: 0, hit: 0 }), 100)
  })
})

describe('uncoveredRanges', () => {
  it('lists a single missed line on its own', () => {
    assert.deepEqual(uncoveredRanges(onlyFile('SF:src/a.ts\nDA:1,1\nDA:5,0\nend_of_record\n')), ['5'])
  })

  it('collapses consecutive missed lines into a range', () => {
    assert.deepEqual(uncoveredRanges(onlyFile('SF:src/a.ts\nDA:5,0\nDA:6,0\nDA:7,0\nend_of_record\n')), ['5-7'])
  })

  it('separates runs that are not adjacent', () => {
    assert.deepEqual(uncoveredRanges(onlyFile('SF:src/a.ts\nDA:5,0\nDA:6,0\nDA:9,0\nend_of_record\n')), ['5-6', '9'])
  })

  it('reports nothing when every line ran', () => {
    assert.deepEqual(uncoveredRanges(onlyFile('SF:src/a.ts\nDA:1,1\nend_of_record\n')), [])
  })
})
