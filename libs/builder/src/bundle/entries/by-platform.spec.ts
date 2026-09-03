import type { EntryPoint, EntryPointDiscovery } from '../../models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getEntriesByPlatform, getSharedEntries } from './by-platform'

const entry = (exportPath: string, platform?: 'browser' | 'node'): EntryPoint => ({
  exportPath,
  srcPath: exportPath.replace(/^\.\/?/, ''),
  inputFile: `/abs/src/${exportPath}/index.ts`,
  isRoot: exportPath === '.',
  platform,
})

const DISCOVERY: EntryPointDiscovery = {
  category: 'complex',
  hasRootEntry: true,
  entryPoints: [entry('.'), entry('./browser', 'browser'), entry('./node', 'node'), entry('./shared')],
  platformEntries: [entry('./browser', 'browser'), entry('./node', 'node')],
  featureEntries: [entry('./shared')],
}

describe('getEntriesByPlatform', () => {
  it('returns only entries flagged with the requested platform', () => {
    expect(getEntriesByPlatform(DISCOVERY, 'browser')).toEqual([expect.objectContaining({ exportPath: './browser', platform: 'browser' })])
  })
})

describe('getSharedEntries', () => {
  it('returns entries that have no platform hint', () => {
    expect(getSharedEntries(DISCOVERY)).toEqual([
      expect.objectContaining({ exportPath: '.' }),
      expect.objectContaining({ exportPath: './shared' }),
    ])
  })
})
