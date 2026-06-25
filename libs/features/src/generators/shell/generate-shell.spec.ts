import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateShell } from './generate-shell'

const config: ResolvedFeatureConfig = {
  name: 'clock',
  version: '1.0.0',
  contract: './clock.contract.json',
  url: '/clock',
  display: { dialogWidth: 530 },
}
const contract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }

describe('generateShell', () => {
  it('stages an entry that wraps createShell from the host SDK', () => {
    const tree = createTree(__dirname)
    generateShell(config, contract, tree)
    expect(tree.read('src/index.ts', 'utf-8')).toContain("import { createShell } from '@hyperfrontend/features/host'")
  })

  it('inlines the contract action types into the entry', () => {
    const tree = createTree(__dirname)
    generateShell(config, contract, tree)
    expect(tree.read('src/index.ts', 'utf-8')).toContain("type: 'timeUpdated'")
  })

  it('bakes the resolved display defaults into the entry', () => {
    const tree = createTree(__dirname)
    generateShell(config, contract, tree)
    expect(tree.read('src/index.ts', 'utf-8')).toContain('dialogWidth: 530')
  })

  it('bakes only the url when no display defaults are configured', () => {
    const tree = createTree(__dirname)
    generateShell({ ...config, display: undefined }, contract, tree)
    expect(tree.read('src/index.ts', 'utf-8')).toContain("url: '/clock'")
  })

  it('names the connector package after the feature with module type', () => {
    const tree = createTree(__dirname)
    generateShell(config, contract, tree)
    expect(parse(tree.read('package.json', 'utf-8') ?? '')).toEqual(
      expect.objectContaining({ name: 'clock-shell', version: '1.0.0', type: 'module' })
    )
  })

  it('declares no dependencies in the connector package', () => {
    const tree = createTree(__dirname)
    generateShell(config, contract, tree)
    expect(parse(tree.read('package.json', 'utf-8') ?? '')).not.toHaveProperty('dependencies')
  })

  it('stages a README headed with the connector name', () => {
    const tree = createTree(__dirname)
    generateShell(config, contract, tree)
    expect(tree.read('README.md', 'utf-8')).toContain('# clock-shell')
  })

  it('delegates metadata staging so the connector includes metadata.json', () => {
    const tree = createTree(__dirname)
    generateShell(config, contract, tree)
    expect(tree.exists('metadata.json')).toBe(true)
  })
})
