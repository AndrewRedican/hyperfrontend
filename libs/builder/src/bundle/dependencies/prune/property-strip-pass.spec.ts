import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../../models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { stripDeadPropertiesPass } from './property-strip-pass'

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/abs/src/index.ts', isRoot: true }

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'root',
  entryPoints: entries,
  hasRootEntry: true,
  platformEntries: [],
  featureEntries: [],
})

const makeContext = (outputPath: string): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath,
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: makeDiscovery([ROOT_ENTRY]),
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

const NS_CHUNK =
  'const freeze = 1;\nconst keys = 2;\nconst SafeObject = Object.freeze({ freeze, keys });\nexport { freeze, keys, SafeObject };'

describe('stripDeadPropertiesPass', () => {
  const outputDir = useTempDir({ prefix: 'builder-prop-strip-' })

  const run = (): ReturnType<typeof stripDeadPropertiesPass> =>
    stripDeadPropertiesPass(makeContext(outputDir.path), outputDir.resolve('_dependencies'))

  const chunkText = (): string => outputDir.read('_dependencies/d/index.mjs')

  it('returns zero counts when there is no _dependencies directory', () => {
    outputDir.write('index.mjs', 'export const a = 1;')
    expect(run()).toEqual({ deadPropertiesRemoved: 0, bytesRemoved: 0 })
  })

  it('returns zero counts when there are no ESM chunks', () => {
    outputDir.write('index.mjs', 'export const a = 1;')
    outputDir.write('_dependencies/keep.txt', 'x')
    expect(run()).toEqual({ deadPropertiesRemoved: 0, bytesRemoved: 0 })
  })

  it('returns zero counts when no chunk exports a frozen namespace', () => {
    outputDir.write('index.mjs', "import { x } from './_dependencies/d/index.mjs';\nexport const u = x;")
    outputDir.write('_dependencies/d/index.mjs', 'const x = 1;\nexport { x };')
    expect(run()).toEqual({ deadPropertiesRemoved: 0, bytesRemoved: 0 })
  })

  it('reports the slot stripped off a wholesale-imported namespace and the bytes it freed', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run()).toEqual({ deadPropertiesRemoved: 1, bytesRemoved: Buffer.byteLength(', keys') })
  })

  it('strips the slots an entry never reads off a wholesale-imported namespace', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toContain('Object.freeze({ freeze })')
  })

  it('reports no dead property when a consumer reads every slot', () => {
    outputDir.write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nexport const v = SafeObject.keys;"
    )
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps every slot a consumer reads', () => {
    outputDir.write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nexport const v = SafeObject.keys;"
    )
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toBe(NS_CHUNK)
  })

  it('keeps a namespace whole when a consumer spreads it', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const all = { ...SafeObject };")
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps a namespace whole when a consumer imports the chunk as a namespace', () => {
    outputDir.write('index.mjs', "import * as ns from './_dependencies/d/index.mjs';\nexport const u = ns.SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  const SELF_READING_CHUNK =
    'const freeze = 1;\nconst keys = 2;\nconst create = 3;\nconst SafeObject = Object.freeze({ freeze, keys, create });\nconst self = SafeObject.keys;\nexport { SafeObject, self };'

  it('reports only the slot neither the consumer nor the defining chunk reads', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.mjs', SELF_READING_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('honors the defining chunk own internal read when computing demand', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.mjs', SELF_READING_CHUNK)
    run()
    expect(chunkText()).toContain('Object.freeze({ freeze, keys })')
  })

  it('reports no dead property when a consumer only reads a property the namespace does not define', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.missing;")
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps a namespace whole when a consumer only reads a property it does not define', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.missing;")
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toBe(NS_CHUNK)
  })

  it('leaves a wholly-unread namespace import to the export pass', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = 1;")
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('reports no dead property when a dynamic specifier appears anywhere in the graph', () => {
    outputDir.write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nconst p = import('./x' + u);"
    )
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('bails the whole run on a dynamic specifier anywhere in the graph', () => {
    outputDir.write(
      'index.mjs',
      "import { SafeObject } from './_dependencies/d/index.mjs';\nexport const u = SafeObject.freeze;\nconst p = import('./x' + u);"
    )
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toBe(NS_CHUNK)
  })

  it('reports one dead property when demand arrives through a sibling dependency chunk', () => {
    outputDir.write('index.mjs', "import { mid } from './_dependencies/a/index.mjs';\nexport const u = mid;")
    outputDir.write(
      '_dependencies/a/index.mjs',
      "import { SafeObject } from '../d/index.mjs';\nconst mid = SafeObject.freeze;\nexport { mid };"
    )
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('reads namespace demand across a sibling dependency chunk', () => {
    outputDir.write('index.mjs', "import { mid } from './_dependencies/a/index.mjs';\nexport const u = mid;")
    outputDir.write(
      '_dependencies/a/index.mjs',
      "import { SafeObject } from '../d/index.mjs';\nconst mid = SafeObject.freeze;\nexport { mid };"
    )
    outputDir.write('_dependencies/d/index.mjs', NS_CHUNK)
    run()
    expect(chunkText()).toContain('Object.freeze({ freeze })')
  })

  const CJS_NS_CHUNK =
    'var freeze = 1;\nvar keys = 2;\nvar SafeObject = Object.freeze({ freeze, keys });\nexports.freeze = freeze;\nexports.keys = keys;\nexports.SafeObject = SafeObject;'
  const cjsChunkText = (): string => outputDir.read('_dependencies/d/index.cjs')

  it('reports one dead property for a slot read two-level off a CJS require namespace binding', () => {
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('strips a slot read two-level off a CJS require namespace binding', () => {
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.freeze;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect(cjsChunkText()).toContain('Object.freeze({ freeze })')
  })

  it('reports no dead property when a CJS module binding is consumed wholesale', () => {
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.all = d.SafeObject;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(0)
  })

  it('keeps a CJS namespace whole when the module binding is consumed wholesale', () => {
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.all = d.SafeObject;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect(cjsChunkText()).toBe(CJS_NS_CHUNK)
  })

  it('reports one dead property for a CJS namespace read through a destructured require binding', () => {
    outputDir.write('index.cjs', "var { SafeObject } = require('./_dependencies/d/index.cjs');\nexports.u = SafeObject.keys;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(1)
  })

  it('strips a CJS namespace read through a destructured require binding', () => {
    outputDir.write('index.cjs', "var { SafeObject } = require('./_dependencies/d/index.cjs');\nexports.u = SafeObject.keys;")
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect(cjsChunkText()).toContain('Object.freeze({ keys })')
  })

  it('counts the slots stripped from ESM and CJS chunks in the same run', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/e/index.mjs';\nexport const u = SafeObject.freeze;")
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.keys;")
    outputDir.write('_dependencies/e/index.mjs', NS_CHUNK)
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    expect(run().deadPropertiesRemoved).toBe(2)
  })

  it('processes ESM and CJS chunks in the same run', () => {
    outputDir.write('index.mjs', "import { SafeObject } from './_dependencies/e/index.mjs';\nexport const u = SafeObject.freeze;")
    outputDir.write('index.cjs', "var d = require('./_dependencies/d/index.cjs');\nexports.u = d.SafeObject.keys;")
    outputDir.write('_dependencies/e/index.mjs', NS_CHUNK)
    outputDir.write('_dependencies/d/index.cjs', CJS_NS_CHUNK)
    run()
    expect([cjsChunkText(), outputDir.read('_dependencies/e/index.mjs')]).toEqual([
      expect.stringContaining('Object.freeze({ keys })'),
      expect.stringContaining('Object.freeze({ freeze })'),
    ])
  })
})
