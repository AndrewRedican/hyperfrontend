import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { createTree } from '@hyperfrontend/project-scope/vfs'
import { generateContractTypes } from './generate-types'

const contract: FeatureContract = { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }
const jsonConfig: ResolvedFeatureConfig = { name: 'clock', version: '1.0.0', contract: 'contracts/clock.contract.json', url: '/clock' }

describe('generateContractTypes', () => {
  it('stages a sibling .d.ts beside a JSON contract', () => {
    const tree = createTree(__dirname)
    generateContractTypes(jsonConfig, contract, tree)
    expect(tree.exists('contracts/clock.contract.d.ts')).toBe(true)
  })

  it('preserves the literal action type union the JSON import would widen', () => {
    const tree = createTree(__dirname)
    generateContractTypes(jsonConfig, contract, tree)
    expect(tree.read('contracts/clock.contract.d.ts', 'utf-8')).toContain('readonly "type": "setTimezone"')
  })

  const edgeContract: FeatureContract = {
    emitted: [],
    accepted: [{ type: 'setTimezone', schema: { properties: {}, examples: [], default: null } }],
  }

  it('renders a null schema value as the null literal type', () => {
    const tree = createTree(__dirname)
    generateContractTypes(jsonConfig, edgeContract, tree)
    expect(tree.read('contracts/clock.contract.d.ts', 'utf-8')).toContain('readonly "default": null')
  })

  it('renders an empty array schema value as a readonly empty tuple', () => {
    const tree = createTree(__dirname)
    generateContractTypes(jsonConfig, edgeContract, tree)
    expect(tree.read('contracts/clock.contract.d.ts', 'utf-8')).toContain('readonly "examples": readonly []')
  })

  it('renders an empty object schema value as Record<string, never>', () => {
    const tree = createTree(__dirname)
    generateContractTypes(jsonConfig, edgeContract, tree)
    expect(tree.read('contracts/clock.contract.d.ts', 'utf-8')).toContain('readonly "properties": Record<string, never>')
  })

  it('skips .ts as const contracts that derive types via typeof', () => {
    const tree = createTree(__dirname)
    generateContractTypes({ ...jsonConfig, contract: 'contracts/clock.contract.ts' }, contract, tree)
    expect(tree.listChanges()).toEqual([])
  })
})
