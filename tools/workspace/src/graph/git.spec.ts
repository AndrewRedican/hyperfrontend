import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { gitEnvironment } from './git'
import { hashesByPath, listFileRecords } from './store/files'
import { listFiles } from './workspace'

const checkout = createGraphWorkspace()
const snapshot = createTempDir({
  prefix: 'hf-snapshot-',
  tree: { '.gitignore': 'dist\n', 'package.json': '{ "name": "snapshot" }', 'src/index.ts': 'export {}\n', 'dist/index.js': 'export {}\n' },
}).path

describe('gitEnvironment', () => {
  it('leaves a checkout to its own repository', () => {
    expect(gitEnvironment(checkout)).toBe(undefined)
  })

  it('answers the same environment for the same tree', () => {
    expect(gitEnvironment(snapshot)).toBe(gitEnvironment(snapshot))
  })
})

describe('a tree without a repository', () => {
  it('lists its files, less the ignored', () => {
    expect([...listFiles(snapshot)].sort()).toEqual(['.gitignore', 'package.json', 'src/index.ts'])
  })

  it('hashes its files as git would store them', () => {
    const blob = execFileSync('git', ['hash-object', 'src/index.ts'], { cwd: snapshot, encoding: 'utf8' }).trim()
    expect(hashesByPath(listFileRecords(snapshot)).get('src/index.ts')).toBe(blob)
  })
})

describe('the disposable trees', () => {
  it('are removed at the end', () => {
    for (const root of [checkout, snapshot]) rmSync(root, { recursive: true, force: true })
    expect(existsSync(checkout) || existsSync(snapshot)).toBe(false)
  })
})
