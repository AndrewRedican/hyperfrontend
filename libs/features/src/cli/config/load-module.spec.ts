import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { loadModuleFile } from './load-module'

describe('loadModuleFile', () => {
  const tmp = useTempDir({ prefix: 'hf-load-' })

  it('parses a JSON config', async () => {
    tmp.write('feature.config.json', '{ "name": "clock" }')
    await expect(loadModuleFile(tmp.resolve('feature.config.json'))).resolves.toEqual({ name: 'clock' })
  })

  it('returns the module.exports of a .cjs config', async () => {
    tmp.write('feature.config.cjs', 'module.exports = { name: "cjs" }')
    await expect(loadModuleFile(tmp.resolve('feature.config.cjs'))).resolves.toEqual({ name: 'cjs' })
  })

  it('throws on an unsupported extension', async () => {
    await expect(loadModuleFile(tmp.resolve('feature.config.txt'))).rejects.toThrow('Unsupported config extension')
  })

  it('wraps an import failure with a Node-version hint', async () => {
    await expect(loadModuleFile(tmp.resolve('missing.js'))).rejects.toThrow('Failed to load config')
  })
})
