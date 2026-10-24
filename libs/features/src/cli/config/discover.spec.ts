import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { discoverConfigFile, FEATURE_CONFIG_BASENAME } from './discover'

describe('discoverConfigFile', () => {
  const tmp = useTempDir({ prefix: 'hf-discover-' })

  it('prefers the JSON config over a JS sibling', () => {
    tmp.write(`${FEATURE_CONFIG_BASENAME}.js`, 'export default {}')
    tmp.write(`${FEATURE_CONFIG_BASENAME}.json`, '{}')
    expect(discoverConfigFile(tmp.path, FEATURE_CONFIG_BASENAME)).toBe(tmp.resolve(`${FEATURE_CONFIG_BASENAME}.json`))
  })

  it('returns null when no config file exists', () => {
    expect(discoverConfigFile(tmp.path, FEATURE_CONFIG_BASENAME)).toBeNull()
  })
})
