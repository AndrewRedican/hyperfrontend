import { existsSync, rmSync } from 'node:fs'
import { join, posix } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { writeConfigModules } from './__test-utils__/config-modules'
import { CONFIG_FILE, findConfigFile, loadConfig } from './load'

const FIXTURES = writeConfigModules()

const DIR = createTempDir({
  prefix: 'lint-config-',
  tree: { [CONFIG_FILE]: 'export default []\n', [posix.join('project', CONFIG_FILE)]: 'export default []\n' },
})
const TREE = DIR.path
DIR.mkdir('project/src/deep')

describe('findConfigFile', () => {
  it('finds the file in the directory itself', () => {
    expect(findConfigFile(join(TREE, 'project'))).toBe(join(TREE, 'project', CONFIG_FILE))
  })

  it('finds the nearest file above the directory', () => {
    expect(findConfigFile(join(TREE, 'project', 'src', 'deep'))).toBe(join(TREE, 'project', CONFIG_FILE))
  })

  it('answers null when no directory up to the filesystem root has one', () => {
    expect(findConfigFile('/')).toBeNull()
  })
})

describe('loadConfig', () => {
  it('returns the blocks a configuration module exports', async () => {
    expect(await loadConfig(join(FIXTURES, 'workspace.ts'))).toEqual([{ files: ['**/*.json'], rules: { 'test/no-main': 'error' } }])
  })

  it('rejects a module that exports no list', async () => {
    await expect(loadConfig(join(FIXTURES, 'not-a-config.ts'))).rejects.toThrow('does not export a list of configuration blocks')
  })

  it('rejects a module that exports null', async () => {
    await expect(loadConfig(join(FIXTURES, 'null-config.ts'))).rejects.toThrow('does not export a list of configuration blocks')
  })

  it('rejects a list holding something other than blocks', async () => {
    await expect(loadConfig(join(FIXTURES, 'not-blocks.ts'))).rejects.toThrow('does not export a list of configuration blocks')
  })

  it('rejects a module that cannot be loaded', async () => {
    await expect(loadConfig(join(FIXTURES, 'missing.ts'))).rejects.toThrow('Cannot load the configuration')
  })

  it('leaves no temporary tree behind', () => {
    DIR.remove()
    rmSync(FIXTURES, { recursive: true, force: true })
    expect([findConfigFile(join(TREE, 'project')), existsSync(FIXTURES)]).toEqual([null, false])
  })
})
