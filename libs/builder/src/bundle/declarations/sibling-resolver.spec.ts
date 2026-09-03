import type { Plugin } from 'rollup'
import type { SiblingEntry } from './sibling-resolver'
import { describe, expect, it } from '@hyperfrontend/testing'
import { computeSiblingSpecifier, createSiblingExternalizePlugin, dtsPathFor, filterSiblings, findOwningSibling } from './sibling-resolver'

type ResolveIdHook = (source: string, importer?: string) => { id: string; external: true } | null

const callResolveId = (plugin: Plugin, source: string, importer?: string): { id: string; external: true } | null => {
  const hook = plugin.resolveId as unknown as ResolveIdHook
  return hook.call({} as ThisParameterType<ResolveIdHook>, source, importer)
}

const SIBLINGS: SiblingEntry[] = [
  { srcPath: '', indexDtsPath: '/abs/dist/libs/foo/index.d.ts' },
  { srcPath: 'models', indexDtsPath: '/abs/dist/libs/foo/models/index.d.ts' },
  { srcPath: 'bundle', indexDtsPath: '/abs/dist/libs/foo/bundle/index.d.ts' },
  { srcPath: 'bundle/declarations', indexDtsPath: '/abs/dist/libs/foo/bundle/declarations/index.d.ts' },
]

describe('findOwningSibling', () => {
  it('matches the exact index.d.ts path', () => {
    expect(findOwningSibling('/abs/dist/libs/foo/models/index.d.ts', SIBLINGS)).toEqual(SIBLINGS[1])
  })

  it('matches a file inside the sibling directory tree', () => {
    expect(findOwningSibling('/abs/dist/libs/foo/models/build-config.d.ts', SIBLINGS)).toEqual(SIBLINGS[1])
  })

  it('prefers the longest matching directory when multiple siblings share a prefix', () => {
    expect(findOwningSibling('/abs/dist/libs/foo/bundle/declarations/dts-per-entry.d.ts', SIBLINGS)).toEqual(SIBLINGS[3])
  })

  it('returns undefined when no sibling owns the path', () => {
    expect(findOwningSibling('/abs/dist/libs/other/file.d.ts', SIBLINGS)).toBeUndefined()
  })
})

describe('computeSiblingSpecifier', () => {
  it('emits ../<src> for sibling at the same depth', () => {
    expect(computeSiblingSpecifier('/abs/dist/libs/foo/bundle/index.d.ts', SIBLINGS[1])).toBe('../models')
  })

  it('emits ../../<src> for a sibling above the current directory', () => {
    expect(computeSiblingSpecifier('/abs/dist/libs/foo/bundle/declarations/index.d.ts', SIBLINGS[1])).toBe('../../models')
  })

  it('emits ./<src> for a sibling nested below current directory', () => {
    expect(
      computeSiblingSpecifier('/abs/dist/libs/foo/bundle/index.d.ts', {
        srcPath: 'bundle/declarations',
        indexDtsPath: '/abs/dist/libs/foo/bundle/declarations/index.d.ts',
      })
    ).toBe('./declarations')
  })

  it('emits .. when the sibling is the parent root', () => {
    expect(
      computeSiblingSpecifier('/abs/dist/libs/foo/models/index.d.ts', {
        srcPath: '',
        indexDtsPath: '/abs/dist/libs/foo/index.d.ts',
      })
    ).toBe('..')
  })
})

describe('createSiblingExternalizePlugin', () => {
  const baseInput = {
    selfSrcPath: 'bundle',
    selfDtsPath: '/abs/dist/libs/foo/bundle/index.d.ts',
    siblings: [
      { srcPath: 'models', indexDtsPath: '/abs/dist/libs/foo/models/index.d.ts' },
      { srcPath: 'package', indexDtsPath: '/abs/dist/libs/foo/package/index.d.ts' },
    ],
  }

  it('externalizes a sibling import expressed as a relative specifier', () => {
    const plugin = createSiblingExternalizePlugin(baseInput)
    expect(callResolveId(plugin, '../models', '/abs/dist/libs/foo/bundle/index.d.ts')).toEqual({
      id: '../models',
      external: true,
    })
  })

  it('externalizes a sibling import expressed as an absolute path', () => {
    const plugin = createSiblingExternalizePlugin(baseInput)
    expect(callResolveId(plugin, '/abs/dist/libs/foo/models/index.d.ts')).toEqual({
      id: '../models',
      external: true,
    })
  })

  it('externalizes references to a sibling sub-file (e.g. models/build-config)', () => {
    const plugin = createSiblingExternalizePlugin(baseInput)
    expect(callResolveId(plugin, '../models/build-config', '/abs/dist/libs/foo/bundle/index.d.ts')).toEqual({
      id: '../models',
      external: true,
    })
  })

  it('returns null for self-imports so they stay inlined', () => {
    const plugin = createSiblingExternalizePlugin(baseInput)
    expect(callResolveId(plugin, './sub-helper', '/abs/dist/libs/foo/bundle/index.d.ts')).toBeNull()
  })

  it('returns null for paths that do not resolve into any sibling', () => {
    const plugin = createSiblingExternalizePlugin(baseInput)
    expect(callResolveId(plugin, 'rollup', '/abs/dist/libs/foo/bundle/index.d.ts')).toBeNull()
  })

  it('returns null when the resolved path equals the current entry', () => {
    const plugin = createSiblingExternalizePlugin(baseInput)
    expect(callResolveId(plugin, '/abs/dist/libs/foo/bundle/index.d.ts')).toBeNull()
  })

  it('returns null when there are no siblings', () => {
    const plugin = createSiblingExternalizePlugin({ ...baseInput, siblings: [] })
    expect(callResolveId(plugin, '../models', '/abs/dist/libs/foo/bundle/index.d.ts')).toBeNull()
  })

  it('returns null when the path resolves into the current entry, even if a sibling directory prefix-matches it', () => {
    const plugin = createSiblingExternalizePlugin({
      selfSrcPath: 'bin',
      selfDtsPath: '/abs/dist/libs/foo/bin/index.d.ts',
      siblings: [
        { srcPath: '', indexDtsPath: '/abs/dist/libs/foo/index.d.ts' },
        { srcPath: 'bin/native', indexDtsPath: '/abs/dist/libs/foo/bin/native/index.d.ts' },
      ],
    })
    expect(callResolveId(plugin, '/abs/dist/libs/foo/bin/index.d.ts')).toBeNull()
  })

  it('returns null for paths inside the current entry directory even when root sibling prefix-matches', () => {
    const plugin = createSiblingExternalizePlugin({
      selfSrcPath: 'bin',
      selfDtsPath: '/abs/dist/libs/foo/bin/index.d.ts',
      siblings: [{ srcPath: '', indexDtsPath: '/abs/dist/libs/foo/index.d.ts' }],
    })
    expect(callResolveId(plugin, '/abs/dist/libs/foo/bin/script.d.ts')).toBeNull()
  })

  it('falls back to the importer-relative resolution when no importer is supplied', () => {
    const plugin = createSiblingExternalizePlugin(baseInput)
    expect(callResolveId(plugin, '../models')).toEqual({ id: '../models', external: true })
  })

  it('handles nested-entry pairings (longest-prefix wins)', () => {
    const plugin = createSiblingExternalizePlugin({
      selfSrcPath: 'bundle',
      selfDtsPath: '/abs/dist/libs/foo/bundle/index.d.ts',
      siblings: [
        { srcPath: 'bundle/declarations', indexDtsPath: '/abs/dist/libs/foo/bundle/declarations/index.d.ts' },
        { srcPath: 'models', indexDtsPath: '/abs/dist/libs/foo/models/index.d.ts' },
      ],
    })
    expect(callResolveId(plugin, './declarations/dts-per-entry', '/abs/dist/libs/foo/bundle/index.d.ts')).toEqual({
      id: './declarations',
      external: true,
    })
  })
})

describe('filterSiblings', () => {
  it('removes the entry whose srcPath matches the supplied one', () => {
    const all = [{ srcPath: '' }, { srcPath: 'models' }, { srcPath: 'bundle' }]
    expect(filterSiblings('models', all)).toEqual([{ srcPath: '' }, { srcPath: 'bundle' }])
  })
})

describe('dtsPathFor', () => {
  it('resolves the root entry', () => {
    expect(dtsPathFor('/abs/dist/libs/foo', '')).toBe('/abs/dist/libs/foo/index.d.ts')
  })

  it('resolves a sub-entry', () => {
    expect(dtsPathFor('/abs/dist/libs/foo', 'models')).toBe('/abs/dist/libs/foo/models/index.d.ts')
  })
})
