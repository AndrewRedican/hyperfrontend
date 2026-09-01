import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { generateMetadata } from './generate-metadata'
import { resolveSdkVersion } from './sdk-version'

const config: ResolvedFeatureConfig = { name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock' }
const contract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }

describe('generateMetadata', () => {
  it('stages metadata.json with the feature identity and embedded contract', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ name: 'clock', version: '1.0.0', url: '/clock', contract })
    )
  })

  it('stamps every built-in mode when the config declares no display', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ modes: ['embedded', 'dialog', 'popup', 'standalone'] })
    )
  })

  it('passes the declared modes through in declaration order', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata({ ...config, display: { modes: ['popup', 'dialog'] } }, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ modes: ['popup', 'dialog'] }))
  })

  it('stamps the baked security protocol when the config carries one', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata({ ...config, protocol: 'v2' }, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ protocol: 'v2' }))
  })

  it('omits the protocol field when the config carries none', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).not.toHaveProperty('protocol')
  })

  it('stamps the declared permissions when the config carries them', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata({ ...config, permissions: ['camera', 'fullscreen'] }, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ permissions: ['camera', 'fullscreen'] }))
  })

  it('omits the permissions field when the config declares none', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).not.toHaveProperty('permissions')
  })

  it('canonicalizes the stamped feature version', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata({ ...config, version: 'v1.2.3' }, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(expect.objectContaining({ version: '1.2.3' }))
  })

  it('stamps the running SDK version into the sdk field', () => {
    const tree = createTree(import.meta.dirname)
    generateMetadata(config, contract, tree)
    expect(parse(tree.read('metadata.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ sdk: resolveSdkVersion(), generatedBy: '@hyperfrontend/features' })
    )
  })
})
