import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateFeatureModule } from './generate-feature-module'

const config: ResolvedFeatureConfig = { name: 'clock', version: '1.0.0', contract: 'contracts/clock.contract.json', url: '/clock' }
const contract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }
const MODULE_PATH = 'src/hyperfrontend.feature.ts'

describe('generateFeatureModule', () => {
  it('creates the feature with the configured name', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("createFeature({ name: 'clock', contract })")
  })

  it('scaffolds an on-handler stub per accepted action', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("feature.on('setTimezone', (data) => {")
  })

  it('scaffolds a commented send example per emitted action', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("// feature.send('timeUpdated', undefined)")
  })

  it('imports the contract by its extensionless relative path', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("import contract from './contracts/clock.contract'")
  })

  it('leaves an already-relative contract path untouched', () => {
    const tree = createTree(__dirname)
    generateFeatureModule({ ...config, contract: './clock.contract.json' }, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("import contract from './clock.contract'")
  })

  it('never clobbers an existing module on re-run', () => {
    const tree = createTree(__dirname)
    tree.write(MODULE_PATH, 'custom author edits')
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toBe('custom author edits')
  })
})
