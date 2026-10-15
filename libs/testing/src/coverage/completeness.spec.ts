import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { findUnmeasuredFiles } from './completeness'
import { mergeLcov } from './lcov'

/**
 * Builds a throwaway project tree with the given source files and lcov reports.
 *
 * @param sources - Project-relative source paths to create.
 * @param reports - Report file name mapped to the source paths it accounts for.
 * @returns The project root and the absolute paths of the written reports.
 */
function createProject(sources: string[], reports: Record<string, string[]>): { root: string; lcovPaths: string[] } {
  const root = mkdtempSync(join(tmpdir(), 'hf-completeness-'))

  for (const source of sources) {
    mkdirSync(join(root, source, '..'), { recursive: true })
    writeFileSync(join(root, source), 'export const value = 1\n')
  }

  const lcovPaths = Object.entries(reports).map(([name, covered]) => {
    const body = covered.map((path) => `SF:${path}\nDA:1,1\nend_of_record`).join('\n')
    const lcovPath = join(root, name)
    writeFileSync(lcovPath, `TN:\n${body}\n`)
    return lcovPath
  })

  return { root, lcovPaths }
}

describe('findUnmeasuredFiles', () => {
  it('reports nothing when every included file was measured', () => {
    const { root, lcovPaths } = createProject(['src/a.ts', 'src/b.ts'], { 'lcov.info': ['src/a.ts', 'src/b.ts'] })
    assert.deepEqual(findUnmeasuredFiles([...mergeLcov(lcovPaths).values()], root, ['src/**/*.ts'], []).missing, [])
  })

  it('reports a source file no test ever loaded', () => {
    const { root, lcovPaths } = createProject(['src/a.ts', 'src/orphan.ts'], { 'lcov.info': ['src/a.ts'] })
    assert.deepEqual(findUnmeasuredFiles([...mergeLcov(lcovPaths).values()], root, ['src/**/*.ts'], []).missing, ['src/orphan.ts'])
  })

  it('honours the exclude globs', () => {
    const { root, lcovPaths } = createProject(['src/a.ts', 'src/a.spec.ts'], { 'lcov.info': ['src/a.ts'] })
    assert.deepEqual(findUnmeasuredFiles([...mergeLcov(lcovPaths).values()], root, ['src/**/*.ts'], ['**/*.spec.ts']).missing, [])
  })

  it('unions the reports so a file measured by one environment counts', () => {
    const { root, lcovPaths } = createProject(['src/a.ts', 'src/b.ts'], {
      'lcov.node.info': ['src/a.ts'],
      'lcov.browser.info': ['src/b.ts'],
    })
    assert.deepEqual(findUnmeasuredFiles([...mergeLcov(lcovPaths).values()], root, ['src/**/*.ts'], []).missing, [])
  })

  it('counts the files the reports accounted for', () => {
    const { root, lcovPaths } = createProject(['src/a.ts', 'src/b.ts'], { 'lcov.info': ['src/a.ts', 'src/b.ts'] })
    assert.equal(findUnmeasuredFiles([...mergeLcov(lcovPaths).values()], root, ['src/**/*.ts'], []).covered, 2)
  })

  it('sorts the missing files so the report is stable', () => {
    const { root, lcovPaths } = createProject(['src/z.ts', 'src/a.ts'], { 'lcov.info': [] })
    assert.deepEqual(findUnmeasuredFiles([...mergeLcov(lcovPaths).values()], root, ['src/**/*.ts'], []).missing, ['src/a.ts', 'src/z.ts'])
  })
})
