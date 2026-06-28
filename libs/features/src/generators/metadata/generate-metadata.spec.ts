import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateMetadata } from './generate-metadata'

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
})
