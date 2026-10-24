import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { writeConfigModules } from './__test-utils__/config-modules'
import { CONFIG_FILE, findConfigFile, loadConfig } from './load'

const FIXTURES = writeConfigModules()

const TREE = mkdtempSync(join(tmpdir(), 'lint-config-'))
mkdirSync(join(TREE, 'project', 'src', 'deep'), { recursive: true })
writeFileSync(join(TREE, CONFIG_FILE), 'export default []\n')
writeFileSync(join(TREE, 'project', CONFIG_FILE), 'export default []\n')

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
    rmSync(TREE, { recursive: true, force: true })
    rmSync(FIXTURES, { recursive: true, force: true })
    expect([findConfigFile(join(TREE, 'project')), existsSync(FIXTURES)]).toEqual([null, false])
  })
})
