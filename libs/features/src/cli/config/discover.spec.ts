import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverConfigFile, FEATURE_CONFIG_BASENAME } from './discover'

describe('discoverConfigFile', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-discover-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('prefers the JSON config over a JS sibling', () => {
    writeFileSync(join(dir, `${FEATURE_CONFIG_BASENAME}.js`), 'export default {}')
    writeFileSync(join(dir, `${FEATURE_CONFIG_BASENAME}.json`), '{}')
    expect(discoverConfigFile(dir, FEATURE_CONFIG_BASENAME)).toBe(join(dir, `${FEATURE_CONFIG_BASENAME}.json`))
  })

  it('returns null when no config file exists', () => {
    expect(discoverConfigFile(dir, FEATURE_CONFIG_BASENAME)).toBeNull()
  })
})
