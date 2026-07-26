import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateMetadata } from './generate-metadata'
import { resolveSdkVersion } from './sdk-version'

const config: ResolvedFeatureConfig = { name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock' }
const contract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }

describe('generateMetadata', () => {
  it('stages metadata.json with the feature identity and embedded contract', () => {
    const tree = createTree(__dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ name: 'clock', version: '1.0.0', url: '/clock', contract })
    )
  })

  it('stamps the baked security protocol when the config carries one', () => {
    const tree = createTree(__dirname)
    generateMetadata({ ...config, protocol: 'v2' }, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ protocol: 'v2' }))
  })

  it('omits the protocol field when the config carries none', () => {
    const tree = createTree(__dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).not.toHaveProperty('protocol')
  })

  it('canonicalizes the stamped feature version', () => {
    const tree = createTree(__dirname)
    generateMetadata({ ...config, version: 'v1.2.3' }, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ version: '1.2.3' }))
  })

  it('stamps the running SDK version into the sdk field', () => {
    const tree = createTree(__dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ sdk: resolveSdkVersion(), generatedBy: '@hyperfrontend/features' })
    )
  })
})
