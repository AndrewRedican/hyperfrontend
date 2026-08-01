import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { join } from 'node:path'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateFeatureModule } from './generate-feature-module'

const config: ResolvedFeatureConfig = { name: 'clock', version: '1.0.0', contract: 'contracts/clock.contract.json', url: '/clock' }
const contract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }
const MODULE_PATH = 'src/hyperfrontend.feature.ts'

describe('generateFeatureModule', () => {
  it('creates the feature with the configured name and version', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("createFeature({ name: 'clock', version: '1.0.0', contract })")
  })

  it('canonicalizes the scaffolded version from the config spelling', () => {
    const tree = createTree(__dirname)
    generateFeatureModule({ ...config, version: 'v2.1.0' }, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("version: '2.1.0'")
  })

  it('scaffolds a typed on-handler stub per accepted action', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("feature.on('setTimezone', (_data: unknown) => {")
  })

  it('scaffolds a commented send example per emitted action', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("// feature.send('timeUpdated', undefined)")
  })

  it('imports a contract in a non-src sibling directory relative to the module directory', () => {
    const tree = createTree(__dirname)
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("import contract from '../contracts/clock.contract'")
  })

  it('re-relativizes a root-level contract path from the module directory', () => {
    const tree = createTree(__dirname)
    generateFeatureModule({ ...config, contract: './clock.contract.json' }, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("import contract from '../clock.contract'")
  })

  it('imports a contract inside src by a same-directory specifier', () => {
    const tree = createTree(__dirname)
    generateFeatureModule({ ...config, contract: 'src/contracts/clock.contract.json' }, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("import contract from './contracts/clock.contract'")
  })

  it('relativizes an absolute contract path against the tree root', () => {
    const tree = createTree(__dirname)
    generateFeatureModule({ ...config, contract: join(__dirname, 'clock.contract.ts') }, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("import contract from '../clock.contract'")
  })

  it('emits POSIX separators for backslashed contract paths', () => {
    const tree = createTree(__dirname)
    generateFeatureModule({ ...config, contract: 'contracts\\clock.contract.json' }, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toContain("import contract from '../contracts/clock.contract'")
  })

  it('never clobbers an existing module on re-run', () => {
    const tree = createTree(__dirname)
    tree.write(MODULE_PATH, 'custom author edits')
    generateFeatureModule(config, contract, tree)
    expect(tree.read(MODULE_PATH, 'utf-8')).toBe('custom author edits')
  })
})
