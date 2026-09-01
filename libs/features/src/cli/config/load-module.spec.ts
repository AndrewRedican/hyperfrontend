import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { loadModuleFile } from './load-module'

describe('loadModuleFile', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-load-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('parses a JSON config', async () => {
    writeFileSync(join(dir, 'feature.config.json'), '{ "name": "clock" }')
    await expect(loadModuleFile(join(dir, 'feature.config.json'))).resolves.toEqual({ name: 'clock' })
  })

  it('returns the module.exports of a .cjs config', async () => {
    writeFileSync(join(dir, 'feature.config.cjs'), 'module.exports = { name: "cjs" }')
    await expect(loadModuleFile(join(dir, 'feature.config.cjs'))).resolves.toEqual({ name: 'cjs' })
  })

  it('throws on an unsupported extension', async () => {
    await expect(loadModuleFile(join(dir, 'feature.config.txt'))).rejects.toThrow('Unsupported config extension')
  })

  it('wraps an import failure with a Node-version hint', async () => {
    await expect(loadModuleFile(join(dir, 'missing.js'))).rejects.toThrow('Failed to load config')
  })
})
