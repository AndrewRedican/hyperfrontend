import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from '../__test-utils__/workspace'
import { listFiles } from '../workspace'
import { hashesByPath, listFileRecords } from './files'

const root = createGraphWorkspace()

/**
 * Runs git in the fixture workspace.
 *
 * @param args - The arguments after `git`
 * @returns The trimmed output
 */
function git(args: readonly string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
}

describe('listFileRecords', () => {
  it('lists the same files as the plain listing, sorted by path', () => {
    expect(listFileRecords(root).map((record) => record.path)).toEqual([...listFiles(root)].sort())
  })

  it('hashes an untracked file as git would store it', () => {
    expect(hashesByPath(listFileRecords(root)).get('lint.config.ts')).toBe(git(['hash-object', 'lint.config.ts']))
  })

  it('reads the blob id of a clean tracked file from the index', () => {
    git(['add', '-A'])
    git(['commit', '-q', '-m', 'base'])
    expect(hashesByPath(listFileRecords(root)).get('libs/b/src/index.ts')).toBe(git(['rev-parse', 'HEAD:libs/b/src/index.ts']))
  })

  it('hashes a dirty tracked file from the working tree', () => {
    writeFileSync(join(root, 'libs/b/src/index.ts'), 'export const b = 3\n')
    expect(hashesByPath(listFileRecords(root)).get('libs/b/src/index.ts')).toBe(git(['hash-object', 'libs/b/src/index.ts']))
  })

  it('leaves out a tracked file the working tree has deleted', () => {
    rmSync(join(root, 'libs/d/src/index.ts'))
    expect(hashesByPath(listFileRecords(root)).has('libs/d/src/index.ts')).toBe(false)
  })

  it('leaves out what .nxignore names', () => {
    expect(hashesByPath(listFileRecords(root)).has('ignored/package.json')).toBe(false)
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
